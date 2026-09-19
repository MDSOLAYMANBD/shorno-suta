// AI Landing Page Generator — Phase 1
// Generates a structured landing-page layout from selected products using
// Lovable AI Gateway, then persists it as html_blog sections on an existing
// or newly-created landing_page row. Fully additive — does not touch the
// manual builder, brand defaults, page_config, or any existing sections.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadGeminiKey, geminiChatCompletion } from "../_shared/gemini-client.ts";
import { loadOpenAIKey, openaiChatCompletion } from "../_shared/openai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROMPT_VERSION = "v4-ultra";
const DEFAULT_MODEL = "gemini-2.5-flash";

// Allowed conceptual section types — AI must pick from these
const ALLOWED_SECTION_TYPES = [
  "hero",
  "usp_strip",
  "gallery",
  "benefits",
  "social_proof",
  "reviews",
  "video",
  "comparison",
  "offer",
  "countdown",
  "scarcity",
  "faq",
  "delivery_cod",
  "trust_badges",
  "guarantee",
  "whatsapp_cta",
] as const;

type GenInput = {
  product_ids: string[];
  style_preset?: string;
  tone?: string;
  landing_page_id?: string;     // optional: regenerate into existing LP
  title?: string;               // for new LP creation
  slug?: string;                // for new LP creation
  directive?: string;           // for regenerate (more_premium, more_viral...)
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Bengali → English transliteration map (compact, covers common vowels,
// consonants, vowel signs, and digits). Used so Bengali titles produce
// clean English-only slugs.
const BN_EN: Record<string, string> = {
  'অ':'a','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou',
  'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng',
  'চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'n',
  'ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n',
  'ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n',
  'প':'p','ফ':'ph','ব':'b','ভ':'bh','ম':'m',
  'য':'y','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h',
  'ড়':'r','ঢ়':'rh','য়':'y','ৎ':'t','ং':'ng','ঃ':'h','ঁ':'n',
  'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou',
  '্':'','‍':'','‌':'',
  '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9',
};

function transliterateBn(s: string): string {
  let out = '';
  for (const ch of s) out += BN_EN[ch] !== undefined ? BN_EN[ch] : ch;
  return out;
}

function makeSlug(input: string) {
  const translit = transliterateBn(input || '');
  const base = translit
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return base || `ai-page-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSystemPrompt(opts: {
  brand: { name: string; primary: string; whatsapp?: string; helpline?: string };
  preset?: any;
  directive?: string;
  tone?: string;
}) {
  const presetAddendum = opts.preset?.system_prompt_addendum
    ? `\n\nSTYLE PRESET (${opts.preset.label}):\n${opts.preset.system_prompt_addendum}`
    : "";
  const blueprint = Array.isArray(opts.preset?.section_blueprint) && opts.preset.section_blueprint.length
    ? `\nPreferred section order (use as guidance, adapt as needed): ${opts.preset.section_blueprint.join(" → ")}`
    : "";
  const directive = opts.directive
    ? `\n\nREGENERATE DIRECTIVE: ${opts.directive} — apply this directive aggressively while keeping conversion structure.`
    : "";
  const toneNote = opts.tone ? `\nTone: ${opts.tone}` : "";

  return `You are an award-winning CRO + mobile UI/UX designer building ULTRA-PREMIUM, editorial-grade, high-converting Bangladesh ecommerce landing pages for "${opts.brand.name}" (women's fashion, COD-first, Facebook/TikTok cold traffic — 95%+ mobile users). Think Dior digital lookbook × Bangladesh COD reality. Every section must look like it was crafted by a senior art director, not auto-generated.

═══════════════════════════════════════
CRITICAL OUTPUT RULES
═══════════════════════════════════════
- Output STRICT JSON only (no markdown fences, no commentary).
- All visible copy MUST be in Bengali (বাংলা). The brand name MUST always be written as "স্বর্ণ সুতা" — NEVER "Shorno Suta", "SHADAMON", "Shadamon", or any English/romanized form. Generic English fashion terms (e.g. "abaya", "premium") are OK only when there is no natural Bengali equivalent.
- Each section's "html" is a self-contained fragment (no <html>, <head>, <body>, <script>, <iframe>, no external CSS/fonts/JS links). Renderer wraps it in a sandboxed iframe.
- Use ONLY the supplied product image URLs. Never invent image URLs or use placeholders.
- Brand palette: primary ${opts.brand.primary} (antique gold), secondary/accent ${opts.brand.secondary} (deep maroon/burgundy). Use them intentionally for accents/CTAs/borders — a premium South Asian fashion gold+maroon look — NOT as a flat background everywhere, and never substitute green or navy.

═══════════════════════════════════════
🚫 ABSOLUTELY FORBIDDEN — POLICY VIOLATIONS (NEVER WRITE)
═══════════════════════════════════════
These claims are FALSE for this brand. Writing them = customer fraud. ZERO tolerance:

1. FREE SHIPPING / FREE DELIVERY — completely forbidden in ANY form:
   - ❌ "ফ্রি ডেলিভারি", "ফ্রি শিপিং", "ডেলিভারি ফ্রি", "শিপিং ফ্রি"
   - ❌ "ডেলিভারি চার্জ ০৳", "শূন্য ডেলিভারি", "বিনামূল্যে ডেলিভারি", "ডেলিভারি একদম ফ্রি"
   - ❌ "Free Delivery", "Free Shipping", "FREE shipping", "Zero shipping cost"
   - ❌ Any icon/badge/strip claiming free shipping
   - ❌ Do NOT mention shipping/delivery charge AT ALL in copy unless input explicitly provides an exact charge value. Stay silent on the cost.

2. REFUND / MONEY-BACK — this brand does NOT refund money. Only exchange.
   - ❌ "টাকা ফেরত", "১০০% টাকা ফেরত", "মানি ব্যাক", "রিফান্ড", "ফুল রিফান্ড"
   - ❌ "Money Back", "Money-Back Guarantee", "Refund", "Full Refund", "100% Refund"
   - ❌ Any "guarantee" badge that implies money will be returned

3. ALLOWED return/exchange wording ONLY (use these exact spirits):
   - ✅ "৭ দিনের মধ্যে এক্সচেঞ্জ সুবিধা"
   - ✅ "পছন্দ না হলে সাইজ/কালার এক্সচেঞ্জ করতে পারবেন"
   - ✅ "সাইজ পরিবর্তনের সুযোগ"
   - If you create a guarantee/trust section, it must be about QUALITY ("কোয়ালিটির নিশ্চয়তা", "অরিজিনাল কাপড়ের গ্যারান্টি", "মান নিয়ে সন্তুষ্টির নিশ্চয়তা") — never about money returning.

4. DELIVERY section MUST emphasize "ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন / অগ্রিম টাকা লাগে না" and stay completely silent on shipping cost.

These rules override every other instruction including style presets and regenerate directives. Violating them is a HARD FAILURE.

═══════════════════════════════════════
ZERO-HALLUCINATION FACTS RULE
═══════════════════════════════════════
You MUST only use facts that come directly from the user message. Specifically:
- DO NOT invent customer counts, ratings, sales numbers, awards, certifications, celebrity endorsements, "as seen on" claims, or fake review quotes.
- DO NOT fabricate stats like "১০,০০০+ ক্রেতা" or "৫ স্টার রেটিং" unless input explicitly provides those numbers.
- For social_proof / reviews: write generic believable Bengali testimonial copy WITHOUT inventing names, locations, photos, or specific dates. Use anonymous initials or "একজন সন্তুষ্ট ক্রেতা".
- Helpline, WhatsApp, delivery time, return window — use ONLY supplied values. If missing, omit that copy entirely.
- Prices, discount %, stock, sizes, colors — use ONLY supplied product data.

═══════════════════════════════════════
SMART PAGE TITLE
═══════════════════════════════════════
"meta.page_title" MUST be a punchy, conversion-focused Bengali headline (≤55 chars). NOT a copy of the raw product name. Combine product type + benefit + price/offer hook.

═══════════════════════════════════════
🏛️ BRAND HEADER STRIP — REQUIRED (top of hero section)
═══════════════════════════════════════
The FIRST section (hero) MUST begin with an elegant centered brand strip BEFORE the headline — this is the first thing a visitor sees, so it must look DESIGNED, not like an afterthought line of small text:
- A pill/seal-style badge sized to actually read as a design element, not a caption: \`font-size: 15–17px\` wordmark "স্বর্ণ সুতা" in \`font-family: 'Noto Serif Bengali', 'Hind Siliguri', serif; font-weight: 700; letter-spacing: 0.05em;\`, sitting inside a bordered/tinted pill (\`border: 1px solid {primary}33; background: {primary}0d; padding: 8px 20px; border-radius: 999px;\`) with a tiny animated spark/dot beside it.
- Underneath, a micro-tagline in 11–12px uppercase muted text with letter-spacing 0.15em: "ঐতিহ্যবাহী রুচি · প্রিমিয়াম কোয়ালিটি" OR "প্রিমিয়াম ফ্যাশন · বিশ্বস্ত ব্র্যান্ড" (generic, never invents stats).
- A short ornamental divider (gradient line with a diamond/dot center, or two flanking flourish strokes) — not just a bare line.
- Entrance animation: the badge scales in from 0.9→1 with fade (0.5s ease-out), then the tagline fades up 0.15s after, then the divider draws in (width 0→100%) 0.15s after that — a staged reveal, not everything appearing at once.
This brand block establishes premium identity instantly — it should feel like a boutique's seal, not a footnote. NEVER skip it, and never shrink it down to barely-legible size.

HERO HEADLINE — must be the visual anchor of the page:
- Large, bold, high-contrast: use the full \`clamp(28px, 7.5vw, 52px)\` range from the typography spec below — do not undersize it to fit more on one line.
- Style at least one key word/phrase differently (serif italic, or brand primary color, or a subtle underline squiggle SVG) so the headline reads as art-directed copy, not a plain sentence.
- Word-by-word stagger entrance (see MANDATORY ANIMATIONS) — the headline should visibly assemble itself, not just fade in as one block.
- Pair with a supporting sub-line (16–18px, muted) directly beneath, also fading in after the headline stagger completes.

═══════════════════════════════════════
MOBILE-FIRST DESIGN — STRICTLY ENFORCED
═══════════════════════════════════════
Design for 360–414px screens FIRST. Desktop is a bonus.
1. CONTAINER: \`max-width: 100%; box-sizing: border-box; padding: 16px; margin: 0 auto;\`. Optional desktop max-width via \`@media (min-width: 768px)\`.
2. NO FIXED PIXEL DIMENSIONS for layout. Use \`%\`, \`vw\`, \`rem\`, \`clamp()\`. Hardcoded \`width: 600px\` is FORBIDDEN.
3. IMAGES: \`width: 100%; height: auto; display: block; border-radius: 12px;\`. Galleries: \`object-fit: cover; aspect-ratio: 4/5;\`.
4. TYPOGRAPHY (fluid): headings \`clamp(22px, 6vw, 38px); line-height: 1.2; letter-spacing: -0.01em;\` body \`clamp(14px, 4vw, 16px); line-height: 1.7;\`. Bengali font: \`'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif;\`. Display headings may use \`'Noto Serif Bengali', 'Hind Siliguri', serif;\` for editorial feel.
5. GRID/FLEX: Default single column mobile. Then \`@media (min-width: 640px) { grid-template-columns: repeat(2, 1fr); }\`. Flex rows: \`flex-wrap: wrap;\`.
6. SPACING: Mobile padding 20–28px. The generous \`clamp(48px, 10vw, 96px)\` section-vertical rhythm is for HERO and major visual (image-heavy) sections ONLY. Every other section type — usp_strip, trust_badges, whatsapp_cta, delivery_cod, guarantee, a single scarcity/countdown line, comparison, faq — is SHORT content and MUST use COMPACT vertical padding instead: \`clamp(20px, 5vw, 40px)\`. Default to compact; only use the generous rhythm when you can point to an actual reason (a large image, a multi-item grid that needs breathing room). A section holding one heading + one button + one line of text (like whatsapp_cta) is compact by definition — it never earns hero-level padding. Short labels/badges use tight \`line-height: 1.3–1.4\`, not the 1.7 body-copy value. Never inflate whitespace just to fill scroll length — a page of mostly short phrases must still read as information-dense on mobile, not sparse.
7. BUTTONS/CTAs: Mobile full-width (\`width: 100%; max-width: 380px;\`), min-height 52px, font-weight 700, border-radius 999px or 14px, real shadow + glow.
8. TABLES: Avoid. If needed: \`display: block; overflow-x: auto;\` wrapper.
9. SCOPE CSS: Wrap EVERY selector inside a unique random root class (e.g. \`.sd-hero-x7k2p\`). Keyframe names also scoped (\`@keyframes sd-fade-x7k2p\`). Zero global leaks.

═══════════════════════════════════════
CTA WIRING (CRITICAL)
═══════════════════════════════════════
Every primary CTA MUST be:
  <a href="#order-form" class="cta-button">টেক্সট</a>
or
  <button data-scroll-to="order-form" class="cta-button">টেক্সট</button>
No \`href="#"\`, no JS handlers, no external links. Parent intercepts and smooth-scrolls.

🚫 NO REDUNDANT COLOR-SWATCH SECTION: the order form (rendered globally, right after your sections) already lets the customer pick a color/variant. NEVER create a standalone section whose main content is just color swatches ("উপলব্ধ রং", etc.) — that duplicates the order form and wastes a screen of scroll for zero new information. If colors matter, show them briefly as a small supporting row inside the "offer" or "gallery" section alongside the price/CTA, never as their own section.

═══════════════════════════════════════
🎨 ULTRA-PREMIUM VISUAL LANGUAGE
═══════════════════════════════════════
This is the BIG upgrade. Every section must feel like a magazine spread, not a template.

PALETTE DISCIPLINE:
- Brand primary = ACCENT only (CTAs, key badges, underlines, micro-strokes). NEVER paint a whole section background with it.
- Surfaces: cream/off-white (\`#FAF7F2\`, \`#FBFAF6\`), pure white (\`#FFFFFF\`), or rich charcoal (\`#1A1A1A\`, \`#0F0F0F\`) for dramatic dark sections.
- Text: near-black (\`#181818\`), muted gray (\`#6B6B6B\`), and brand primary for accent words.
- Optional luxury gold accent: \`#C9A86A\` for ornament/divider strokes on premium themes.
- Use 1 hero section dark + light alternating rhythm — never 6 white sections in a row.
- 🚫 GREEN IS BANNED, NO EXCEPTIONS — including on the \`whatsapp_cta\` section. Do NOT reach for WhatsApp's real-world brand green (\`#25D366\` or any other green) just because a button says "WhatsApp করুন" or uses a WhatsApp icon. That button gets the exact same brand primary/accent treatment as every other CTA on the page — same gold/maroon, same shadow/glow style. Green must not appear anywhere on the page (buttons, icons, backgrounds, borders), regardless of what the element represents.

🚨 CONTRAST SAFETY — MANDATORY, NO EXCEPTIONS:
- Every piece of text must be clearly readable against whatever is directly behind it. Before writing any text+background pair, mentally check it would pass a 4.5:1 contrast ratio.
- On a dark or saturated gradient section background: text/badges on top MUST be solid white (\`#FFFFFF\`) or solid near-black, at full or near-full opacity (≥0.9). NEVER place a translucent/glassmorphism badge (\`rgba(255,255,255,0.1–0.3)\` or similar) directly on a colorful gradient fill — the badge's own low-opacity background lets the gradient bleed through behind the text and reliably makes it unreadable. If a badge sits on a gradient/photo, give the badge a SOLID background (opacity ≥ 0.9, e.g. solid white or solid \`#1A1A1A\`) so its text color is guaranteed to contrast against something fixed, not the gradient.
- Light tinted pill/badges (e.g. \`background: rgba({primary-rgb}, 0.12)\`) are only safe on a plain white/cream section background — text must be the fully-saturated dark version of that same color (e.g. bg \`rgba(107,30,43,0.12)\` + text \`#6B1E2B\`), never a lighter/washed-out shade.
- \`-webkit-background-clip: text\` gradient text is decorative only — never use it for small badge/label text where legibility matters, only for large display prices/headlines where the gradient stops are both dark enough to read against the section's own background.

REQUIRED VISUAL TOOLKIT (use AT LEAST 5 of these across the page):
✓ Glassmorphism cards: \`background: rgba(255,255,255,0.65); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 12px 40px rgba(0,0,0,0.08);\`
✓ Gradient mesh / aurora blobs: two large \`position: absolute; width: 320px; height: 320px; border-radius: 50%; filter: blur(80px); opacity: 0.35;\` orbs in primary + complementary, behind content with \`overflow: hidden\` on parent.
✓ Animated conic gradient borders on featured cards (rotating).
✓ Shimmer sweep on price/discount badges (skeleton-style diagonal gradient sliding across).
✓ Marquee strip (CSS-only \`@keyframes\` translateX -100%) for trust pills or USPs.
✓ Floating sticky bottom CTA inside a section with pulse + glow ring + arrow nudge.
✓ Number "ticker" reveal on offer prices (scaleIn + color flash).
✓ Soft grain noise overlay via inline SVG data-URI on hero (\`opacity: 0.04\`).
✓ Decorative inline SVG ornaments — geometric, floral, or minimal line dividers (fits women's fashion). Render as \`<svg>\` inline, scoped color.
✓ Asymmetric bento / editorial image grid for gallery (one big + two small, not 3 equal squares).
✓ Layered shadows: \`box-shadow: 0 24px 60px -20px rgba(0,0,0,0.25), 0 8px 20px -8px rgba(0,0,0,0.1);\`
✓ Pill badges with primary-tinted background \`rgba({primary-rgb}, 0.12)\` and brand primary text.

TYPOGRAPHY UPGRADE:
- Hero headline: \`font-size: clamp(28px, 7.5vw, 52px); font-weight: 800; line-height: 1.15; letter-spacing: -0.02em;\` — consider a key word in serif italic or brand primary color for emphasis.
- Section headings: \`clamp(22px, 5.5vw, 36px); font-weight: 700;\` with a tiny uppercase kicker label above (\`font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: {primary};\`).
- Prices: \`font-variant-numeric: tabular-nums; font-weight: 800; font-size: clamp(28px, 8vw, 44px);\` old price strikethrough muted, new price bold + primary.

═══════════════════════════════════════
🎬 MANDATORY ANIMATIONS (every section ≥ 2 motion treatments)
═══════════════════════════════════════
Wrap ALL keyframes inside \`@media (prefers-reduced-motion: no-preference) { ... }\`. Scope every keyframe name.

Required motion patterns:
- Hero headline: WORD-BY-WORD fadeInUp stagger (split with <span> per word, \`animation-delay: 0s, 0.08s, 0.16s ...\`)
- Hero image: subtle scale-from-1.05 + fadeIn over 1.2s
- Section enter: staggered fadeInUp on children (\`animation-delay\` based on \`:nth-child\`)
- Primary CTA: continuous gentle pulse (\`@keyframes\` scale 1 → 1.03 → 1, 2.4s infinite) + glow halo + \`:hover transform: translateY(-2px)\` with \`transition: all .25s ease\`
- Price/discount badges: shimmer sweep every 3s (\`background-position\` animation on a linear-gradient)
- Cards: hover lift \`transform: translateY(-4px); box-shadow expand;\` with smooth transition
- Aurora blobs: slow drift (translate + scale, 12s infinite alternate)
- Trust marquee: infinite horizontal scroll (\`@keyframes sd-marquee\`)
- Section dividers / ornaments: fadeIn + draw-in effect

═══════════════════════════════════════
CRO STRUCTURE
═══════════════════════════════════════
- Heavy COD emphasis ("ক্যাশ অন ডেলিভারি", "পণ্য হাতে পেয়ে টাকা দিন", "অগ্রিম টাকা লাগে না") — but NEVER claim free shipping.
- Urgency + scarcity — only with TRUE numbers from input.
- Trust signals — exchange (not refund), quality assurance, COD.
- Each section MUST serve a conversion purpose — no decorative filler.
- Do NOT include order form, footer, header, or marquee sections (rendered globally).
${blueprint}${presetAddendum}${directive}${toneNote}

OUTPUT JSON SHAPE:
{
  "theme": "string label e.g. luxury_abaya",
  "colors": { "primary": "#hex", "accent": "#hex", "bg": "#hex", "text": "#hex" },
  "typography": { "heading": "serif|sans|display", "body": "serif|sans" },
  "meta": {
    "page_title": "punchy Bengali landing page title (≤55 chars, NOT raw product name)",
    "title": "SEO meta title ≤60 chars Bengali",
    "description": "SEO meta description ≤155 chars Bengali"
  },
  "sections": [
    {
      "type": "one of: ${ALLOWED_SECTION_TYPES.join(", ")}",
      "label": "short Bengali label (admin-facing)",
      "html": "self-contained HTML fragment",
      "css": "scoped CSS for this section only"
    }
  ],
  "cta": { "primary_label": "Bengali button text", "whatsapp_number": "01XXXXXXXXX or null", "sticky": true },
  "conversion_hints": { "scarcity": true, "urgency": true, "cod_emphasis": true }
}

Aim for 7–10 sections. Order them for maximum conversion: hero (with brand strip) → USP strip → benefits → gallery (bento) → offer (price + colors together) → scarcity → social proof → COD/delivery → exchange/quality guarantee → FAQ. Hero ALWAYS first.`;
}

function buildUserPrompt(opts: {
  products: any[];
  brand: { name: string; primary: string; whatsapp?: string; helpline?: string };
}) {
  const productSummary = opts.products.map((p) => ({
    id: p.id,
    name: p.name_bn || p.name,
    price: p.price,
    sale_price: p.original_price && p.original_price > p.price ? p.price : null,
    base_price: p.original_price || p.price,
    discount_pct: p.original_price && p.original_price > p.price
      ? Math.round((1 - p.price / p.original_price) * 100)
      : 0,
    images: (p.images || []).slice(0, 6),
    colors: p.colors || [],
    sizes: p.sizes || [],
    description_excerpt: typeof p.description === "string"
      ? p.description.replace(/<[^>]*>/g, " ").slice(0, 600)
      : "",
    category: p.category_name || null,
    stock: p.stock ?? null,
  }));

  return `Generate a landing page for ${opts.products.length === 1 ? "this product" : "these products (single combined LP)"}:

${JSON.stringify(productSummary, null, 2)}

Brand:
- Name: ${opts.brand.name}
- Primary color: ${opts.brand.primary} (antique gold)
- Secondary/accent color: ${opts.brand.secondary} (deep maroon/burgundy)
- WhatsApp: ${opts.brand.whatsapp || "N/A"}
- Helpline: ${opts.brand.helpline || "N/A"}

First, silently classify each product (abaya / borkha / party dress / cotton dress / premium / summer / budget) and infer the best conversion theme. Then output the JSON layout.`;
}

async function callLovableAI(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const startedAt = Date.now();
  const resp = await geminiChatCompletion(opts.apiKey, {
    model: opts.model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const duration_ms = Date.now() - startedAt;

  if (resp.status === 429) {
    return { ok: false as const, status: 429, duration_ms, error: "AI rate-limited. একটু পরে আবার চেষ্টা করুন।" };
  }
  if (!resp.ok) {
    const text = await resp.text();
    console.error("Gemini AI error:", resp.status, text.slice(0, 800));
    return { ok: false as const, status: resp.status, duration_ms, error: `AI error ${resp.status}` };
  }

  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content || "";
  const tokens_in = data?.usage?.prompt_tokens || null;
  const tokens_out = data?.usage?.completion_tokens || null;

  let parsed: any;
  try {
    // Strip stray ```json fences just in case
    const cleaned = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("AI JSON parse fail:", content.slice(0, 500));
    return { ok: false as const, status: 502, duration_ms, error: "AI invalid JSON response", raw: content };
  }

  return { ok: true as const, status: 200, duration_ms, layout: parsed, tokens_in, tokens_out };
}

async function callOpenAIFallback(opts: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const startedAt = Date.now();
  const resp = await openaiChatCompletion(opts.apiKey, {
    model: "gpt-4o-mini",
    systemPrompt: opts.systemPrompt,
    userMessage: opts.userPrompt,
    temperature: 0.7,
    maxTokens: 8000,
    jsonMode: true,
  });

  const duration_ms = Date.now() - startedAt;

  if (resp.status === 429) {
    return { ok: false as const, status: 429, duration_ms, error: "OpenAI rate-limited. একটু পরে আবার চেষ্টা করুন।" };
  }
  if (!resp.ok) {
    const text = await resp.text();
    console.error("OpenAI AI error:", resp.status, text.slice(0, 800));
    return { ok: false as const, status: resp.status, duration_ms, error: `OpenAI error ${resp.status}` };
  }

  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content || "";

  let parsed: any;
  try {
    const cleaned = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("OpenAI JSON parse fail:", content.slice(0, 500));
    return { ok: false as const, status: 502, duration_ms, error: "AI invalid JSON response", raw: content };
  }

  return { ok: true as const, status: 200, duration_ms, layout: parsed, tokens_in: data?.usage?.prompt_tokens || null, tokens_out: data?.usage?.completion_tokens || null };
}

const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ফ্রি\s*(ডেলিভারি|শিপিং)|ডেলিভারি\s*ফ্রি|শিপিং\s*ফ্রি|বিনামূল্যে\s*ডেলিভারি|ডেলিভারি\s*একদম\s*ফ্রি|শূন্য\s*ডেলিভারি|ডেলিভারি\s*চার্জ\s*০/iu, label: "free-shipping-bn" },
  { pattern: /\bfree\s*(delivery|shipping)\b|\bzero\s*shipping\b/i, label: "free-shipping-en" },
  { pattern: /টাকা\s*ফেরত|১০০%\s*টাকা\s*ফেরত|মানি\s*ব্যাক|রিফান্ড|ফুল\s*রিফান্ড/iu, label: "refund-bn" },
  { pattern: /\b(money[\s-]*back|refund|full\s*refund)\b/i, label: "refund-en" },
];

function scanForbidden(text: string): string[] {
  const hits: string[] = [];
  for (const f of FORBIDDEN_PATTERNS) {
    if (f.pattern.test(text)) hits.push(f.label);
  }
  return hits;
}

function validateLayout(layout: any): { valid: boolean; errors: string[]; sections: any[] } {
  const errors: string[] = [];
  if (!layout || typeof layout !== "object") {
    return { valid: false, errors: ["Layout is not an object"], sections: [] };
  }
  const sections = Array.isArray(layout.sections) ? layout.sections : [];
  if (!sections.length) errors.push("No sections in layout");
  const cleaned = sections
    .filter((s: any) => s && typeof s === "object" && typeof s.html === "string" && s.html.length > 0)
    .map((s: any) => {
      const html = String(s.html).slice(0, 30000);
      const css = typeof s.css === "string" ? s.css.slice(0, 10000) : "";
      const hits = scanForbidden(html + " " + css);
      if (hits.length) {
        console.warn(`⚠️ FORBIDDEN PHRASE in section "${s.label || s.type}": ${hits.join(", ")}`);
      }
      return {
        type: ALLOWED_SECTION_TYPES.includes(s.type) ? s.type : "hero",
        label: typeof s.label === "string" ? s.label.slice(0, 80) : (s.type || "section"),
        html,
        css,
      };
    });
  if (!cleaned.length) errors.push("All sections invalid");
  return { valid: errors.length === 0, errors, sections: cleaned };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return jsonResponse({ error: "Admin access required" }, 403);

    // Gemini is now the fallback (OpenAI is primary) — don't hard-fail if it's unset.
    const GEMINI_API_KEY = await loadGeminiKey(supabaseAdmin);

    const body: GenInput = await req.json();
    const productIds = Array.isArray(body.product_ids) ? body.product_ids.filter(Boolean) : [];
    if (!productIds.length) return jsonResponse({ error: "At least one product is required" }, 400);
    if (productIds.length > 5) return jsonResponse({ error: "Maximum 5 products per AI generation" }, 400);

    // Load products (no select '*' on products — cost_price is GRANT-revoked)
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, name_bn, price, original_price, description, images, colors, sizes, variant_images, stock, category_id, is_active")
      .in("id", productIds);
    if (prodErr) {
      console.error("Product load err:", prodErr);
      return jsonResponse({ error: "Failed to load products" }, 500);
    }
    if (!products?.length) return jsonResponse({ error: "Products not found" }, 404);

    // Load preset
    let preset: any = null;
    if (body.style_preset) {
      const { data: presetRow } = await supabaseAdmin
        .from("ai_landing_presets")
        .select("*")
        .eq("key", body.style_preset)
        .maybeSingle();
      preset = presetRow;
    }

    // Brand defaults
    const { data: settingsRows } = await supabaseAdmin
      .from("store_settings")
      .select("key, value")
      .in("key", ["site_name", "whatsapp_number", "phone", "landing_page_defaults", "theme_config"]);
    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { if (r.value) settingsMap[r.key] = r.value; });
    let themePrimary = "#8C6A1A"; // antique gold
    let themeSecondary = "#6B1E2B"; // deep maroon/burgundy
    try {
      if (settingsMap.theme_config) {
        const t = JSON.parse(settingsMap.theme_config);
        if (t?.primary) themePrimary = t.primary;
        if (t?.secondary) themeSecondary = t.secondary;
      }
    } catch (_) { /* use defaults */ }
    const brand = {
      name: "স্বর্ণ সুতা",
      primary: preset?.default_colors?.primary || themePrimary,
      secondary: preset?.default_colors?.secondary || themeSecondary,
      whatsapp: settingsMap.whatsapp_number || "01843711211",
      helpline: settingsMap.phone || "09617356977",
    };

    // Build prompts
    const systemPrompt = buildSystemPrompt({
      brand,
      preset,
      directive: body.directive,
      tone: body.tone,
    });
    const userPrompt = buildUserPrompt({ products, brand });

    // Call AI — OpenAI first, auto-fallback to Gemini on failure
    const OPENAI_API_KEY = await loadOpenAIKey(supabaseAdmin);
    let aiResult = OPENAI_API_KEY
      ? await callOpenAIFallback({ apiKey: OPENAI_API_KEY, systemPrompt, userPrompt })
      : { ok: false as const, status: 500, duration_ms: 0, error: "OPENAI_API_KEY কনফিগার করা নেই।" };
    let usedModel = "gpt-4o-mini";

    if (!aiResult.ok) {
      console.error("OpenAI landing generation failed, falling back to Gemini:", aiResult.error);
      const openaiError = aiResult.error;
      const geminiResult = await callLovableAI({ apiKey: GEMINI_API_KEY, model: DEFAULT_MODEL, systemPrompt, userPrompt });
      if (geminiResult.ok) {
        aiResult = geminiResult;
        usedModel = DEFAULT_MODEL;
      } else {
        aiResult = { ...geminiResult, error: `${openaiError} | Gemini fallback: ${geminiResult.error}` };
      }
    }

    if (!aiResult.ok) {
      // Log failure
      await supabaseAdmin.from("ai_landing_generations").insert({
        landing_page_id: body.landing_page_id || null,
        created_by: user.id,
        product_ids: productIds,
        style_preset: body.style_preset || null,
        tone: body.tone || null,
        prompt_version: PROMPT_VERSION,
        model: usedModel,
        input_context: { products: productIds, brand, preset_key: body.style_preset, directive: body.directive },
        output_layout: {},
        duration_ms: aiResult.duration_ms,
        status: "failed",
        error: aiResult.error,
      });
      return jsonResponse({ error: aiResult.error }, aiResult.status);
    }

    const validated = validateLayout(aiResult.layout);
    if (!validated.sections.length) {
      await supabaseAdmin.from("ai_landing_generations").insert({
        landing_page_id: body.landing_page_id || null,
        created_by: user.id,
        product_ids: productIds,
        style_preset: body.style_preset || null,
        tone: body.tone || null,
        prompt_version: PROMPT_VERSION,
        model: usedModel,
        input_context: { products: productIds, brand, preset_key: body.style_preset },
        output_layout: aiResult.layout,
        tokens_in: aiResult.tokens_in,
        tokens_out: aiResult.tokens_out,
        duration_ms: aiResult.duration_ms,
        status: "failed",
        error: "Validation failed: " + validated.errors.join("; "),
      });
      return jsonResponse({ error: "AI returned no usable sections", details: validated.errors }, 502);
    }

    // Resolve target landing page
    let landingPageId = body.landing_page_id || null;
    let pageMeta: any = null;
    if (landingPageId) {
      const { data: existing } = await supabaseAdmin
        .from("landing_pages")
        .select("id, slug, title")
        .eq("id", landingPageId)
        .maybeSingle();
      if (!existing) return jsonResponse({ error: "Target landing page not found" }, 404);
      pageMeta = existing;
    } else {
      // Create new draft LP
      const productName = products[0]?.name_bn || products[0]?.name || "প্রিমিয়াম পণ্য";
      const baseTitle = body.title
        || aiResult.layout?.meta?.page_title
        || aiResult.layout?.meta?.title
        || `${productName} – এখনই অর্ডার করুন`;
      let slug = makeSlug(body.slug || baseTitle);
      // Ensure unique slug
      for (let i = 0; i < 5; i++) {
        const { data: clash } = await supabaseAdmin
          .from("landing_pages")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!clash) break;
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const { data: created, error: createErr } = await supabaseAdmin
        .from("landing_pages")
        .insert({
          title: baseTitle,
          slug,
          meta_title: aiResult.layout?.meta?.title || null,
          meta_description: aiResult.layout?.meta?.description || null,
          is_active: true, // AI pages live by default
        })
        .select("id, slug, title")
        .single();
      if (createErr || !created) {
        console.error("LP create err:", createErr);
        return jsonResponse({ error: "Failed to create landing page" }, 500);
      }
      landingPageId = created.id;
      pageMeta = created;

      // Attach products
      const lpProducts = productIds.map((pid, idx) => ({
        landing_page_id: landingPageId,
        product_id: pid,
        sort_order: idx,
      }));
      await supabaseAdmin.from("landing_page_products").insert(lpProducts);
    }

    // Persist generation row first to get id for ai_meta back-reference
    const { data: genRow, error: genErr } = await supabaseAdmin
      .from("ai_landing_generations")
      .insert({
        landing_page_id: landingPageId,
        created_by: user.id,
        product_ids: productIds,
        style_preset: body.style_preset || null,
        tone: body.tone || null,
        prompt_version: PROMPT_VERSION,
        model: usedModel,
        input_context: { products: productIds, brand, preset_key: body.style_preset, directive: body.directive },
        output_layout: aiResult.layout,
        tokens_in: aiResult.tokens_in,
        tokens_out: aiResult.tokens_out,
        duration_ms: aiResult.duration_ms,
        status: "success",
      })
      .select("id")
      .single();
    if (genErr) console.error("Gen log err:", genErr);
    const generationId = genRow?.id || null;

    // Insert each AI section as an html_blog row (existing renderer)
    // Use sort_order starting from current max + 1 to avoid clobbering existing sections.
    const { data: existingSections } = await supabaseAdmin
      .from("landing_page_sections")
      .select("sort_order")
      .eq("landing_page_id", landingPageId)
      .order("sort_order", { ascending: false })
      .limit(1);
    let nextSort = (existingSections?.[0]?.sort_order ?? -1) + 1;

    const rowsToInsert = validated.sections.map((s) => ({
      landing_page_id: landingPageId,
      section_type: "html_blog",
      sort_order: nextSort++,
      content: { html: s.html, css: s.css },
      is_active: true,
      ai_meta: {
        source: "ai",
        generation_id: generationId,
        preset: body.style_preset || null,
        ai_section_type: s.type,
        label: s.label,
        prompt_version: PROMPT_VERSION,
      },
    }));

    const { data: insertedSections, error: insertErr } = await supabaseAdmin
      .from("landing_page_sections")
      .insert(rowsToInsert)
      .select("id, sort_order, ai_meta");
    if (insertErr) {
      console.error("Sections insert err:", insertErr);
      return jsonResponse({ error: "Failed to save AI sections" }, 500);
    }

    return jsonResponse({
      landing_page_id: landingPageId,
      slug: pageMeta?.slug,
      generation_id: generationId,
      sections: insertedSections,
      layout_meta: {
        theme: aiResult.layout?.theme,
        colors: aiResult.layout?.colors,
        typography: aiResult.layout?.typography,
        section_count: insertedSections?.length || 0,
      },
      tokens: { in: aiResult.tokens_in, out: aiResult.tokens_out },
      duration_ms: aiResult.duration_ms,
    });
  } catch (e: any) {
    console.error("ai-landing-generate fatal:", e);
    return jsonResponse({ error: e?.message || "Unknown error" }, 500);
  }
});
