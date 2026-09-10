// Simulates sending a broadcast campaign — NO real WhatsApp/Messenger calls.
// Marks recipients delivered with random distribution and updates campaign counters.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Mark campaign as sending
    await supabase
      .from("inbox_broadcast_campaigns")
      .update({ status: "sending" })
      .eq("id", campaign_id);

    // Pull recipients in batches
    let total = 0;
    let delivered = 0;
    let opened = 0;
    let from = 0;
    const PAGE = 500;
    while (true) {
      const { data: batch } = await supabase
        .from("inbox_broadcast_recipients")
        .select("id")
        .eq("campaign_id", campaign_id)
        .eq("status", "pending")
        .range(from, from + PAGE - 1);
      if (!batch || batch.length === 0) break;

      const updates = batch.map((r: any) => {
        const dice = Math.random();
        const status = dice < 0.85 ? "delivered" : dice < 0.95 ? "sent" : "failed";
        if (status === "delivered" && Math.random() < 0.4) opened++;
        if (status === "delivered") delivered++;
        total++;
        return { id: r.id, status, simulated_at: new Date().toISOString() };
      });

      // Bulk update via upsert (id-based)
      for (const u of updates) {
        await supabase
          .from("inbox_broadcast_recipients")
          .update({ status: u.status, simulated_at: u.simulated_at })
          .eq("id", u.id);
      }

      if (batch.length < PAGE) break;
      from += PAGE;
    }

    await supabase
      .from("inbox_broadcast_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: total,
        delivered_count: delivered,
        opened_count: opened,
      })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({ ok: true, total, delivered, opened }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-broadcast-simulate error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
