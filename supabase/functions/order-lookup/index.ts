import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (per function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function normalizePhone(phone: string): string[] {
  // Remove spaces, dashes
  let clean = phone.replace(/[\s-]/g, "");
  // Remove leading +88 or 88
  clean = clean.replace(/^\+?88/, "");
  // Now clean should be like 01XXXXXXXXX
  if (!/^0\d{10}$/.test(clean)) return [];
  const withoutZero = clean.slice(1); // 1XXXXXXXXX
  return [clean, `+880${withoutZero}`, `880${withoutZero}`];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, order_number } = await req.json();

    // Validate phone (required)
    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "Phone number is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneVariants = normalizePhone(phone.trim());
    if (phoneVariants.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // order_number is optional
    const trimmedOrder = order_number ? String(order_number).trim().toUpperCase() : null;
    if (trimmedOrder && !/^SD-\d{6}$/.test(trimmedOrder)) {
      return new Response(
        JSON.stringify({ error: "Invalid order number format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabaseAdmin
      .from("orders")
      .select("id, order_number, status, delivery_charge, subtotal, total, created_at, courier_consignment_id, courier_status, discount_note, free_shipping")
      .in("customer_phone", phoneVariants)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (trimmedOrder) {
      query = query.eq("order_number", trimmedOrder);
    }

    const { data: orders, error: orderError } = await query;

    if (orderError) {
      return new Response(
        JSON.stringify({ error: "Failed to look up order." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ orders: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch items and tracking events for found orders
    const orderIds = orders.map(o => o.id);

    const [itemsResult, trackingResult] = await Promise.all([
      supabaseAdmin
        .from("order_items")
        .select("id, product_name, quantity, price, size, color, order_id")
        .in("order_id", orderIds),
      supabaseAdmin
        .from("courier_tracking_events")
        .select("id, order_id, status, note, rider_name, rider_phone, hub_name, hub_phone, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true }),
    ]);

    const itemsByOrder = new Map<string, any[]>();
    for (const item of (itemsResult.data || [])) {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    const trackingByOrder = new Map<string, any[]>();
    for (const evt of (trackingResult.data || [])) {
      const list = trackingByOrder.get(evt.order_id) || [];
      list.push(evt);
      trackingByOrder.set(evt.order_id, list);
    }

    const ordersWithDetails = orders.map(order => ({
      ...order,
      items: itemsByOrder.get(order.id) || [],
      tracking_events: trackingByOrder.get(order.id) || [],
    }));

    return new Response(
      JSON.stringify({ orders: ordersWithDetails }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
