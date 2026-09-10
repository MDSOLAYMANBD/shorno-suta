// Cron-driven dispatcher (every 5 min). Scans pending follow-ups whose due_at <= now,
// posts the corresponding message into inbox_messages, marks the row "sent".
// If staff has replied since the follow-up was scheduled, the row is cancelled instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESSAGES: Record<string, string> = {
  "10m": "আসসালামু আলাইকুম 👋 আপনার মেসেজটি পেয়েছি — কিছু জানার থাকলে বলুন, আমরা সাহায্য করতে চাই।",
  "1h": "এখনো আগ্রহী থাকলে রিপ্লাই দিন — সীমিত সময়ের জন্য বিশেষ অফার চলছে! 🎁",
  "6h": "এটা আমাদের শেষ ফলো-আপ — যেকোনো সময় ফিরে এসে অর্ডার দিতে পারবেন। ধন্যবাদ! 🌸",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require service-role bearer (cron uses this)
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
  if (authHeader !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: due } = await supabase
      .from("inbox_followups")
      .select("id, conversation_id, step, created_at")
      .eq("status", "pending")
      .lte("due_at", new Date().toISOString())
      .limit(200);

    let sent = 0, cancelled = 0;
    for (const f of (due || [])) {
      // If a staff message exists in this conv after the follow-up was scheduled → cancel
      const { data: staffSince } = await supabase
        .from("inbox_messages")
        .select("id")
        .eq("conversation_id", f.conversation_id)
        .eq("sender_type", "staff")
        .gt("created_at", f.created_at)
        .limit(1);
      if (staffSince && staffSince.length > 0) {
        await supabase.from("inbox_followups").update({ status: "cancelled" }).eq("id", f.id);
        cancelled++;
        continue;
      }

      const message = MESSAGES[f.step] || "ফলো-আপ মেসেজ";
      const { data: inserted } = await supabase
        .from("inbox_messages")
        .insert({
          conversation_id: f.conversation_id,
          sender_type: "system",
          sender_name: "🤖 Auto Follow-up",
          message,
          metadata: { type: "followup", step: f.step },
        } as any)
        .select("id")
        .single();

      await supabase.from("inbox_followups").update({
        status: "sent",
        sent_message_id: inserted?.id || null,
      }).eq("id", f.id);
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, cancelled, scanned: due?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-followup-dispatch", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
