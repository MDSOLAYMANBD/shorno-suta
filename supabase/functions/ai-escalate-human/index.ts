import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, session_token, visitor_name, visitor_phone, last_message } = await req.json();

    if (!session_id || !session_token) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data, error } = await supabase.rpc("create_ai_support_request", {
      p_session_id: session_id,
      p_session_token: session_token,
      p_visitor_name: visitor_name || "",
      p_visitor_phone: visitor_phone || "",
      p_last_message: last_message || "",
    });

    if (error) {
      console.error("Escalation failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert AI confirmation message
    await supabase.rpc("insert_ai_chat_message", {
      p_session_id: session_id,
      p_session_token: session_token,
      p_message: "ঠিক আছে! ✅ আমাদের একজন প্রতিনিধি অল্প সময়ের মধ্যে আপনাকে রিপ্লাই দেবেন ইনশাআল্লাহ। অনুগ্রহ করে অপেক্ষা করুন।",
      p_metadata: { intent: "escalation_confirmed", quick_replies: [] },
    });

    return new Response(JSON.stringify({ id: data, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("escalate error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
