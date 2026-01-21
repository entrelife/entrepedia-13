import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, user_id, admin_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Account deletion action: ${action} for user: ${user_id}`);

    if (action === 'request_deletion') {
      // Check if there's already a pending request
      const { data: existingRequest, error: checkError } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing request:', checkError);
        throw checkError;
      }

      if (existingRequest) {
        return new Response(
          JSON.stringify({ 
            error: 'A deletion request is already pending',
            existing_request: existingRequest
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new deletion request
      const scheduledDeletionAt = new Date();
      scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 3);

      const { data: newRequest, error: insertError } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id,
          scheduled_deletion_at: scheduledDeletionAt.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating deletion request:', insertError);
        throw insertError;
      }

      console.log('Deletion request created:', newRequest);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account deletion scheduled',
          deletion_request: newRequest
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'cancel_deletion') {
      // Find and cancel the pending request
      const { data: cancelledRequest, error: cancelError } = await supabase
        .from('account_deletion_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .select()
        .single();

      if (cancelError) {
        console.error('Error cancelling deletion request:', cancelError);
        if (cancelError.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'No pending deletion request found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw cancelError;
      }

      console.log('Deletion request cancelled:', cancelledRequest);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account deletion cancelled',
          deletion_request: cancelledRequest
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get_status') {
      // Get current deletion request status
      const { data: request, error: statusError } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .maybeSingle();

      if (statusError) {
        console.error('Error getting deletion status:', statusError);
        throw statusError;
      }

      return new Response(
        JSON.stringify({ 
          has_pending_request: !!request,
          deletion_request: request
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get_all_pending') {
      // Admin action: Get all pending deletion requests
      const { data: requests, error: fetchError } = await supabase
        .from('account_deletion_requests')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url,
            email
          )
        `)
        .eq('status', 'pending')
        .order('scheduled_deletion_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching pending requests:', fetchError);
        throw fetchError;
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          requests: requests || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'admin_delete_now') {
      // Admin action: Immediately delete user account
      if (!admin_id) {
        return new Response(
          JSON.stringify({ error: 'admin_id is required for admin actions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify admin has proper role
      const { data: adminRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', admin_id)
        .in('role', ['super_admin', 'content_moderator'])
        .maybeSingle();

      if (roleError || !adminRole) {
        console.error('Admin verification failed:', roleError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Admin privileges required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if there's a pending deletion request for this user
      const { data: pendingRequest, error: pendingError } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingError) {
        console.error('Error checking pending request:', pendingError);
        throw pendingError;
      }

      if (!pendingRequest) {
        return new Response(
          JSON.stringify({ error: 'No pending deletion request found for this user. Users must request deletion first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Admin ${admin_id} performing immediate deletion for user ${user_id}`);

      // Delete user data in order (respecting foreign key constraints)
      // 1. Delete messages
      await supabase.from('messages').delete().eq('sender_id', user_id);
      
      // 2. Delete conversations
      await supabase.from('conversations').delete().or(`participant_one.eq.${user_id},participant_two.eq.${user_id}`);
      
      // 3. Delete post likes
      await supabase.from('post_likes').delete().eq('user_id', user_id);
      
      // 4. Delete comments
      await supabase.from('comments').delete().eq('user_id', user_id);
      
      // 5. Delete posts
      await supabase.from('posts').delete().eq('user_id', user_id);
      
      // 6. Delete follows
      await supabase.from('follows').delete().or(`follower_id.eq.${user_id},following_id.eq.${user_id}`);
      
      // 7. Delete business follows
      await supabase.from('business_follows').delete().eq('user_id', user_id);
      
      // 8. Delete community memberships
      await supabase.from('community_members').delete().eq('user_id', user_id);
      
      // 9. Delete community discussions
      await supabase.from('community_discussions').delete().eq('user_id', user_id);
      
      // 10. Delete notifications
      await supabase.from('notifications').delete().eq('user_id', user_id);
      
      // 11. Delete user skills
      await supabase.from('user_skills').delete().eq('user_id', user_id);
      
      // 12. Delete user sessions
      await supabase.from('user_sessions').delete().eq('user_id', user_id);
      
      // 13. Delete user credentials
      await supabase.from('user_credentials').delete().eq('id', user_id);

      // 14. Update deletion request status
      await supabase
        .from('account_deletion_requests')
        .update({
          status: 'completed',
          deleted_at: new Date().toISOString()
        })
        .eq('id', pendingRequest.id);

      // 15. Delete profile (last, as other tables reference it)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user_id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw profileError;
      }

      // Log admin activity
      await supabase.from('admin_activity_logs').insert({
        admin_id: admin_id,
        action: 'Immediately deleted user account',
        target_type: 'user',
        target_id: user_id,
        details: { 
          deletion_request_id: pendingRequest.id,
          originally_scheduled_for: pendingRequest.scheduled_deletion_at
        }
      });

      console.log(`User ${user_id} account deleted by admin ${admin_id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User account permanently deleted'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: request_deletion, cancel_deletion, get_status, get_all_pending, or admin_delete_now' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in manage-account-deletion:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
