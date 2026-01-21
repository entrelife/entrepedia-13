import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, post_id, user_id, reason } = await req.json();

    if (!action || !post_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "action, post_id, and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user is an admin by checking user_roles table
    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminRole) {
      // Also check profiles.role as fallback
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .single();

      if (profileError || profile?.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Perform the requested action
    if (action === "hide") {
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          is_hidden: true,
          hidden_at: new Date().toISOString(),
          hidden_reason: reason || "Hidden by admin due to report",
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Hide post error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the action
      await supabase.from("admin_activity_logs").insert({
        admin_id: user_id,
        action: "hide_post",
        target_type: "post",
        target_id: post_id,
        details: { reason: reason || "Hidden by admin due to report" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Post hidden successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "delete") {
      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", post_id);

      if (deleteError) {
        console.error("Delete post error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the action
      await supabase.from("admin_activity_logs").insert({
        admin_id: user_id,
        action: "delete_post",
        target_type: "post",
        target_id: post_id,
        details: { reason: reason || "Deleted by admin" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Post deleted successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "unhide") {
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          is_hidden: false,
          hidden_at: null,
          hidden_reason: null,
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Unhide post error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the action
      await supabase.from("admin_activity_logs").insert({
        admin_id: user_id,
        action: "unhide_post",
        target_type: "post",
        target_id: post_id,
        details: {},
      });

      return new Response(
        JSON.stringify({ success: true, message: "Post unhidden successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'hide', 'unhide', or 'delete'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
