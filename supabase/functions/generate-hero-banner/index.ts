import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadGeminiKey, geminiChatCompletion } from "../_shared/gemini-client.ts";
import { loadOpenAIKey, openaiChatCompletion, openaiGenerateImage } from "../_shared/openai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const GEMINI_API_KEY = await loadGeminiKey(supabase);
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY কনফিগার করা হয়নি। অ্যাডমিন প্যানেলে (AI Keys) Gemini key দিন");

    const { custom_prompt, category_id, resolution, quality } = await req.json();

    // Resolution mapping (21:9 wide)
    const resMap: Record<string, { w: number; h: number }> = {
      standard: { w: 1200, h: 514 },
      hd: { w: 1600, h: 686 },
      "4k": { w: 2400, h: 1029 },
    };
    const res = resMap[resolution || "standard"] || resMap.standard;
    const imgQuality = Math.min(95, Math.max(50, quality || 85));

    // Fetch store info and best-selling products in parallel
    let brandColor = "#8C6A1A"; // antique gold — primary
    let accentColor = "#6B1E2B"; // deep maroon/burgundy — secondary
    let storeName = "Shorno Suta";
    let storeNameBn = "স্বর্ণ সুতা";

    const [brandRes, storeRes, bestSellingRes] = await Promise.all([
      supabase.from("store_settings").select("value").eq("key", "theme_config").single(),
      supabase.from("store_settings").select("value").eq("key", "store_name").single(),
      supabase.rpc("get_best_selling_product_ids", { p_limit: 6 }),
    ]);

    try {
      if (brandRes.data?.value) {
        const parsed = JSON.parse(brandRes.data.value);
        if (parsed?.primary) brandColor = parsed.primary;
        if (parsed?.secondary) accentColor = parsed.secondary;
      }
    } catch (_) {}

    try {
      if (storeRes.data?.value) {
        const parsed = JSON.parse(storeRes.data.value);
        if (typeof parsed === "string") storeName = parsed;
        else if (parsed?.name) storeName = parsed.name;
      }
    } catch (_) {}

    // Fetch product images — category-specific or best-selling
    let productImageUrls: string[] = [];
    let selectedCategoryName = "";

    if (category_id && category_id !== "all") {
      const { data: catData } = await supabase
        .from("categories")
        .select("name, name_bn")
        .eq("id", category_id)
        .single();
      if (catData) selectedCategoryName = catData.name_bn || catData.name;

      const { data: catProducts } = await supabase
        .from("products")
        .select("name, name_bn, images")
        .eq("category_id", category_id)
        .eq("is_active", true)
        .limit(6);

      productImageUrls = (catProducts || [])
        .filter((p: any) => p.images?.length > 0)
        .slice(0, 4)
        .map((p: any) => {
          const img = p.images[0];
          return img.startsWith("http") ? img : `${SUPABASE_URL}/storage/v1/object/public/product-images/${img}`;
        });
    } else {
      const bestProductIds = (bestSellingRes.data || []).map((r: any) => r.product_id);
      if (bestProductIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("name, name_bn, images")
          .in("id", bestProductIds)
          .eq("is_active", true)
          .limit(6);

        productImageUrls = (products || [])
          .filter((p: any) => p.images?.length > 0)
          .slice(0, 4)
          .map((p: any) => {
            const img = p.images[0];
            return img.startsWith("http") ? img : `${SUPABASE_URL}/storage/v1/object/public/product-images/${img}`;
          });
      }
    }

    // Categories context
    let catNames = selectedCategoryName;
    if (!catNames) {
      const { data: categories } = await supabase
        .from("categories")
        .select("name_bn, name")
        .is("parent_id", null)
        .limit(6);
      catNames = (categories || []).map((c: any) => c.name_bn || c.name).join(", ");
    }

    // ===== Step 1: Generate tagline =====
    const taglinePrompt = custom_prompt
      ? `${custom_prompt}\n\nব্র্যান্ড: ${storeNameBn} (${storeName})\nক্যাটেগরি: ${catNames}\n\nশুধুমাত্র একটি ছোট ট্যাগলাইন লেখো (৮-১২ শব্দ), অন্য কিছু না।`
      : `তুমি "${storeNameBn}" (${storeName}) — একটি প্রিমিয়াম বাংলাদেশি ফ্যাশন ই-কমার্স ব্র্যান্ডের মার্কেটিং এক্সপার্ট।

হোমপেজের হিরো ব্যানারের জন্য একটি আকর্ষণীয় বাংলা মার্কেটিং ট্যাগলাইন লেখো।
ক্যাটেগরি: ${catNames}

নিয়ম:
- ৮-১২ শব্দের মধ্যে রাখো
- ব্র্যান্ড "${storeNameBn}" এর নাম সাবটলি ব্যবহার করা যেতে পারে
- ইমোশনাল ও পারচেজ-ড্রাইভিং টোন
- শুধুমাত্র ট্যাগলাইনটি লেখো, অন্য কিছু না`;

    let tagline = "";
    const taglineRes = await geminiChatCompletion(GEMINI_API_KEY, {
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: taglinePrompt }],
    });

    if (taglineRes.ok) {
      const taglineData = await taglineRes.json();
      tagline = taglineData.choices?.[0]?.message?.content?.trim() || "";
    } else {
      console.error("Gemini tagline failed, falling back to OpenAI:", taglineRes.status);
      const OPENAI_API_KEY = await loadOpenAIKey(supabase);
      if (!OPENAI_API_KEY) throw new Error(`Tagline generation failed: ${taglineRes.status} (OpenAI fallback not configured)`);
      const openaiTaglineRes = await openaiChatCompletion(OPENAI_API_KEY, {
        userMessage: taglinePrompt,
        model: "gpt-4o-mini",
      });
      if (!openaiTaglineRes.ok) throw new Error(`Tagline generation failed on both Gemini (${taglineRes.status}) and OpenAI (${openaiTaglineRes.status})`);
      const openaiTaglineData = await openaiTaglineRes.json();
      tagline = openaiTaglineData.choices?.[0]?.message?.content?.trim() || "";
    }

    // ===== Step 2: Generate banner image =====
    const imagePrompt = custom_prompt
      ? `Create a premium wide panoramic hero banner (21:9 aspect ratio, ${res.w}x${res.h}px) for "${storeNameBn}" — a Bangladeshi fashion e-commerce brand.

${custom_prompt}

LAYOUT: Show 5-7 different products/models in an elegant catalog layout spread across the wide panoramic frame. Use soft round/oval spotlight glows with a delicate gold floral border as BACKGROUND elements only (NO architectural shapes — no arches, windows, doorways, or building/haveli silhouettes) — models/products must OVERFLOW and extend BEYOND the panel borders.
Study the reference images below to understand the product style.

BRAND: "${storeNameBn}" (${storeName})
Primary brand color: ${brandColor} (rich antique gold)
Secondary/accent brand color: ${accentColor} (deep maroon/burgundy)

TYPOGRAPHY — bake INTO the image:
- Brand name "স্বর্ণ সুতা" prominently displayed
- Tagline "${tagline || 'আপনার ফ্যাশনে আনুন নতুনত্ব!'}" in stylish Bengali calligraphy
- Use gold, white, or cream colored text with subtle shadows
- Text must feel part of the graphic design

IMAGE SPECS: Width ${res.w}px, Height ${res.h}px (21:9 ultra-wide), web-optimized, vibrant colors, quality ${imgQuality}%. Cinematic wide composition — spread elements horizontally.`
      : `Create a stunning premium ultra-wide panoramic hero banner for "${storeNameBn}" — a high-end Bangladeshi fashion e-commerce brand.

CATEGORIES: ${catNames}

LAYOUT & COMPOSITION:
- Show 5-7 DIFFERENT best-selling products from various categories
- Each product on a beautiful South Asian female model with a soft round/oval spotlight glow (delicate gold floral border, NO architectural arch/window/doorway/building shape) as BACKGROUND ELEMENT
- Models and clothing must OVERFLOW and EXTEND BEYOND the spotlight panel borders — panels are decorative backdrop only
- Full outfit including prints, embroidery, and details must be completely visible
- Models should "pop out" of the panels — 3D layered effect
- Arrange in a visually pleasing catalog layout SPREAD HORIZONTALLY across the ultra-wide banner

DESIGN & AESTHETICS:
- Background: soft, luxurious gradient blending antique gold (${brandColor}) and deep maroon/burgundy (${accentColor}) with cream and warm neutrals — an elegant, premium South Asian fashion palette. Use the maroon as a rich accent (borders, decorative panels, shadow depth) and the gold as the dominant warm tone; never use flat green or navy.
- Decorative botanical, floral, or geometric accents between product panels — NEVER a repeating arch, window, or house/haveli-like silhouette anywhere in the composition
- Overall look: premium fashion catalog / lookbook spread — aspirational and purchase-driving

BRAND: "${storeNameBn}" (${storeName})
Primary brand color: ${brandColor} (rich antique gold)
Secondary/accent brand color: ${accentColor} (deep maroon/burgundy)

TYPOGRAPHY — bake INTO the image:
- Brand name "স্বর্ণ সুতা" in large, elegant Bengali typography — prominently positioned
- Tagline "${tagline || 'আপনার ফ্যাশনে আনুন নতুনত্ব!'}" in stylish italic/handwritten Bengali calligraphy
- Use gold, white, or cream colored text with subtle shadows for readability
- All text must feel like part of the graphic design

IMAGE SPECS: Width ${res.w}px, Height ${res.h}px (21:9 ultra-wide), web-optimized, crisp edges, vibrant colors, quality ${imgQuality}%. Cinematic wide composition.

RULES:
- Must show 5-7 DISTINCT products/models spread across the wide frame
- Clothing MUST be realistic Bangladeshi fashion
- NO product cutout collages — professionally designed catalog banner
- NEVER clip or crop any part of the dress inside panels
- NEVER draw a repeating arch, window, doorway, or house/haveli-shaped frame anywhere — use only soft round/oval spotlight glows`;

    // Build multimodal content (text + reference product images)
    const contentParts: any[] = [{ type: "text", text: imagePrompt }];

    if (productImageUrls.length > 0) {
      contentParts.push({ type: "text", text: "\n\n--- REFERENCE PRODUCT IMAGES (Study for style. Create NEW original products.) ---" });
      for (const url of productImageUrls) {
        contentParts.push({ type: "image_url", image_url: { url } });
      }
    }

    console.log("Generating hero banner with", productImageUrls.length, "product refs");

    const imageModels = [
      "gemini-3.1-flash-image-preview",
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-image-preview",
      "gemini-2.0-flash-preview-image-generation",
    ];
    let imageRes: Response | null = null;
    let lastImgStatus = 500;
    for (const m of imageModels) {
      imageRes = await geminiChatCompletion(GEMINI_API_KEY, {
        model: m,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      });
      if (imageRes.ok) break;
      lastImgStatus = imageRes.status;
      if (imageRes.status === 401 || imageRes.status === 403 || imageRes.status === 429) break;
    }
    let imageBytes: Uint8Array | undefined;

    if (imageRes && imageRes.ok) {
      const imageText = await imageRes.text();
      if (!imageText || imageText.trim() === "") throw new Error("Image generation returned empty response");

      let imageData: any;
      try {
        imageData = JSON.parse(imageText);
      } catch {
        throw new Error("Image generation returned invalid JSON");
      }

      const message = imageData.choices?.[0]?.message;
      let base64Url: string | undefined;

      if (message?.images?.length > 0) {
        base64Url = message.images[0]?.image_url?.url;
      }
      if (!base64Url && Array.isArray(message?.content)) {
        const imgPart = message.content.find((p: any) => p.type === "image_url" || p.type === "image");
        if (imgPart) base64Url = imgPart.image_url?.url || imgPart.url;
      }
      if (!base64Url && message?.parts) {
        const imgPart = message.parts.find((p: any) => p.inline_data);
        if (imgPart?.inline_data) {
          base64Url = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
        }
      }

      if (base64Url) {
        const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
        imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } else {
        console.error("Full image response:", JSON.stringify(imageData).substring(0, 2000));
      }
    }

    // Gemini image generation failed (all models) or returned no image — fall back to OpenAI DALL-E
    if (!imageBytes) {
      console.error("Gemini image generation failed, falling back to OpenAI DALL-E. Last status:", lastImgStatus);
      const OPENAI_API_KEY = await loadOpenAIKey(supabase);
      if (!OPENAI_API_KEY) {
        if (lastImgStatus === 429) throw new Error("Gemini রেট লিমিট/কোটা শেষ। OpenAI fallback কনফিগার করা নেই।");
        if (lastImgStatus === 401 || lastImgStatus === 403) throw new Error("GEMINI_API_KEY অবৈধ বা image generation permission নেই। OpenAI fallback কনফিগার করা নেই।");
        throw new Error("Image generation failed on Gemini and no OpenAI fallback is configured.");
      }
      const openaiImageRes = await openaiGenerateImage(OPENAI_API_KEY, { prompt: imagePrompt, size: "1792x1024" });
      if (!openaiImageRes.ok) {
        const errText = await openaiImageRes.text();
        console.error("OpenAI image fallback failed:", openaiImageRes.status, errText.slice(0, 1000));
        throw new Error(`Image generation failed on both Gemini (${lastImgStatus}) and OpenAI (${openaiImageRes.status})`);
      }
      const openaiImageData = await openaiImageRes.json();
      const b64 = openaiImageData?.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI fallback returned no image");
      imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    }

    // Upload to storage
    const fileName = `hero-banner-${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("hero-banners")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: publicUrl } = supabase.storage
      .from("hero-banners")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ banner_url: publicUrl.publicUrl, tagline }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("generate-hero-banner error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
