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
    
    const { user_id, post_id } = await req.json();

    console.log("Toggle like - user:", user_id, "post:", post_id);

    if (!user_id || !post_id) {
      return new Response(
        JSON.stringify({ error: "User ID and Post ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if like already exists
    const { data: existingLike, error: checkError } = await supabase
      .from("post_likes")
      .select("id")
      .eq("user_id", user_id)
      .eq("post_id", post_id)
      .maybeSingle();

    if (checkError) {
      console.error("Check like error:", checkError);
      return new Response(
        JSON.stringify({ error: "Failed to check like status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingLike) {
      // Unlike - remove the like
      const { error: deleteError } = await supabase
        .from("post_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) {
        console.error("Delete like error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to unlike post" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Post unliked successfully");
      return new Response(
        JSON.stringify({ success: true, liked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Like - add new like
      const { error: insertError } = await supabase
        .from("post_likes")
        .insert({ user_id, post_id });

      if (insertError) {
        console.error("Insert like error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to like post" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Post liked successfully");
      return new Response(
        JSON.stringify({ success: true, liked: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Toggle like error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
