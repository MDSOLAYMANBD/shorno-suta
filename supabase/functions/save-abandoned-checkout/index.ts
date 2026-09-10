import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting (per edge function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5; // max 5 abandoned checkouts per IP per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// Clean up stale entries periodically
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limit by IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Periodic cleanup
    cleanupRateLimitMap();

    const body = await req.json();

    // UPDATE mode: if `id` is provided, update name/address only
    if (body.id && typeof body.id === "string") {
      // Require customer_phone for ownership verification (prevents IDOR)
      if (!body.customer_phone || typeof body.customer_phone !== "string") {
        return new Response(
          JSON.stringify({ error: "customer_phone required for update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const phoneClean = body.customer_phone.replace(/[\s-]/g, "").replace(/^\+?88/, "");
      if (!/^01[3-9]\d{8}$/.test(phoneClean)) {
        return new Response(
          JSON.stringify({ error: "Invalid phone number format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const updateData: Record<string, string | null> = {};
      if (typeof body.customer_name === "string") {
        updateData.customer_name = body.customer_name.trim().slice(0, 100) || "Unknown";
      }
      if (typeof body.customer_address === "string") {
        updateData.customer_address = body.customer_address.trim().slice(0, 500) || null;
      }
      if (body.customer_email !== undefined) {
        updateData.customer_email = typeof body.customer_email === "string" && body.customer_email.trim()
          ? body.customer_email.trim().slice(0, 200)
          : null;
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ error: "Nothing to update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error, data: updated } = await supabaseAdmin
        .from("abandoned_checkouts")
        .update(updateData)
        .eq("id", body.id)
        .eq("customer_phone", phoneClean.slice(0, 11))
        .select("id");

      if (error) {
        console.error("Update error:", error.message);
        return new Response(
          JSON.stringify({ error: "Failed to update" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ updated: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // INSERT mode (existing logic)
    const { customer_name, customer_phone, customer_address, customer_email, cart_data, subtotal } = body;

    const safeName = customer_name && typeof customer_name === "string" ? customer_name : "Unknown";

    if (!customer_phone || typeof customer_phone !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid customer_phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format (Bangladesh)
    const phoneClean = customer_phone.replace(/[\s-]/g, "").replace(/^\+?88/, "");
    if (!/^01[3-9]\d{8}$/.test(phoneClean)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(cart_data)) {
      return new Response(
        JSON.stringify({ error: "Invalid cart_data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof subtotal !== "number" || subtotal < 0) {
      return new Response(
        JSON.stringify({ error: "Invalid subtotal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize and limit inputs
    const sanitizedData: Record<string, any> = {
      customer_name: safeName.trim().slice(0, 100),
      customer_phone: phoneClean.slice(0, 11),
      customer_address: typeof customer_address === "string"
        ? customer_address.trim().slice(0, 500)
        : null,
      customer_email: typeof customer_email === "string" && customer_email.trim()
        ? customer_email.trim().slice(0, 200)
        : null,
      cart_data: cart_data.slice(0, 50),
      subtotal: Math.min(subtotal, 10000000),
    };

    // Insert using service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabaseAdmin
      .from("abandoned_checkouts")
      .insert(sanitizedData)
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to save" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
