// consent-log — server-authoritative logging of Consent Mode v2 changes.
// Reduces abuse potential of a direct anon INSERT into `tracking_consent_events`
// and enriches each event with the real client IP + user agent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Per-IP rate limit — 60 events / hour is plenty for real consent updates.
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 60;
const RL_WINDOW = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimit.size > 2000) {
    for (const [k, v] of rateLimit) if (now > v.resetAt) rateLimit.delete(k);
  }
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RL_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

const CONSENT_VALUES = new Set(["granted", "denied"]);
const CONSENT_KEYS = [
  "ad_storage",
  "analytics_storage",
  "ad_user_data",
  "ad_personalization",
] as const;

function sanitizeConsent(raw: unknown): Record<string, string | null> {
  const out: Record<string, string | null> = {
    ad_storage: null,
    analytics_storage: null,
    ad_user_data: null,
    ad_personalization: null,
  };
  if (!raw || typeof raw !== "object") return out;
  for (const key of CONSENT_KEYS) {
    const v = (raw as any)[key];
    if (typeof v === "string" && CONSENT_VALUES.has(v)) out[key] = v;
  }
  return out;
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const consent = sanitizeConsent(body?.consent ?? body);

    // Must have at least one recognised consent signal.
    if (!Object.values(consent).some((v) => v !== null)) {
      return new Response(JSON.stringify({ error: "invalid_consent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const row = {
      session_id: clip(body?.session_id, 128),
      user_id: null as string | null, // frontend sends nothing; keep null unless server-validated
      ad_storage: consent.ad_storage,
      analytics_storage: consent.analytics_storage,
      ad_user_data: consent.ad_user_data,
      ad_personalization: consent.ad_personalization,
      source: clip(body?.source, 64) || "web",
      user_agent: clip(req.headers.get("user-agent"), 512),
      client_ip: ip,
      page_url: clip(body?.page_url, 1024),
    };

    const { error } = await supabase.from("tracking_consent_events").insert(row);
    if (error) {
      console.error("consent-log insert error", error);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("consent-log error", e);
    return new Response(JSON.stringify({ error: "bad_request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
