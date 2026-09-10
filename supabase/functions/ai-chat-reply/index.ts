import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadGeminiKey, geminiChatCompletion } from "../_shared/gemini-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Per-instance cache for slow-changing knowledge (FAQs, settings, categories).
// Products are fetched fresh on every product-intent request so price / stock / sale data is always live.
let kbCache: { data: any; ts: number } | null = null;
const KB_TTL = 60 * 1000; // 1 min — short so updates show up quickly

// Per-session rate limiter (20/min)
const sessionRate = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(sessionId: string) {
  const now = Date.now();
  const e = sessionRate.get(sessionId);
  if (!e || now > e.resetAt) {
    sessionRate.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  e.count++;
  return e.count > 20;
}

async function loadStaticKnowledge(supabase: any) {
  if (kbCache && Date.now() - kbCache.ts < KB_TTL) return kbCache.data;

  const [categoriesRes, faqsRes, settingsRes] = await Promise.all([
    supabase.from("categories").select("id, name, name_bn, slug").limit(50),
    supabase
      .from("ai_knowledge_base")
      .select("question, answer, category, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false }),
    supabase
      .from("store_settings")
      .select("key, value")
      .in("key", [
        "ai_chat_system_prompt", "ai_chat_model", "site_name",
        "delivery_charge_inside_dhaka", "delivery_charge_dhaka_suburb", "delivery_charge_outside_dhaka",
        "shipping_dhaka_inside", "shipping_dhaka_suburb", "shipping_dhaka_outside",
        "office_address", "office_hours", "showroom_pickup_enabled",
        "live_agent_start_hour", "live_agent_end_hour"
      ]),
  ]);

  const settings: Record<string, string> = {};
  (settingsRes.data || []).forEach((s: any) => { settings[s.key] = s.value; });
  // Prefer authoritative `shipping_*` keys (edited from Shipping Charges Settings).
  // Fall back to legacy `delivery_charge_*_dhaka` if the new key is missing.
  settings.delivery_charge_inside_dhaka = settings.shipping_dhaka_inside || settings.delivery_charge_inside_dhaka;
  settings.delivery_charge_dhaka_suburb = settings.shipping_dhaka_suburb || settings.delivery_charge_dhaka_suburb;
  settings.delivery_charge_outside_dhaka = settings.shipping_dhaka_outside || settings.delivery_charge_outside_dhaka;

  const data = {
    categories: categoriesRes.data || [],
    faqs: faqsRes.data || [],
    settings,
  };
  kbCache = { data, ts: Date.now() };
  return data;
}

// Fetch fresh products every time AI needs to recommend (no cache — price/stock/sale must be current).
// IMPORTANT: NEVER select cost_price (column-level GRANT-revoked + business secret).
async function fetchProducts(supabase: any, opts: { categoryId?: string | null; orderBy?: "newest" | "featured"; limit?: number; excludeIds?: string[] } = {}) {
  const limit = opts.limit ?? 60;
  let q = supabase
    .from("products")
    .select("id, slug, name, name_bn, price, original_price, stock, images, is_featured, description, description_bn, colors, sizes, category_id, created_at, allow_pre_order, categories(name, name_bn, slug)")
    .eq("is_active", true)
    .eq("is_hidden_from_shop", false)
    .or("stock.gt.0,allow_pre_order.eq.true")
    .limit(limit);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.orderBy === "featured") q = q.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  if (opts.excludeIds && opts.excludeIds.length) q = q.not("id", "in", `(${opts.excludeIds.map((i) => `"${i}"`).join(",")})`);
  const { data } = await q;
  return data || [];
}

// ---------- Honorific (gender heuristic) ----------
function detectHonorific(name: string | null | undefined): string {
  if (!name) return "আপনি";
  const n = name.trim().toLowerCase();
  const femaleHints = ["khatun", "begum", "akter", "akhter", "khanam", "nasrin", "sultana", "parvin", "jahan", "rahima", "fatema", "ayesha", "aisha", "rabeya", "salma", "nazma", "shirin", "shilpa", "tania", "lipi", "rina", "mimi", "tasnim", "tasnia", "nusrat", "rumana", "rumi", "rupa", "shapna", "moni", "rita", "happy", "munni", "anu", "anika", "afroza", "hafsa", "labonno", "lamia", "rifa", "marjia", "habiba", "soniya", "sonia", "sumaiya", "nadia", "shorna", "শারমিন", "খাতুন", "বেগম", "আক্তার", "আয়েশা", "ফাতেমা", "নাসরিন", "সুলতানা", "জাহান", "নুসরাত", "তাসনিয়া", "মীম", "মিম", "রুমা", "রুমানা"];
  const maleHints = ["khan", "miah", "mia", "uddin", "ullah", "ahmed", "ahmad", "rahman", "karim", "alam", "hossain", "hasan", "hossan", "rakib", "rakibul", "tarek", "tareq", "rasel", "russel", "shahin", "shahid", "saiful", "saif", "rifat", "imran", "ashik", "asif", "abir", "antor", "anik", "alamgir", "rajib", "raju", "mahbub", "mostafa", "babu", "rony", "ronnie", "sumon", "shamim", "shimul", "nadim", "subhan", "siam", "sajid", "sakib", "shakib", "tanvir", "tushar", "জামাল", "কামাল", "করিম", "রহিম", "হাসান", "হোসেন", "মিয়া", "উদ্দিন", "আলম", "শাহিন", "রকিব", "রাসেল", "ইমরান", "আবির", "আলমগীর", "সুমন", "শামীম", "সাকিব", "তানভীর", "সুবহান"];
  for (const h of femaleHints) if (n.includes(h)) return "ম্যাম";
  for (const h of maleHints) if (n.includes(h)) return "স্যার";
  return "আপনি";
}

// ---------- Intent detection ----------
// "salam" = Islamic greeting REQUIRES "ওয়ালাইকুম আসসালাম" reply.
// "casual_greeting" = "hi/hello/hey" — must NOT trigger walaikum-assalam.
type Intent = "order" | "product_new" | "product_best" | "product_more" | "product" | "address" | "delivery" | "escalate" | "general" | "salam" | "casual_greeting";

function detectIntent(message: string): Intent {
  const m = message.toLowerCase().trim();
  if (/^(\s)*(আসসালাম|আস্সালাম|আসসালামু|assalam|asslam|as-?salam|salam(?!an))/i.test(m)) return "salam";
  if (/^(\s)*(hi|hello|hey|hellow|halo|হ্যালো|হাই|hii+|heyy+|yo)\b/i.test(m)) return "casual_greeting";
  if (/অর্ডার|order|track|ট্র্যাক|কোথায়|where.*order|delivery status|sd-\d+/.test(m)) return "order";
  if (/অফিস|শোরুম|office|showroom|ঠিকানা|address|আসতে|সরাসরি|পিকআপ|pickup|location|কোথায়\s*আছে|kothai/.test(m)) return "address";
  if (/ডেলিভারি|delivery|চার্জ|charge|শিপিং|shipping|কুরিয়ার|courier|কয়\s*দিন|কয়দিন|কত\s*দিন|how\s*long|কবে|when.*deliver/.test(m)) return "delivery";
  if (/রিফান্ড|refund|ফেরত|exchange|এক্সচেঞ্জ|অভিযোগ|complain|complaint|customize|কাস্টমাইজ|negotiate|দরদাম|কম\s*রাখ|discount\s*chai/.test(m)) return "escalate";
  if (/(আরও|aro|aaro|more|নতুন আরও|আরো|aar(o|ro))/.test(m) && /(প্রোডাক্ট|product|দেখান|dekhao|dekhte|show|dress|ড্রেস|item)/.test(m)) return "product_more";
  if (/(নতুন|notun|new|latest|সর্বশেষ).{0,15}(প্রোডাক্ট|product|কালেকশন|collection|item|পণ্য|dekhao|show|দেখান|dress|ড্রেস)/.test(m)) return "product_new";
  if (/(best|top|popular|জনপ্রিয়|সবচেয়ে.*বিক্রি|বেস্ট|টপ|valo cole|ভালো চলে).{0,20}(product|প্রোডাক্ট|item|পণ্য|sell|seller|rated|dekhao|show|দেখান|dress|ড্রেস)/.test(m)) return "product_best";
  if (/best|popular|জনপ্রিয়|বেস্ট/.test(m) && /(product|প্রোডাক্ট|dress|ড্রেস)/.test(m)) return "product_best";
  if (/দাম|price|stock|স্টক|আছে|কত|কাপড়|fabric|কালার|color|সাইজ|size|দেখান|dekhao|dekhte|show|catalog|থ্রি.?পিস|three.?piece|শাড়ি|saree|বোরকা|borkha|burka|পার্টি|party|ড্রেস|dress|টপ|popular|জনপ্রিয়|best.?sell|comfortable|aram|আরাম|cotton|সুতি|silk|সিল্ক|premium|প্রিমিয়াম|gown|গাউন/.test(m)) return "product";
  return "general";
}

function detectCategoryFromMessage(message: string, categories: any[]): any | null {
  const m = message.toLowerCase();
  for (const c of categories) {
    const en = (c.name || "").toLowerCase();
    const bn = (c.name_bn || "").toLowerCase();
    if (en && m.includes(en)) return c;
    if (bn && m.includes(bn)) return c;
  }
  const kw: Record<string, string[]> = {
    "three-piece": ["থ্রি পিস", "থ্রি-পিস", "threepiece", "three piece", "3 piece"],
    "saree": ["শাড়ি", "saree", "sari"],
    "borkha": ["বোরকা", "burka", "borkha", "burkha", "abaya"],
    "party-dress": ["পার্টি", "party dress", "gown"],
    "two-piece": ["টু পিস", "two piece"],
    "one-piece": ["one piece", "ওয়ান পিস"],
  };
  for (const [slug, words] of Object.entries(kw)) {
    if (words.some((w) => m.includes(w))) {
      const c = categories.find((c) => c.slug === slug);
      if (c) return c;
    }
  }
  return null;
}

function searchProducts(query: string, products: any[], limit = 6) {
  if (!query) return [];
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  const scored = products.map((p) => {
    const hay = `${p.name || ""} ${p.name_bn || ""} ${p.description || ""} ${p.categories?.name || ""}`.toLowerCase();
    let score = 0;
    if (hay.includes(q)) score += 10;
    tokens.forEach((t) => { if (hay.includes(t)) score += 2; });
    return { p, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.p);
}

function pickProductImage(p: any): string | null {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
  return null;
}

// Compute pricing the same way the storefront does.
// Convention: when original_price < price, original_price is the SALE price, price is the regular/strike-through.
function computePricing(p: any) {
  const price = Number(p.price) || 0;
  const orig = Number(p.original_price) || 0;
  const isSale = orig > 0 && orig < price;
  const sale_price = isSale ? orig : null;
  const regular_price = isSale ? price : price;
  const display_price = isSale ? orig : price;
  const discount_percent = isSale ? Math.round(((price - orig) / price) * 100) : 0;
  return { display_price, regular_price, sale_price, is_sale: isSale, discount_percent };
}

function buildKnowledgeText(kb: any) {
  const parts: string[] = [];

  if (kb.faqs.length) {
    parts.push("=== FAQ / নলেজ বেস ===");
    kb.faqs.slice(0, 30).forEach((f: any) => {
      parts.push(`Q: ${f.question}\nA: ${f.answer}`);
    });
  }

  if (kb.categories.length) {
    parts.push("\n=== ক্যাটেগরি (live) ===");
    parts.push(kb.categories.map((c: any) => c.name).join(", "));
  }

  parts.push("\n=== ডেলিভারি চার্জ (live, store_settings) ===");
  if (kb.settings.delivery_charge_inside_dhaka) parts.push(`- ঢাকার ভেতরে: ৳${kb.settings.delivery_charge_inside_dhaka}`);
  if (kb.settings.delivery_charge_dhaka_suburb) parts.push(`- ঢাকার আশেপাশে (সাব-ডিস্ট্রিক্ট): ৳${kb.settings.delivery_charge_dhaka_suburb}`);
  if (kb.settings.delivery_charge_outside_dhaka) parts.push(`- ঢাকার বাইরে: ৳${kb.settings.delivery_charge_outside_dhaka}`);
  parts.push("- সাধারণত ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ৩-৫ দিনে ডেলিভারি");
  parts.push("- ক্যাশ অন ডেলিভারি সুবিধা আছে");

  if (kb.settings.office_address) {
    parts.push("\n=== অফিস তথ্য (live) ===");
    parts.push(`📍 ঠিকানা: ${kb.settings.office_address}`);
    if (kb.settings.office_hours) parts.push(`🕙 সময়: ${kb.settings.office_hours}`);
    if (kb.settings.showroom_pickup_enabled === "true") {
      parts.push("- কাস্টমার চাইলে অফিস থেকে সরাসরি প্রোডাক্ট নিতে পারবেন (পিকআপ চালু)");
    }
  }

  return parts.join("\n");
}

async function lookupOrderInline(supabase: any, message: string, visitorPhone: string | null) {
  const orderMatch = message.match(/SD-?\d{4,}/i);
  const orderNum = orderMatch ? orderMatch[0].toUpperCase().replace(/^SD-?/, "SD-") : null;
  const phoneMatch = message.match(/01[3-9]\d{8}/);
  const phone = phoneMatch ? phoneMatch[0] : visitorPhone;
  if (!orderNum && !phone) return null;
  let q = supabase.from("orders").select("order_number, status, total, customer_name, created_at, customer_phone").is("deleted_at", null).order("created_at", { ascending: false }).limit(3);
  if (orderNum) q = q.eq("order_number", orderNum);
  else if (phone) q = q.eq("customer_phone", phone);
  const { data } = await q;
  return data || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, session_token, visitor_message, history = [], visitor_phone } = await req.json();

    if (!session_id || !session_token || !visitor_message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isRateLimited(session_id)) {
      return new Response(JSON.stringify({ error: "একটু পরে চেষ্টা করুন" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: sess } = await supabase
      .from("chat_sessions")
      .select("id, session_token, visitor_phone, visitor_name")
      .eq("id", session_id)
      .eq("session_token", session_token)
      .maybeSingle();
    if (!sess) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: aiEnabledRow } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "ai_chat_enabled")
      .maybeSingle();
    if (aiEnabledRow?.value === "false") {
      return new Response(JSON.stringify({ skipped: true, reason: "ai_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intent = detectIntent(visitor_message);
    const kb = await loadStaticKnowledge(supabase);

    let toolResult = "";
    let suggestedProducts: any[] = [];
    let categoryLabel: string | null = null;
    let orderCard: any = null;
    let addressCard: any = null;

    // Track which products we've already shown in this session so "আরও দেখান" returns NEW ones
    const previouslyShownIds: string[] = [];
    try {
      const { data: priorMsgs } = await supabase
        .from("chat_messages")
        .select("metadata")
        .eq("session_id", session_id)
        .eq("sender_type", "ai")
        .order("created_at", { ascending: false })
        .limit(8);
      (priorMsgs || []).forEach((m: any) => {
        const arr = m?.metadata?.suggested_products;
        if (Array.isArray(arr)) arr.forEach((p: any) => { if (p?.id) previouslyShownIds.push(p.id); });
      });
    } catch { /* ignore */ }

    if (intent === "order") {
      const orders = await lookupOrderInline(supabase, visitor_message, sess.visitor_phone || visitor_phone);
      if (orders && orders.length) {
        orderCard = orders[0];
        toolResult = `\n=== অর্ডার তথ্য ===\nঅর্ডার নম্বর: ${orders[0].order_number}\nস্ট্যাটাস: ${orders[0].status}\nমোট: ৳${orders[0].total}\nতারিখ: ${new Date(orders[0].created_at).toLocaleDateString("bn-BD")}`;
      } else {
        toolResult = "\n=== অর্ডার লুকআপ ===\nকোনো অর্ডার পাওয়া যায়নি। ভিজিটরকে অর্ডার নম্বর (SD-XXXXXX) বা ফোন নম্বর জিজ্ঞেস করুন।";
      }
    } else if (intent === "product_new" || intent === "product_more" || intent === "product_best" || intent === "product") {
      const cat = detectCategoryFromMessage(visitor_message, kb.categories);
      const exclude = intent === "product_more" ? previouslyShownIds : [];

      if (cat) {
        suggestedProducts = await fetchProducts(supabase, { categoryId: cat.id, orderBy: "newest", limit: 6, excludeIds: exclude });
        categoryLabel = cat.name_bn || cat.name;
      } else if (intent === "product_new") {
        suggestedProducts = await fetchProducts(supabase, { orderBy: "newest", limit: 6, excludeIds: exclude });
        categoryLabel = "নতুন প্রোডাক্ট";
      } else if (intent === "product_best") {
        // Best: featured + in-stock first, then recent. (We could also call get_best_selling_product_ids RPC.)
        try {
          const { data: best } = await supabase.rpc("get_best_selling_product_ids", { p_limit: 24 });
          const ids = (best || []).map((b: any) => b.product_id).filter((id: string) => !exclude.includes(id));
          if (ids.length) {
            const { data: prods } = await supabase
              .from("products")
              .select("id, slug, name, name_bn, price, original_price, stock, images, is_featured, description, description_bn, colors, sizes, category_id, created_at, allow_pre_order, categories(name, name_bn, slug)")
              .in("id", ids.slice(0, 12))
              .eq("is_active", true)
              .eq("is_hidden_from_shop", false)
              .or("stock.gt.0,allow_pre_order.eq.true");
            // Preserve best-seller ordering
            const order = new Map(ids.map((id: string, i: number) => [id, i]));
            suggestedProducts = (prods || []).sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, 6);
          }
        } catch { /* ignore */ }
        if (!suggestedProducts.length) {
          suggestedProducts = await fetchProducts(supabase, { orderBy: "featured", limit: 6, excludeIds: exclude });
        }
        categoryLabel = "জনপ্রিয় / বেস্ট সেলিং";
      } else {
        // Generic product query — keyword search on a wider live pool, fallback to newest
        const pool = await fetchProducts(supabase, { orderBy: "newest", limit: 80, excludeIds: exclude });
        suggestedProducts = searchProducts(visitor_message, pool, 6);
        if (suggestedProducts.length === 0) {
          suggestedProducts = pool.slice(0, 6);
          categoryLabel = "আমাদের কালেকশন";
        }
      }
    } else if (intent === "address") {
      addressCard = {
        address: kb.settings.office_address || "",
        hours: kb.settings.office_hours || "",
        pickup: kb.settings.showroom_pickup_enabled === "true",
      };
    }

    const knowledgeText = buildKnowledgeText(kb);
    const dbPrompt = kb.settings.ai_chat_system_prompt || "";
    const model = kb.settings.ai_chat_model || "google/gemini-3-flash-preview";

    const honorific = detectHonorific(sess.visitor_name);

    // Greeting state — only TRUE salam triggers walaikum-assalam.
    const aiHasRepliedBefore = (history || []).some((h: any) => h.role === "assistant");
    const visitorSentSalam = intent === "salam";
    const visitorCasualGreeting = intent === "casual_greeting";

    const dhakaHourStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).formatToParts(new Date()).find((p) => p.type === "hour")?.value;
    const dhakaHour = parseInt(dhakaHourStr || "0", 10);
    const startH = parseInt(kb.settings.live_agent_start_hour || "10", 10);
    const endH = parseInt(kb.settings.live_agent_end_hour || "21", 10);
    const agentOnline = dhakaHour >= startH && dhakaHour < endH;

    const agentRule = agentOnline
      ? `=== এজেন্ট স্ট্যাটাস ===\nএখন (${dhakaHour}:00 BD) লাইভ এজেন্ট অনলাইন। জটিল প্রশ্নে বলবে: "${honorific}, এই বিষয়ে আমাদের লাইভ এজেন্টের সাথে কথা বললে ভালো হবে। উপরের 📞 লাইভ কল বাটনে চাপ দিন।"`
      : `=== এজেন্ট স্ট্যাটাস ===\nএখন (${dhakaHour}:00 BD) লাইভ এজেন্ট অফলাইন (এজেন্ট সকাল ${startH}টা-রাত ${endH - 12}টা পর্যন্ত)। জটিল প্রশ্নে বলবে: "${honorific}, এজেন্ট এখন অফলাইন (সকাল ${startH}টা-রাত ${endH - 12}টা পর্যন্ত পাবেন)। আমি AI সাহায্য করতে পারব, তবে চাইলে কল চেষ্টা করতে পারেন।"`;

    const greetingRule = `=== Greeting রুল (CRITICAL — কখনো লঙ্ঘন করবে না) ===\n` +
      (visitorSentSalam
        ? `কাস্টমার ইসলামিক "সালাম" দিয়েছে। শুধু এই reply-তে একবার "ওয়ালাইকুম আসসালাম" দিয়ে শুরু করো, তারপর সংক্ষেপে কীভাবে সাহায্য করতে পারো জিজ্ঞেস করো।`
        : visitorCasualGreeting
          ? `কাস্টমার শুধু "hi/hello/hey" বলেছে — এটা সালাম নয়। কখনো "ওয়ালাইকুম আসসালাম" বা "আসসালামু আলাইকুম" বলবে না। বরং বন্ধুসুলভভাবে বলবে: "${honorific}, স্বর্ণ সুতায় স্বাগতম! আমি কীভাবে সাহায্য করতে পারি?" এর মতো।`
          : aiHasRepliedBefore
            ? `এই কথোপকথনে তুমি আগে reply দিয়েছ। এই reply-তে আর "আসসালামু আলাইকুম", "ওয়ালাইকুম আসসালাম", "স্বর্ণ সুতায় স্বাগতম", "ধন্যবাদ" — এসব greeting আবার লিখবে না। সরাসরি কাজের কথা বলো।`
            : `এটি প্রথম reply, কাস্টমার সালাম দেয়নি। সালাম/ওয়ালাইকুম দেবে না; "${honorific}" সম্বোধনে সরাসরি সাহায্য করো।`);

    let intentRule = "";
    if ((intent === "product" || intent === "product_new" || intent === "product_best" || intent === "product_more") && suggestedProducts.length > 0) {
      const introHint =
        intent === "product_new" ? `যেমন: "${honorific}, আমাদের নতুন কালেকশন থেকে কিছু দেখুন:"` :
        intent === "product_best" ? `যেমন: "${honorific}, এগুলো এখন সবচেয়ে জনপ্রিয়:"` :
        intent === "product_more" ? `যেমন: "${honorific}, আরও কিছু সাজেশন:"` :
        `যেমন: "${honorific}, এই কয়েকটি দেখুন:"`;
      // Compact product summary so AI can answer follow-up text questions (fabric/comfort/colors)
      // without hallucinating, but the visible card UI still owns the price/photo display.
      const summaries = suggestedProducts.slice(0, 6).map((p: any) => {
        const desc = (p.description_bn || p.description || "").toString().replace(/\s+/g, " ").slice(0, 120);
        const colors = Array.isArray(p.colors) && p.colors.length ? `কালার: ${p.colors.slice(0, 6).join(", ")}` : "";
        const sizes = Array.isArray(p.sizes) && p.sizes.length ? `সাইজ: ${p.sizes.slice(0, 8).join(", ")}` : "";
        const stockTag = (p.stock ?? 0) > 0 ? `স্টকে আছে` : (p.allow_pre_order ? `প্রি-অর্ডার` : `স্টক নেই`);
        return `- ${p.name_bn || p.name} (${p.categories?.name || "—"}) · ${stockTag}${colors ? " · " + colors : ""}${sizes ? " · " + sizes : ""}${desc ? " · " + desc : ""}`;
      }).join("\n");
      intentRule = `\n=== প্রোডাক্ট রিকমেন্ডেশন রুল ===\n${categoryLabel ? `ক্যাটেগরি: ${categoryLabel}` : ""}\nUI স্বয়ংক্রিয়ভাবে নিচে product card দেখাবে (image, sale price, regular price, ডিসকাউন্ট সব সঠিকভাবে)। তুমি শুধু এক লাইন intro লিখবে, ${introHint}। দাম, sale price, প্রোডাক্টের নাম reply টেক্সটে কখনো লিখবে না — UI দেখাবে।\n\nএই প্রোডাক্টগুলো দেখানো হচ্ছে (কাস্টমার যদি ফেব্রিক/আরাম/কালার/সাইজ নিয়ে question করে, এখান থেকে confident reply করো — কখনো বানাবে না):\n${summaries}`;
    } else if (intent === "address") {
      intentRule = `\n=== অ্যাড্রেস রুল ===\nUI address card দেখাবে। তুমি শুধু এক/দুই লাইন বলবে যেমন: "${honorific}, আমাদের অফিসের ঠিকানা ও সময় নিচে দেওয়া হলো। সরাসরি এসে প্রোডাক্ট নিতে পারবেন।"`;
    } else if (intent === "delivery") {
      intentRule = `\n=== ডেলিভারি রুল ===\nউপরের "ডেলিভারি চার্জ" থেকে exact amount বলবে (ঢাকার ভেতরে ${kb.settings.delivery_charge_inside_dhaka || "?"}, ঢাকার আশেপাশে ${kb.settings.delivery_charge_dhaka_suburb || "?"}, ঢাকার বাইরে ${kb.settings.delivery_charge_outside_dhaka || "?"} টাকা)। কখনো অন্য কোনো amount বলবে না।`;
    } else if (intent === "escalate") {
      intentRule = `\n=== Escalation রুল ===\nএই প্রশ্নটি জটিল (রিফান্ড/অভিযোগ/কাস্টমাইজেশন/দরদাম)। সরাসরি বলবে: "${honorific}, এই বিষয়ে আমাদের লাইভ এজেন্টের সাথে কথা বললে দ্রুত সমাধান হবে। উপরের 📞 লাইভ কল বাটনে চাপ দিন অথবা একটু অপেক্ষা করুন, এজেন্ট রিপ্লাই দেবেন ইনশাআল্লাহ।"`;
    }

    // Strong base instructions enforced server-side regardless of stored prompt
    const baseInstructions = `তুমি "স্বর্ণ সুতা" এর একজন বুদ্ধিমান, বন্ধুসুলভ, পেশাদার বাঙালি কাস্টমার সাপোর্ট প্রতিনিধি। স্বর্ণ সুতা একটি ফ্যাশন ই-কমার্স ব্র্যান্ড।\n\nনিয়ম:\n- সবসময় বাংলায় উত্তর দাও, সংক্ষিপ্ত (২-৪ লাইন), পরিষ্কার ও মানুষের মতো স্বাভাবিক।\n- কাস্টমারকে কখনো "ভাইয়া/আপু/ভাই/বোন" বলবে না। নাম দেখে gender বুঝে পুরুষকে "স্যার", মহিলাকে "ম্যাম" বলবে; অস্পষ্ট হলে শুধু "আপনি"।\n- "hello/hi/hey" সালাম নয় — কখনো "ওয়ালাইকুম আসসালাম" বলবে না (Greeting রুল CRITICAL)।\n- প্রতিটি reply-তে greeting বা সালাম পুনরাবৃত্তি করবে না।\n- দাম, sale price, ডেলিভারি চার্জ, ঠিকানা, সময়, স্টক, বা প্রোডাক্টের তথ্য কখনো নিজে বানাবে না — শুধু provided context থেকেই দেবে।\n- প্রোডাক্টের ফেব্রিক/আরাম/কালার/সাইজ জিজ্ঞেস করলে context-এর summary থেকে confident reply দাও।\n- কনটেক্সটে না পেলে বলবে: "এই বিষয়ে নিশ্চিত তথ্য আমার কাছে নেই, লাইভ এজেন্টের সাথে কথা বললে ভালো হবে।"`;

    const messages = [
      {
        role: "system",
        content: `${baseInstructions}\n\n${dbPrompt ? `=== Custom Prompt ===\n${dbPrompt}\n` : ""}\n=== প্রজেক্ট কনটেক্সট (live) ===\n${knowledgeText}\n${toolResult}\n\n=== কাস্টমার তথ্য ===\nনাম: ${sess.visitor_name || "অজানা"}\nসম্বোধন: ${honorific}\n\n${greetingRule}\n${agentRule}\n${intentRule}`,
      },
      ...history.slice(-8).map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: visitor_message },
    ];

    const GEMINI_API_KEY = await loadGeminiKey(supabase);

    // Retry on 503 (model overloaded) with backoff, then fallback to a lighter model.
    const tryModels = [model, "gemini-2.5-flash", "gemini-2.5-flash-lite"];
    let aiResp: Response | null = null;
    outer: for (const m of tryModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        aiResp = await geminiChatCompletion(GEMINI_API_KEY, { model: m, messages });
        if (aiResp.ok) break outer;
        if (aiResp.status === 429 || aiResp.status === 402) break outer;
        if (aiResp.status === 503) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        break; // other errors → try next model
      }
    }

    if (!aiResp || aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "একটু পরে চেষ্টা করুন (rate limit)" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI সার্ভিস ক্রেডিট শেষ" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI এখন ব্যস্ত, একটু পরে আবার চেষ্টা করুন।" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const aiData = await aiResp.json();
    let replyText: string = aiData.choices?.[0]?.message?.content || "দুঃখিত, এখন উত্তর দিতে পারছি না।";

    // Defensive: if model still emits a duplicate Wa-alaikum/assalam greeting after the first reply, strip it.
    const visitorJustGreeted = visitorSentSalam || visitorCasualGreeting;
    if (aiHasRepliedBefore && !visitorJustGreeted) {
      replyText = replyText
        .replace(/^(\s*)?(ওয়ালাইকুম\s*আসসালাম[!,।.\s]*|আসসালামু\s*আলাইকুম[!,।.\s]*|আস্সালামু\s*আলাইকুম[!,।.\s]*)/i, "")
        .replace(/^(স্বর্ণ সুতায় (পুনরায়\s*)?স্বাগতম[!,।.\s]*)/i, "")
        .trim();
      if (!replyText) replyText = `${honorific}, কীভাবে সাহায্য করতে পারি?`;
    }

    // Build quick replies based on intent
    const quickReplies: string[] = [];
    if (intent === "order" && !orderCard) quickReplies.push("আমার ফোন নম্বর দিতে চাই");
    if (intent === "product" || intent === "product_new" || intent === "product_more") {
      quickReplies.push("আরও প্রোডাক্ট দেখান", "অর্ডার করতে চাই");
    }
    if (intent === "product_best") {
      quickReplies.push("নতুন প্রোডাক্ট দেখান", "অর্ডার করতে চাই");
    }
    if (intent === "address") quickReplies.push("ফোনে কথা বলুন");
    quickReplies.push("📞 লাইভ কল");

    const metadata = {
      intent,
      category_label: categoryLabel,
      suggested_products: suggestedProducts.map((p) => {
        const pricing = computePricing(p);
        return {
          id: p.id,
          name: p.name_bn || p.name,
          slug: p.slug,
          image: pickProductImage(p),
          category_slug: p.categories?.slug || null,
          // Pricing — UI must use these fields
          price: pricing.display_price,             // primary price to display
          regular_price: pricing.regular_price,     // strike-through when sale
          sale_price: pricing.sale_price,           // when on sale
          original_price: p.original_price,         // raw value (legacy)
          is_sale: pricing.is_sale,
          discount_percent: pricing.discount_percent,
        };
      }),
      category_link: categoryLabel && suggestedProducts[0]?.categories?.slug
        ? `/shop?category=${suggestedProducts[0].categories.slug}`
        : null,
      order_card: orderCard,
      address_card: addressCard,
      quick_replies: quickReplies,
    };

    const { error: insertErr } = await supabase.rpc("insert_ai_chat_message", {
      p_session_id: session_id,
      p_session_token: session_token,
      p_message: replyText,
      p_metadata: metadata,
    });
    if (insertErr) console.error("Insert AI msg failed:", insertErr);

    return new Response(JSON.stringify({ reply: replyText, metadata }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ai-chat-reply error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
