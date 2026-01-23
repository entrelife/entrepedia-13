import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { action, session_token, ...data } = await req.json();

    console.log("Manage promotions action:", action);

    // Validate admin session token
    if (!session_token) {
      return new Response(
        JSON.stringify({ error: "Session token is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session and get user
    const { data: sessionData, error: sessionError } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at, is_active")
      .eq("session_token", session_token)
      .single();

    if (sessionError || !sessionData || !sessionData.is_active || new Date(sessionData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sessionData.user_id);

    if (rolesError || !roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasAdminRole = roles.some(r => 
      ['super_admin', 'content_moderator', 'category_manager'].includes(r.role)
    );

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'list': {
        const { data: promotions, error } = await supabase
          .from("promotional_content")
          .select("*")
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, data: promotions }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'create': {
        const { title, description, content_type, image_url, video_url, link_url, link_text, is_active, display_order, start_date, end_date } = data;
        
        if (!title || !content_type) {
          return new Response(
            JSON.stringify({ error: "Title and content_type are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: promotion, error } = await supabase
          .from("promotional_content")
          .insert({
            title,
            description: description || null,
            content_type,
            image_url: image_url || null,
            video_url: video_url || null,
            link_url: link_url || null,
            link_text: link_text || null,
            is_active: is_active ?? true,
            display_order: display_order ?? 0,
            start_date: start_date || null,
            end_date: end_date || null,
            created_by: sessionData.user_id,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, data: promotion }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update': {
        const { id, ...updateData } = data;
        
        if (!id) {
          return new Response(
            JSON.stringify({ error: "ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: promotion, error } = await supabase
          .from("promotional_content")
          .update({
            title: updateData.title,
            description: updateData.description || null,
            content_type: updateData.content_type,
            image_url: updateData.image_url || null,
            video_url: updateData.video_url || null,
            link_url: updateData.link_url || null,
            link_text: updateData.link_text || null,
            is_active: updateData.is_active,
            display_order: updateData.display_order,
            start_date: updateData.start_date || null,
            end_date: updateData.end_date || null,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, data: promotion }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'delete': {
        const { id } = data;
        
        if (!id) {
          return new Response(
            JSON.stringify({ error: "ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("promotional_content")
          .delete()
          .eq("id", id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'toggle_active': {
        const { id, is_active } = data;
        
        if (!id || is_active === undefined) {
          return new Response(
            JSON.stringify({ error: "ID and is_active are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("promotional_content")
          .update({ is_active })
          .eq("id", id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Manage promotions error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
