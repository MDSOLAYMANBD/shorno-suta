import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return json({ error: "Phone and code required" }, 400);
    }

    const cleanPhone = phone.replace(/[\s-]/g, "").replace(/^\+?88/, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return json({ error: "Invalid phone" }, 400);
    }

    if (typeof code !== "string" || !/^\d{4}$/.test(code)) {
      return json({ error: "Invalid OTP format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid OTP
    const { data: otpRecord, error } = await supabase
      .from("otp_codes")
      .select("id, code, expires_at, attempts")
      .eq("phone", cleanPhone)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !otpRecord) {
      return json({ error: "No OTP found. Please request a new one.", verified: false }, 400);
    }

    // Check if too many attempts (max 5)
    if (otpRecord.attempts >= 5) {
      // Invalidate the OTP
      await supabase
        .from("otp_codes")
        .update({ verified: true })
        .eq("id", otpRecord.id);
      return json({ error: "Too many failed attempts. Please request a new OTP.", verified: false }, 429);
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      return json({ error: "OTP expired. Please request a new one.", verified: false }, 400);
    }

    // Check code
    if (otpRecord.code !== code) {
      // Increment attempt counter
      await supabase
        .from("otp_codes")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);
      const remaining = 4 - otpRecord.attempts;
      return json({ error: `Invalid OTP code. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Please request a new OTP.'}`, verified: false }, 400);
    }

    // Mark as verified
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    return json({ verified: true });
  } catch (err) {
    console.error("verify-otp error:", err);
    return json({ error: "Invalid request" }, 400);
  }
});
