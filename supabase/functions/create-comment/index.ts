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
    
    const { user_id, post_id, content } = await req.json();

    console.log("Creating comment - user:", user_id, "post:", post_id);

    if (!user_id || !post_id || !content) {
      return new Response(
        JSON.stringify({ error: "User ID, Post ID, and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the comment
    const { data: comment, error: commentError } = await supabase
      .from("comments")
      .insert({
        user_id,
        post_id,
        content,
      })
      .select(`
        *,
        profiles:user_id (id, full_name, username, avatar_url)
      `)
      .single();

    if (commentError) {
      console.error("Comment creation error:", commentError);
      return new Response(
        JSON.stringify({ error: "Failed to create comment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Comment created successfully:", comment.id);

    return new Response(
      JSON.stringify({ success: true, comment }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create comment error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
