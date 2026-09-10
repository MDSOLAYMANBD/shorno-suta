import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

  // Auth check: only allow service-role or authenticated admin calls
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || authHeader !== serviceRoleKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return json({ error: "Missing required fields: to, subject, html/text" }, 400);
    }

    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.hostinger.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpUser || !smtpPass) {
      console.error("SMTP credentials not configured");
      return json({ error: "Email service not configured" }, 500);
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    // TODO: once the client has their own domain + SMTP account, update these
    // to a verified sender address for that domain, or the mail server may reject the send.
    await client.send({
      from: "Shorno Suta <noreply@shorno-suta.example>",
      to,
      replyTo: "support@shorno-suta.example",
      subject,
      content: text || "auto",
      html: html || undefined,
    });

    await client.close();

    console.log(`Email sent to ${to}: ${subject}`);
    return json({ success: true });
  } catch (err) {
    console.error("Send email error:", err);
    return json({ error: "Failed to send email" }, 500);
  }
});
