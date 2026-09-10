// Schedules 10m / 1h / 6h follow-ups for a conversation when a visitor leaves a message.
// Existing pending follow-ups for that conversation are first cancelled (so we always
// schedule from the latest visitor message). Idempotent on (conversation_id, last_message_id, step).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STEPS: { step: "10m" | "1h" | "6h"; ms: number; message: string }[] = [
  { step: "10m", ms: 10 * 60 * 1000, message: "আসসালামু আলাইকুম 👋 আপনার মেসেজটি পেয়েছি — কিছু জানার থাকলে বলুন, আমরা সাহায্য করতে চাই।" },
  { step: "1h",  ms: 60 * 60 * 1000, message: "এখনো আগ্রহী থাকলে রিপ্লাই দিন — সীমিত সময়ের জন্য বিশেষ অফার চলছে! 🎁" },
  { step: "6h",  ms: 6 * 60 * 60 * 1000, message: "এটা আমাদের শেষ ফলো-আপ — যেকোনো সময় ফিরে এসে অর্ডার দিতে পারবেন। ধন্যবাদ! 🌸" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { conversation_id, last_message_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cancel any existing pending follow-ups for this conv
    await supabase
      .from("inbox_followups")
      .update({ status: "cancelled" })
      .eq("conversation_id", conversation_id)
      .eq("status", "pending");

    const now = Date.now();
    const rows = STEPS.map((s) => ({
      conversation_id,
      last_message_id: last_message_id || null,
      step: s.step,
      due_at: new Date(now + s.ms).toISOString(),
      status: "pending",
    }));
    await supabase.from("inbox_followups").insert(rows);

    return new Response(JSON.stringify({ ok: true, scheduled: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-followup-schedule", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
