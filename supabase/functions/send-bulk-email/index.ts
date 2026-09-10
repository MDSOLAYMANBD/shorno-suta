import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: require admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // ── Parse body ──
    const body = await req.json();
    const subject = body.subject || "";
    const html = body.html || "";
    const segment = body.segment || "all";

    let recipientList: { email: string; name: string }[] = [];
    if (body.recipients?.length) {
      recipientList = body.recipients;
    } else if (body.emails?.length) {
      recipientList = body.emails.map((e: string) => ({ email: e, name: "" }));
    }

    if (!recipientList.length || !subject || !html) {
      return json({ error: "Missing recipients, subject, or html" }, 400);
    }

    // Get shop name from settings
    let shopName = "আমাদের শপ";
    try {
      const { data: setting } = await sb
        .from("store_settings")
        .select("value")
        .eq("key", "store_name")
        .maybeSingle();
      if (setting?.value) shopName = setting.value;
    } catch (_) { /* ignore */ }

    const results: { email: string; status: string; error?: string }[] = [];

    for (const recipient of recipientList) {
      try {
        const personalizedSubject = subject
          .replace(/\{\{customer_name\}\}/g, recipient.name || "প্রিয় গ্রাহক")
          .replace(/\{\{shop_name\}\}/g, shopName);
        const personalizedHtml = html
          .replace(/\{\{customer_name\}\}/g, recipient.name || "প্রিয় গ্রাহক")
          .replace(/\{\{shop_name\}\}/g, shopName);

        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: recipient.email,
            subject: personalizedSubject,
            html: personalizedHtml,
          }),
        });

        const resBody = await res.text();

        if (res.ok) {
          results.push({ email: recipient.email, status: "sent" });
          try {
            await sb.from("notification_logs").insert({
              notification_type: "bulk_campaign",
              channel: "email",
              recipient: recipient.email,
              status: "sent",
            });
          } catch (_) { /* ignore */ }
        } else {
          results.push({ email: recipient.email, status: "failed", error: resBody });
          try {
            await sb.from("notification_logs").insert({
              notification_type: "bulk_campaign",
              channel: "email",
              recipient: recipient.email,
              status: "failed",
              error_message: resBody.substring(0, 500),
            });
          } catch (_) { /* ignore */ }
        }
      } catch (err: any) {
        results.push({ email: recipient.email, status: "failed", error: err.message });
        try {
          await sb.from("notification_logs").insert({
            notification_type: "bulk_campaign",
            channel: "email",
            recipient: recipient.email,
            status: "failed",
            error_message: (err.message || "").substring(0, 500),
          });
        } catch (_) { /* ignore */ }
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    // Log campaign to email_campaigns table
    try {
      await sb.from("email_campaigns").insert({
        subject,
        html_body: html,
        recipient_count: recipientList.length,
        sent_count: sent,
        failed_count: failed,
        segment_filter: { segment },
      });
    } catch (_) { /* ignore */ }

    console.log(`Bulk email: ${sent} sent, ${failed} failed out of ${recipientList.length}`);
    return json({ success: true, sent, failed, total: recipientList.length });
  } catch (err: any) {
    console.error("Bulk email error:", err);
    return json({ error: "Failed to process bulk email" }, 500);
  }
});
