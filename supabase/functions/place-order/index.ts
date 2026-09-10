import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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

async function getDeliveryCharge(supabase: any, area: string): Promise<number> {
  const FALLBACK = { dhaka_inside: 70, dhaka_suburb: 100, dhaka_outside: 130 };
  try {
    const { data } = await supabase
      .from("store_settings")
      .select("key,value")
      .in("key", ["shipping_dhaka_inside", "shipping_dhaka_suburb", "shipping_dhaka_outside"]);
    const map: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      const n = Number(row.value);
      if (Number.isFinite(n) && n >= 0) {
        if (row.key === "shipping_dhaka_inside") map.dhaka_inside = n;
        if (row.key === "shipping_dhaka_suburb") map.dhaka_suburb = n;
        if (row.key === "shipping_dhaka_outside") map.dhaka_outside = n;
      }
    });
    const key = area === "dhaka_inside" ? "dhaka_inside" : area === "dhaka_suburb" ? "dhaka_suburb" : "dhaka_outside";
    return map[key] ?? FALLBACK[key];
  } catch {
    const key = area === "dhaka_inside" ? "dhaka_inside" : area === "dhaka_suburb" ? "dhaka_suburb" : "dhaka_outside";
    return FALLBACK[key];
  }
}

const VALID_DELIVERY_AREAS = ["dhaka_inside", "dhaka_suburb", "dhaka_outside"];

// ========== FREE SHIPPING — mirrors src/lib/freeShipping.ts so server-side
// order creation grants the same free delivery the storefront promised. ==========
interface FreeShippingCampaign {
  id: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  priority: number;
  rule_type: "quantity" | "amount" | "category_quantity" | "product_quantity" | "product_amount" | "combo";
  combine_logic: "and" | "or";
  min_quantity?: number | null;
  max_quantity?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  applicable_category_ids: string[];
  applicable_product_ids: string[];
  excluded_product_ids: string[];
  coupon_code?: string | null;
}

interface FsCartItem {
  product_id: string;
  quantity: number;
  price: number;
  category_id?: string | null;
}

function isCampaignLive(c: FreeShippingCampaign, at = Date.now()): boolean {
  if (c.status !== "active") return false;
  if (c.start_date && new Date(c.start_date).getTime() > at) return false;
  if (c.end_date && new Date(c.end_date).getTime() < at) return false;
  return true;
}

function filterItemsForCampaign(c: FreeShippingCampaign, items: FsCartItem[]): FsCartItem[] {
  let pool = items.filter((i) => !c.excluded_product_ids.includes(i.product_id));
  if (c.applicable_product_ids.length > 0) {
    pool = pool.filter((i) => c.applicable_product_ids.includes(i.product_id));
  }
  if (c.applicable_category_ids.length > 0) {
    pool = pool.filter((i) => i.category_id && c.applicable_category_ids.includes(i.category_id));
  }
  return pool;
}

function campaignQualifies(c: FreeShippingCampaign, items: FsCartItem[], appliedCouponCode?: string | null): boolean {
  if (c.coupon_code && (appliedCouponCode || "").toLowerCase() !== c.coupon_code.toLowerCase()) return false;

  const pool = filterItemsForCampaign(c, items);
  const qty = pool.reduce((s, i) => s + i.quantity, 0);
  const amount = pool.reduce((s, i) => s + i.price * i.quantity, 0);

  const minQ = c.min_quantity ?? 0;
  const maxQ = c.max_quantity ?? Infinity;
  const minA = Number(c.min_amount ?? 0);
  const maxA = Number(c.max_amount ?? Infinity);

  switch (c.rule_type) {
    case "quantity":
    case "category_quantity":
    case "product_quantity":
      return minQ > 0 && qty >= minQ && qty <= maxQ;
    case "amount":
    case "product_amount":
      return minA > 0 && amount >= minA && amount <= maxA;
    case "combo": {
      const qtyOk = minQ === 0 ? true : qty >= minQ && qty <= maxQ;
      const amtOk = minA === 0 ? true : amount >= minA && amount <= maxA;
      return c.combine_logic === "or" ? (qtyOk || amtOk) : (qtyOk && amtOk);
    }
    default:
      return false;
  }
}

