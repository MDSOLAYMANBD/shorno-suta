import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadGeminiKey } from "../_shared/gemini-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateGeminiText(apiKey: string, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Gemini tagline error:", res.status, body.slice(0, 800));
    throw new Error(res.status === 429 ? "Gemini রেট লিমিট/কোটা শেষ" : `Tagline generation failed: ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("").trim() || "";
}

async function generateGeminiImage(apiKey: string, prompt: string) {
  // Primary: direct Gemini image-capable models (uses user's Gemini key)
  const imageModels = [
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-image-preview",
    "gemini-2.0-flash-preview-image-generation",
  ];
  let lastStatus = 500;
  let lastError = "";

  for (const model of imageModels) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      lastStatus = res.status;
      lastError = body;
      console.error("Gemini image error:", model, res.status, body.slice(0, 600));
      if (res.status === 400 || res.status === 404) continue;
      if (res.status === 401 || res.status === 403) throw new Error("GEMINI_API_KEY অবৈধ বা image generation permission নেই");
      if (res.status === 429) throw new Error("Gemini রেট লিমিট/কোটা শেষ। কিছুক্ষণ পর চেষ্টা করুন");
      continue;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;
    if (inline?.data) {
      return { data: inline.data as string, mimeType: inline.mimeType || inline.mime_type || "image/png" };
    }
  }

  // Fallback: Imagen
  const imagenModels = ["imagen-4.0-generate-001", "imagen-3.0-generate-002"];
  for (const model of imagenModels) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "16:9", personGeneration: "allow_adult" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      lastStatus = res.status;
      lastError = body;
      console.error("Imagen error:", model, res.status, body.slice(0, 600));
      if (res.status === 401 || res.status === 403) throw new Error("GEMINI_API_KEY অবৈধ বা Imagen permission/payment নেই");
      if (res.status === 429) throw new Error("Imagen রেট লিমিট/কোটা শেষ। কিছুক্ষণ পর চেষ্টা করুন");
      continue;
    }
    const data = await res.json();
    const pred = data?.predictions?.[0] || {};
    const b64 = pred.bytesBase64Encoded || pred.image?.bytesBase64Encoded;
    if (b64) return { data: b64 as string, mimeType: pred.mimeType || pred.image?.mimeType || "image/png" };
  }
  console.error("All image providers failed:", lastStatus, lastError.slice(0, 600));
  throw new Error("ছবি তৈরিতে সমস্যা হয়েছে। প্রম্পট পরিবর্তন করে আবার চেষ্টা করুন");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const GEMINI_API_KEY = await loadGeminiKey(supabase);
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY কনফিগার করা হয়নি। অ্যাডমিন প্যানেলে AI Keys থেকে Gemini key দিন");

    const { category_id, custom_prompt, banner_type = "home", save_banner = false } = await req.json();
    if (!category_id) throw new Error("category_id required");

    const { data: category, error: catErr } = await supabase
      .from("categories")
      .select("*")
      .eq("id", category_id)
      .single();
    if (catErr || !category) throw new Error("Category not found");

    let parentName = "";
    let brandColor = "#8C6A1A"; // antique gold — primary
    let accentColor = "#6B1E2B"; // deep maroon/burgundy — secondary
    let storeName = "Shorno Suta";
    let storeNameBn = "স্বর্ণ সুতা";

    const [parentRes, brandRes, storeRes, productsRes] = await Promise.all([
      category.parent_id
        ? supabase.from("categories").select("name, name_bn").eq("id", category.parent_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("store_settings").select("value").eq("key", "theme_config").single(),
      supabase.from("store_settings").select("value").eq("key", "store_name").single(),
      supabase.from("products").select("name, name_bn, images").eq("category_id", category_id).eq("is_active", true).limit(8),
    ]);

    if (parentRes.data) parentName = parentRes.data.name_bn || parentRes.data.name;

    try {
      if (brandRes.data?.value) {
        const parsed = JSON.parse(brandRes.data.value);
        if (parsed?.primary) brandColor = parsed.primary;
        if (parsed?.secondary) accentColor = parsed.secondary;
      }
    } catch (_) { /* use default */ }

    try {
      if (storeRes.data?.value) {
        const parsed = JSON.parse(storeRes.data.value);
        if (typeof parsed === "string") storeName = parsed;
        else if (parsed?.name) storeName = parsed.name;
      }
    } catch (_) { /* use default */ }

    const products = productsRes.data || [];
    const productNames = products.map((p: any) => p.name_bn || p.name).join(", ");
    const catName = category.name_bn || category.name;

    const isShop = banner_type === "shop";
    const aspectDesc = isShop ? "ultra-wide 21:9 aspect ratio (1200x514px)" : "16:9 aspect ratio (1200x675px)";

    // Build product image URLs for multimodal input
    const productImageUrls = products
      .filter((p: any) => p.images?.length > 0)
      .slice(0, 4)
      .map((p: any) => {
        const img = p.images[0];
        return img.startsWith("http") ? img : `${SUPABASE_URL}/storage/v1/object/public/product-images/${img}`;
      });

    // ===== Step 1: Generate tagline =====
    const taglinePrompt = custom_prompt
      ? `${custom_prompt}\n\nব্র্যান্ড: ${storeNameBn} (${storeName})\nক্যাটেগরি: ${catName}${parentName ? ` (${parentName})` : ""}\nপণ্য: ${productNames || "N/A"}\n\nশুধুমাত্র একটি ছোট ট্যাগলাইন লেখো (৮-১২ শব্দ), অন্য কিছু না।`
      : `তুমি "${storeNameBn}" (${storeName}) — একটি প্রিমিয়াম বাংলাদেশি ফ্যাশন ই-কমার্স ব্র্যান্ডের মার্কেটিং এক্সপার্ট।

"${catName}" ক্যাটেগরির জন্য একটি আকর্ষণীয় বাংলা মার্কেটিং ট্যাগলাইন লেখো।
${parentName ? `মূল ক্যাটেগরি: ${parentName}` : ""}
পণ্যসমূহ: ${productNames || "বিভিন্ন পণ্য"}

নিয়ম:
- ৮-১২ শব্দের মধ্যে রাখো
- ব্র্যান্ড "${storeNameBn}" এর নাম সাবটলি ব্যবহার করা যেতে পারে
- ইমোশনাল ও পারচেজ-ড্রাইভিং টোন
- শুধুমাত্র ট্যাগলাইনটি লেখো, অন্য কিছু না`;

    const tagline = await generateGeminiText(GEMINI_API_KEY, taglinePrompt);

    // ===== Step 2: Generate banner image with multimodal product references =====
    const brandingInstructions = `
BRAND: "${storeNameBn}" (${storeName})
Primary brand color: ${brandColor} (rich antique gold)
Secondary/accent brand color: ${accentColor} (deep maroon/burgundy)

MANDATORY TYPOGRAPHY — bake these directly INTO the image as part of the graphic design (NOT as overlay text boxes):
- Category name "${catName}" in large, bold, elegant Bengali typography — positioned prominently (top-center or left side)
- Tagline "${tagline || 'আপনার ফ্যাশনে আনুন নতুনত্ব!'}" in stylish italic/handwritten Bengali calligraphy below the category name
- Brand name "স্বর্ণ সুতা" in refined, smaller text — bottom corner
- All text must feel like part of the graphic design — integrated with the background, not floating boxes
- Use gold, white, or cream colored text with subtle shadows for readability
- Text should be purchase-driving and make customers want to buy

IMAGE SPECS:
- Width: exactly 1200px, Aspect: ${aspectDesc}
- Web-optimized, crisp edges, vibrant colors`;

    const imageTextPrompt = custom_prompt
      ? `Create a premium product catalog banner (${aspectDesc}) for "${storeNameBn}" — a Bangladeshi fashion e-commerce brand.

${custom_prompt}

Category: ${catName}
${parentName ? `Parent: ${parentName}` : ""}

LAYOUT: Show 5-7 different products/models. Use elegant decorative arch frames as BACKGROUND elements only — models/products must OVERFLOW and extend BEYOND the frame borders. The full dress, prints, and designs must be completely visible and NOT clipped or cut off by the frame edges. Frames should frame the background, NOT crop the product.
Study the reference images below to understand the EXACT type, prints, patterns, and design style of products in this category.
Generate NEW original products with SIMILAR prints and aesthetics — DO NOT copy/paste the reference images.

${brandingInstructions}`
      : `Create a stunning premium product catalog banner for "${storeNameBn}" — a high-end Bangladeshi fashion e-commerce brand.

CATEGORY: "${catName}" ${parentName ? `(under ${parentName})` : ""}
PRODUCTS IN THIS CATEGORY: ${productNames || category.name}

LAYOUT & COMPOSITION:
- Show 5-7 DIFFERENT products from the "${catName}" category
- Each product displayed on a beautiful South Asian female model with an elegant decorative arch/frame as a BACKGROUND ELEMENT
- CRITICAL: Models and their clothing must OVERFLOW and EXTEND BEYOND the arch frame borders — the frame is decorative backdrop only, NOT a clipping mask
- The FULL outfit including all prints, embroidery, and design details must be completely visible — NOTHING should be cut off or hidden by the frame
- Models should appear to "pop out" of the frames — giving a 3D layered effect
- Arrange the product frames in a visually pleasing grid/catalog layout across the banner
- Each model/product should show a DIFFERENT design, print, or color variation

DESIGN & AESTHETICS:
- Background: soft, luxurious gradient blending antique gold (${brandColor}) and deep maroon/burgundy (${accentColor}) with cream and warm neutrals — an elegant, premium South Asian fashion palette. Use the maroon as a rich accent (borders, decorative panels, shadow depth) and the gold as the dominant warm tone; never use flat green or navy.
- Decorative botanical, floral, or geometric accents between the product frames
- The prints, patterns, and fabric designs on the clothing MUST match what "${catName}" category actually sells
- If reference images are provided below, study them to understand the EXACT prints, patterns, textures, and design language — then create NEW original products with SIMILAR aesthetics
- DO NOT copy/paste/collage the reference images — create completely original products inspired by the same design style
- Overall look: premium fashion catalog / lookbook spread — aspirational and purchase-driving

${brandingInstructions}

ABSOLUTE RULES:
- Must show 5-7 DISTINCT products/models — not just one
- Each product in its own elegant frame/arch (as BACKGROUND only)
- Clothing type MUST match "${catName}" exactly
- Prints and designs must be realistic and match the category's actual product style
- NO product cutout collages — this should look like a professionally designed catalog banner
- NEVER clip or crop any part of the dress, print, or model inside frames — frames are decorative ONLY
- Models must overflow frame boundaries — full outfit visibility is mandatory`;

    console.log("Calling image generation API for", banner_type, "banner, category:", catName, "with", productImageUrls.length, "product image refs");

    const imageResult = await generateGeminiImage(GEMINI_API_KEY, imageTextPrompt);
    const imageBytes = Uint8Array.from(atob(imageResult.data), (c) => c.charCodeAt(0));
    const ext = imageResult.mimeType.includes("jpeg") || imageResult.mimeType.includes("jpg") ? "jpg" : "png";
    const fileName = `${banner_type}-banner-${category_id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("category-banners")
      .upload(fileName, imageBytes, {
        contentType: imageResult.mimeType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: publicUrl } = supabase.storage
      .from("category-banners")
      .getPublicUrl(fileName);

    const bannerUrl = publicUrl.publicUrl;

    if (save_banner) {
      const updatePayload = isShop
        ? { shop_banner_url: bannerUrl, shop_banner_tagline: tagline }
        : { banner_image_url: bannerUrl, banner_tagline: tagline };

      const { error: updateErr } = await supabase
        .from("categories")
        .update(updatePayload)
        .eq("id", category_id);

      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
    }

    return new Response(
      JSON.stringify({ banner_url: bannerUrl, banner_tagline: tagline, banner_type, saved: save_banner }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("generate-category-banner error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
