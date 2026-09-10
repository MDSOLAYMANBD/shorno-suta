import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsViaActiveProvider } from "../_shared/smsProviders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendSms(supabaseAdmin: any, phone: string, message: string): Promise<boolean> {
  try {
    const r = await sendSmsViaActiveProvider(supabaseAdmin, phone, message);
    console.log("OTP SMS result:", r.provider, r.success, r.error || "");
    return r.success;
  } catch (e) {
    console.error("OTP SMS error:", e);
    return false;
  }
}

// Rate limit: max 3 OTP requests per phone per 10 minutes
const otpRateLimit = new Map<string, { count: number; resetAt: number }>();

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
    // Emergency spend guard: SMS must only be sent for real order
    // confirmations through `place-order` -> `send-order-notification`.
    return json({
      success: false,
      disabled: true,
      error: "OTP SMS is disabled. Only order confirmation SMS is allowed.",
    }, 200);

    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return json({ error: "Phone number required" }, 400);
    }

    const cleanPhone = phone.replace(/[\s-]/g, "").replace(/^\+?88/, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return json({ error: "Invalid phone number" }, 400);
    }

    // Rate limit check
    const now = Date.now();
    const entry = otpRateLimit.get(cleanPhone);
    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > 3) {
        return json({ error: "Too many OTP requests. Try again later." }, 429);
      }
    } else {
      otpRateLimit.set(cleanPhone, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate 4-digit OTP
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate old OTPs for this phone
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("phone", cleanPhone)
      .eq("verified", false);

    // Insert new OTP
    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: cleanPhone,
      code,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("OTP insert error:", insertError);
      return json({ error: "Failed to generate OTP" }, 500);
    }

    // Send SMS
    const message = `স্বর্ণ সুতা ❤️\nআপনার কোড: (${code})\nকোড ৫ মিনিট মেয়াদ।\nshorno-suta.vercel.app`;
    const sent = await sendSms(supabase, cleanPhone, message);

    if (!sent) {
      console.error("Failed to send OTP SMS to", cleanPhone);
      return json({ error: "Failed to send SMS" }, 500);
    }

    return json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("send-otp error:", err);
    return json({ error: "Invalid request" }, 400);
  }
});