async function evaluateFreeDelivery(
  supabase: any,
  items: FsCartItem[],
  appliedCouponCode: string | null | undefined,
): Promise<boolean> {
  const { data: campaigns } = await supabase
    .from("free_shipping_campaigns")
    .select("id, status, start_date, end_date, priority, rule_type, combine_logic, min_quantity, max_quantity, min_amount, max_amount, applicable_category_ids, applicable_product_ids, excluded_product_ids, coupon_code")
    .eq("status", "active");
  const live: FreeShippingCampaign[] = ((campaigns || []) as FreeShippingCampaign[]).filter((c) => isCampaignLive(c));
  return live.some((c) => campaignQualifies(c, items, appliedCouponCode));
}

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
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(clientIp)) {
      return json({ error: "Too many orders. Please try again later." }, 429);
    }

    const body = await req.json();
    const { orderData, items, coupon_code, abandoned_checkout_id, order_attribution, tracking_context } = body;
    const userAgent = req.headers.get("user-agent") || undefined;

    // Sanitize tracking_context — only accept known keys, cap string lengths.
    const trk = (tracking_context && typeof tracking_context === "object") ? tracking_context : {};
    const s = (v: unknown, n: number) => (typeof v === "string" && v.trim()) ? v.trim().slice(0, n) : null;
    const trackingCols: Record<string, any> = {
      ga_client_id: s(trk.ga_client_id, 128),
      ga_session_id: s(trk.ga_session_id, 64),
      fbp: s(trk.fbp, 256),
      fbc: s(trk.fbc, 256),
      gclid: s(trk.gclid, 256),
      gbraid: s(trk.gbraid, 256),
      wbraid: s(trk.wbraid, 256),
      client_ip: clientIp !== "unknown" ? clientIp : null,
      user_agent: s(userAgent, 512),
      event_source_url: s(trk.event_source_url, 1024),
      consent_snapshot: (trk.consent_snapshot && typeof trk.consent_snapshot === "object") ? trk.consent_snapshot : null,
    };

    // Extract customer auth token if present
    let customerUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const anonClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await anonClient.auth.getUser();
        if (user) customerUserId = user.id;
      } catch {}
    }

    if (!orderData || typeof orderData !== "object") {
      return json({ error: "Missing order data." }, 400);
    }

    const sanitizeText = (text: string) => text.replace(/[<>"']/g, "");

    const { customer_name, customer_phone, customer_address, city, delivery_area, notes, customer_email, order_origin, source_landing_page_id } = orderData;

    if (!customer_name || typeof customer_name !== "string" || customer_name.trim().length < 2 || customer_name.length > 200) {
      return json({ error: "Invalid customer name." }, 400);
    }
    if (!customer_phone || typeof customer_phone !== "string") {
      return json({ error: "Invalid phone number." }, 400);
    }
    const phoneClean = customer_phone.replace(/[\s-]/g, "").replace(/^\+?88/, "");
    if (!/^01[3-9]\d{8}$/.test(phoneClean)) {
      return json({ error: "Invalid Bangladesh phone number." }, 400);
    }
    if (!customer_address || typeof customer_address !== "string" || customer_address.trim().length < 5 || customer_address.length > 500) {
      return json({ error: "Invalid address." }, 400);
    }
    if (!delivery_area || !VALID_DELIVERY_AREAS.includes(delivery_area)) {
      return json({ error: "Invalid delivery area." }, 400);
    }
    if (customer_email && typeof customer_email === "string") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim())) {
        return json({ error: "Invalid email format." }, 400);
      }
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return json({ error: "Invalid order items." }, 400);
    }

    for (const item of items) {
      if (!item.product_id || typeof item.product_id !== "string") return json({ error: "Invalid product in order." }, 400);
      if (!item.product_name || typeof item.product_name !== "string" || item.product_name.length > 300) return json({ error: "Invalid product name." }, 400);
      if (!Number.isFinite(item.quantity) || item.quantity < 1 || item.quantity > 100) return json({ error: "Invalid quantity." }, 400);
      if (!Number.isFinite(item.price) || item.price < 0 || item.price > 1000000) return json({ error: "Invalid price." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ========== FRAUD CHECKS ==========
    const { data: fraudSettings } = await supabaseAdmin
      .from("store_settings")
      .select("key, value")
      .in("key", ["blocked_phones", "blocked_ips", "fraud_duplicate_check", "fraud_cooldown_hours"]);

    const settingsMap: Record<string, string> = {};
    if (fraudSettings) {
      for (const s of fraudSettings) settingsMap[s.key] = s.value;
    }

    // Blocked phone check
    try {
      const blockedPhones: string[] = JSON.parse(settingsMap["blocked_phones"] || "[]");
      if (blockedPhones.includes(phoneClean)) {
        return json({ error: "blocked", blocked: true, reason: "phone" }, 200);
      }
    } catch {}

    // Blocked IP check
    try {
      const blockedIps: string[] = JSON.parse(settingsMap["blocked_ips"] || "[]");
      if (blockedIps.includes(clientIp)) {
        return json({ error: "blocked", blocked: true, reason: "ip" }, 200);
      }
    } catch {}

    // Duplicate check & cooldown
    const dupCheckEnabled = settingsMap["fraud_duplicate_check"] === "true";
    const cooldownHours = parseInt(settingsMap["fraud_cooldown_hours"] || "0", 10);

    if (dupCheckEnabled || cooldownHours > 0) {
      const { data: recentOrders } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, created_at, status")
        .eq("customer_phone", phoneClean)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentOrders && recentOrders.length > 0) {
        if (cooldownHours > 0) {
          const lastOrder = recentOrders[0];
          const lastOrderTime = new Date(lastOrder.created_at).getTime();
          const cooldownMs = cooldownHours * 60 * 60 * 1000;
          if (Date.now() - lastOrderTime < cooldownMs) {
            const { data: existingItems } = await supabaseAdmin
              .from("order_items")
              .select("product_name, quantity, price, size, color")
              .eq("order_id", lastOrder.id);

            return json({
              error: "duplicate_order",
              existing_order: {
                order_number: lastOrder.order_number,
                total: lastOrder.total,
                created_at: lastOrder.created_at,
                items: existingItems || [],
              },
            }, 409);
          }
        }

        if (dupCheckEnabled) {
          const pendingOrder = recentOrders.find(o => ["pending", "confirmed"].includes(o.status));
          if (pendingOrder) {
            const { data: existingItems } = await supabaseAdmin
              .from("order_items")
              .select("product_name, quantity, price, size, color")
              .eq("order_id", pendingOrder.id);

            return json({
              error: "duplicate_order",
              existing_order: {
                order_number: pendingOrder.order_number,
                total: pendingOrder.total,
                created_at: pendingOrder.created_at,
                items: existingItems || [],
              },
            }, 409);
          }
        }
      }
    }
    // ========== END FRAUD CHECKS ==========

    // Sanitize product_id: strip "-addon" suffix that client may send
    const cleanProductId = (pid: string) => pid.replace(/-addon$/, '');
    for (const item of items) {
      item.product_id = cleanProductId(item.product_id);
    }

    // Verify products — fetch addon_config + bump fields for server-side pricing
    const productIds = [...new Set(items.map((i: { product_id: string }) => i.product_id))];
    // Stock-clearance override: if clearance_active + valid clearance_price,
    // rewrite row so original_price=clearance_price, price=compare-at. Mirrors
    // src/lib/clearancePrice.ts so server pricing matches storefront.
    const applyClearance = (row: any) => {
      try {
        if (!row) return row;
        const cp = Number(row?.clearance_price ?? 0);
        const active = row?.clearance_active === true;
        if (!active || !Number.isFinite(cp) || cp <= 0) return row;
        const basePrice = Number(row.price || 0);
        const origSale = Number(row.original_price || 0);
        const compareAt = origSale > 0 && origSale < basePrice ? basePrice : Math.max(basePrice, origSale);
        if (cp >= compareAt) return row;
        return { ...row, price: compareAt, original_price: cp };
      } catch { return row; }
    };

    const { data: dbProductsRaw, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, original_price, is_active, allow_pre_order, variant_images, stock, addon_config, bump_product_id, bump_discount, images, clearance_price, clearance_active, category_id")
      .in("id", productIds);
    if (prodError || !dbProductsRaw) return json({ error: "Failed to verify products." }, 500);
    const dbProducts = dbProductsRaw.map(applyClearance);

    const priceMap = new Map(dbProducts.map((p: any) => [p.id, p]));

    // Also fetch bump products if any are referenced
    const bumpProductIds = dbProducts
      .filter((p: any) => p.bump_product_id)
      .map((p: any) => p.bump_product_id)
      .filter((id: string) => !priceMap.has(id));
    if (bumpProductIds.length > 0) {
      const { data: bumpProductsRaw } = await supabaseAdmin
        .from("products")
        .select("id, name, price, original_price, is_active, allow_pre_order, variant_images, stock, addon_config, images, clearance_price, clearance_active")
        .in("id", bumpProductIds);
      if (bumpProductsRaw) {
        bumpProductsRaw.map(applyClearance).forEach((p: any) => priceMap.set(p.id, p));
      }
    }

    for (const item of items) {
      const itemType = item.item_type || 'normal';
      const isUpsell = itemType === 'addon' || itemType === 'bump' ||
        item.product_name?.startsWith('[অ্যাড-অন]') || item.product_name?.startsWith('[বাম্প]');
      const dbProduct = priceMap.get(item.product_id);
      if (!dbProduct) return json({ error: `Product not found: ${item.product_name}` }, 400);
      if (!isUpsell) {
        if (!dbProduct.is_active) return json({ error: `Product unavailable: ${item.product_name}` }, 400);
        if ((dbProduct.stock ?? 0) <= 0 && !dbProduct.allow_pre_order) return json({ error: `Product unavailable: ${item.product_name}` }, 400);
      }
    }

    const getEffectivePrice = (
      p: { price: number; original_price?: number | null; variant_images?: any },
      size?: string | null
    ) => {
      const basePrice = (p.original_price && p.original_price < p.price)
        ? p.original_price : p.price;
      if (!size) return basePrice;
      const sd = p.variant_images?.size_data?.[size];
      if (!sd) return basePrice;
      if (sd.sale_price && sd.sale_price > 0) return sd.sale_price;
      return basePrice;
    };

    // Check if any item has stock <= 0 and pre-order is enabled → pre-order
    let isPreOrder = false;
    for (const item of items) {
      const itemType = item.item_type || 'normal';
      const isUpsell = itemType === 'addon' || itemType === 'bump' ||
        item.product_name?.startsWith('[অ্যাড-অন]') || item.product_name?.startsWith('[বাম্প]');
      if (isUpsell) continue;
      const dbProduct = priceMap.get(item.product_id);
      if (dbProduct && (dbProduct.stock ?? 0) <= 0 && dbProduct.allow_pre_order) {
        isPreOrder = true;
        break;
      }
    }

    // ========== SERVER-SIDE AUTHORITATIVE PRICING ==========
    // For addon/bump items, we compute the correct price from the DB instead of trusting client
    const getAuthoritativePrice = (item: any): number => {
      const name: string = item.product_name || '';
      const itemType = item.item_type || 'normal';
      const parentProductId = item.parent_product_id || null;

      // Determine if addon by metadata first, then fallback to prefix
      const isAddon = itemType === 'addon' || name.startsWith('[অ্যাড-অন]');
      const isBump = itemType === 'bump' || name.startsWith('[বাম্প]');

      if (isAddon) {
        // Addon price comes from parent product's addon_config.price
        // parent_product_id tells us which product's config to use
        const lookupId = parentProductId || item.product_id;
        const parentProduct = priceMap.get(lookupId);
        if (parentProduct?.addon_config) {
          const config = typeof parentProduct.addon_config === 'string'
            ? JSON.parse(parentProduct.addon_config)
            : parentProduct.addon_config;
          if (config?.price && Number.isFinite(config.price) && config.price > 0) {
            return config.price;
          }
        }
        return item.price;
      }

      if (isBump) {
        // Bump price: the item.product_id IS the bump product itself
        const bumpProduct = priceMap.get(item.product_id);
        if (bumpProduct) {
          // Find which parent product links to this bump
          let bumpDiscount = 0;
          const lookupParent = parentProductId
            ? priceMap.get(parentProductId)
            : null;
          if (lookupParent && (lookupParent as any).bump_product_id === item.product_id) {
            bumpDiscount = (lookupParent as any).bump_discount || 0;
          } else {
            for (const [, p] of priceMap) {
              if ((p as any).bump_product_id === item.product_id) {
                bumpDiscount = (p as any).bump_discount || 0;
                break;
              }
            }
          }
          const bumpBase = (bumpProduct.original_price && bumpProduct.original_price < bumpProduct.price)
            ? bumpProduct.original_price : bumpProduct.price;
          return Math.max(0, bumpBase - bumpDiscount);
        }
        return item.price;
      }

      // Normal item — use DB price
      const normalProduct = priceMap.get(item.product_id);
      return getEffectivePrice(normalProduct!, item.size);
    };

    let subtotal = items.reduce((sum: number, item: any) => {
      return sum + getAuthoritativePrice(item) * item.quantity;
    }, 0);

    // Free-delivery campaigns (e.g. "3+ items → free delivery") must be evaluated
    // server-side, or the promise shown at checkout is silently dropped from the
    // stored order and staff see a normal delivery charge in the admin panel.
    const fsItems: FsCartItem[] = items
      .filter((item: any) => {
        const itemType = item.item_type || "normal";
        const isUpsell = itemType === "addon" || itemType === "bump" ||
          item.product_name?.startsWith("[অ্যাড-অন]") || item.product_name?.startsWith("[বাম্প]");
        return !isUpsell;
      })
      .map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: getAuthoritativePrice(item),
        category_id: (priceMap.get(item.product_id) as any)?.category_id ?? null,
      }));
    const qualifiesForFreeDelivery = await evaluateFreeDelivery(supabaseAdmin, fsItems, coupon_code);

    const baseDeliveryCharge = await getDeliveryCharge(supabaseAdmin, delivery_area);
    const delivery_charge = qualifiesForFreeDelivery ? 0 : baseDeliveryCharge;
    const free_shipping = qualifiesForFreeDelivery;

    // Coupon validation
    let discount = 0;
    let appliedCouponId: string | null = null;
    if (coupon_code && typeof coupon_code === "string") {
      const { data: coupon } = await supabaseAdmin
        .from("coupons").select("*").eq("code", coupon_code.toUpperCase().trim()).eq("is_active", true).maybeSingle();

      if (coupon) {
        const now = new Date();
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at) > now;
        const notMaxed = !coupon.max_uses || coupon.used_count < coupon.max_uses;
        const meetsMin = subtotal >= coupon.min_order_amount;

        if (notExpired && notMaxed && meetsMin) {
          if (coupon.discount_type === "percentage") {
            discount = Math.round(subtotal * coupon.discount_value / 100);
          } else {
            // Flat-amount coupons must be able to discount against the whole
            // payable total (items + delivery), not just the item subtotal —
            // otherwise a ৳60 coupon on a ৳4 item order only ever discounts ৳4.
            discount = Math.min(coupon.discount_value, subtotal + delivery_charge);
          }
          appliedCouponId = coupon.id;
        }
      }
    }

    // Save gross subtotal (before discount) so reconciliation works correctly
    const total = subtotal - discount + delivery_charge;

    // Build discount note if coupon was applied
    const discountNote = (appliedCouponId && coupon_code && discount > 0)
      ? `কুপন: ${coupon_code.toUpperCase().trim()} (-৳${discount})`
      : "";

    // Sanitize email
    const cleanEmail = (customer_email && typeof customer_email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim()))
      ? customer_email.trim() : null;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders").insert({
        customer_name: customer_name.trim(),
        customer_phone: phoneClean,
        customer_address: sanitizeText(customer_address.trim()),
        city: city && typeof city === "string" ? sanitizeText(city.trim()).slice(0, 100) : "",
        delivery_area, delivery_charge, free_shipping,
        subtotal, total,
        discount_note: discountNote,
        notes: notes && typeof notes === "string" ? sanitizeText(notes.trim()).slice(0, 500) : null,
        order_origin: (['website', 'manual', 'facebook', 'google', 'whatsapp', 'tiktok', 'instagram', 'office', 'imo', 'call', 'manual+facebook', 'manual+whatsapp', 'manual+instagram', 'manual+tiktok', 'manual+google', 'manual+imo', 'manual+call'].includes(order_origin)) ? order_origin : 'website',
        ...(source_landing_page_id && typeof source_landing_page_id === "string" ? { source_landing_page_id } : {}),
        order_attribution: { ...((order_attribution && typeof order_attribution === "object") ? order_attribution : {}), client_ip: clientIp },
        ...(customerUserId ? { customer_user_id: customerUserId } : {}),
        ...(cleanEmail ? { customer_email: cleanEmail } : {}),
        is_pre_order: isPreOrder,
        ...trackingCols,
      }).select("id, order_number").single();

    if (orderError) { console.error("Order insert error:", orderError); return json({ error: "Failed to create order." }, 500); }

    const orderItems = items.map((item: any) => {
      const itemType = item.item_type || 'normal';
      const isUpsell = itemType === 'addon' || itemType === 'bump' ||
        item.product_name?.startsWith('[অ্যাড-অন]') || item.product_name?.startsWith('[বাম্প]');

      // Build upsell snapshot fields
      let upsell_parent_name: string | null = null;
      let upsell_image: string | null = null;
      if (isUpsell) {
        const parentId = item.parent_product_id || null;
        if (parentId) {
          const parentProd = priceMap.get(parentId);
          if (parentProd) upsell_parent_name = (parentProd as any).name || null;
        }
        if (itemType === 'addon') {
          const addonParent = priceMap.get(item.parent_product_id || item.product_id);
          const addonCfg = addonParent?.addon_config;
          const cfg = typeof addonCfg === 'string' ? JSON.parse(addonCfg) : addonCfg;
          upsell_image = cfg?.image || (addonParent as any)?.images?.[0] || null;
        } else if (itemType === 'bump') {
          const bumpProd = priceMap.get(item.product_id);
          upsell_image = (bumpProd as any)?.images?.[0] || null;
        }
      }

      return {
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name.slice(0, 300),
        quantity: item.quantity,
        price: getAuthoritativePrice(item),
        size: item.size && typeof item.size === "string" ? item.size.slice(0, 50) : null,
        color: item.color && typeof item.color === "string" ? item.color.slice(0, 50) : null,
        item_type: isUpsell ? itemType : 'normal',
        parent_product_id: item.parent_product_id || null,
        ...(upsell_parent_name ? { upsell_parent_name } : {}),
        ...(upsell_image ? { upsell_image } : {}),
      };
    });

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsError) { console.error("Order items insert error:", itemsError); return json({ error: "Failed to save order items." }, 500); }

    // Update coupon used_count
    if (appliedCouponId) {
      try {
        const { data: couponData } = await supabaseAdmin
          .from("coupons")
          .select("used_count")
          .eq("id", appliedCouponId)
          .maybeSingle();
        if (couponData) {
          await supabaseAdmin
            .from("coupons")
            .update({ used_count: (couponData.used_count || 0) + 1 })
            .eq("id", appliedCouponId);
        }
      } catch (e) {
        console.error("Coupon usage update error:", e);
      }
    }

    // Customer counts/spent are fully managed by DB trigger
    // `trg_sync_customer_loyalty_stats` -> `recompute_customer_stats()`.
    // Only sync profile fields here (name/address) to avoid double-counting.
    try {
      await supabaseAdmin.from("customers").update({
        name: customer_name.trim(),
        address: customer_address.trim(),
      }).eq("phone", phoneClean);
    } catch (e) { console.error("Customer profile sync error:", e); }

    // Mark abandoned checkout as recovered
    try {
      if (abandoned_checkout_id && typeof abandoned_checkout_id === "string") {
        await supabaseAdmin
          .from("abandoned_checkouts")
          .update({ status: "recovered", recovered_at: new Date().toISOString() })
          .eq("id", abandoned_checkout_id);
      } else {
        const { data: recentAbandoned } = await supabaseAdmin
          .from("abandoned_checkouts")
          .select("id")
          .eq("customer_phone", phoneClean)
          .in("status", ["abandoned", "contacted"])
          .order("created_at", { ascending: false })
          .limit(5);
        if (recentAbandoned && recentAbandoned.length > 0) {
          const ids = recentAbandoned.map((r: any) => r.id);
          await supabaseAdmin
            .from("abandoned_checkouts")
            .update({ status: "recovered", recovered_at: new Date().toISOString() })
            .in("id", ids);
        }
      }
    } catch (e) { console.error("Recovery update error:", e); }

    // Send confirmation for this newly created order. SMS is guarded inside
    // send-order-notification so it only runs for fresh order confirmations.
    try {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ order_id: order.id, type: "confirmation", send_sms: true }),
      })
        .then(r => r.text())
        .then(t => console.log("Order notification result:", t))
        .catch(e => console.error("Order notification error:", e));
    } catch (e) { console.error("Notification dispatch error:", e); }

    // Fire server-side conversions (Meta CAPI, GA4 MP, Google Ads) — non-blocking.
    try {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/track-conversion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ order_id: order.id, stage: "purchase" }),
      }).catch(e => console.error("track-conversion dispatch error:", e));
    } catch (e) { console.error("track-conversion error:", e); }

    return json({ order: { id: order.id, order_number: order.order_number }, discount });
  } catch (err) {
    console.error("Place order error:", err);
    return json({ error: "Invalid request." }, 400);
  }
});
