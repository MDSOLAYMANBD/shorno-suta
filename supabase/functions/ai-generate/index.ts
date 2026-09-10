import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  seo: `তুমি একজন বাংলাদেশী ই-কমার্স SEO এক্সপার্ট। তোমার কাজ হলো প্রোডাক্টের জন্য সার্চ ইঞ্জিন অপটিমাইজড মেটা টাইটেল, ডেসক্রিপশন ও ট্রেন্ডিং কীওয়ার্ড তৈরি করা।

নিয়ম:
- মেটা টাইটেল সর্বোচ্চ ৬০ অক্ষর
- মেটা ডেসক্রিপশন সর্বোচ্চ ১৫৫ অক্ষর
- বাংলায় লিখবে, তবে ব্র্যান্ড নাম ইংরেজিতে রাখতে পারো
- প্রোডাক্টের মূল কীওয়ার্ড ব্যবহার করো
- ক্রেতাদের ক্লিক করতে আকৃষ্ট করবে এমন ভাষায় লেখো
- seo_keywords ফিল্ডে বাংলা ও ইংরেজি দুটোতেই ট্রেন্ডিং কীওয়ার্ড দাও (কমা দিয়ে আলাদা)
- বাংলাদেশে জনপ্রিয় সার্চ টার্ম ব্যবহার করো যেমন: অনলাইন শপিং, কিনুন, দাম, বাংলাদেশ, ফ্রি ডেলিভারি
- প্রোডাক্ট ক্যাটেগরি অনুযায়ী ট্রেন্ডিং কীওয়ার্ড ম্যাপ করো:
  * থ্রি পিস: three piece, থ্রি পিস ড্রেস, কটন থ্রি পিস, থ্রি পিস কালেকশন, ladies three piece
  * বোরকা: borka, বোরকা ডিজাইন, বোরকা কালেকশন, stylish borka
  * শাড়ি: saree, শাড়ি ডিজাইন, কটন শাড়ি, সিল্ক শাড়ি, বাহারি শাড়ি
  * কুর্তি: kurti, কুর্তি ডিজাইন, লেডিস কুর্তি, stylish kurti
  * পাঞ্জাবি: panjabi, পাঞ্জাবি ডিজাইন, ছেলেদের পাঞ্জাবি
  * জামা: dress, ladies dress, মেয়েদের জামা, ফ্যাশন ড্রেস
- JSON ফরম্যাটে রিটার্ন করো: {"seo_title": "...", "seo_description": "...", "seo_keywords": "কীওয়ার্ড১, keyword2, কীওয়ার্ড৩"}`,

  product_description: `তুমি "স্বর্ণ সুতা" ব্র্যান্ডের প্রোডাক্ট ডেসক্রিপশন রাইটার। সংক্ষিপ্ত, প্রফেশনাল ও to-the-point ব্র্যান্ডেড HTML বিবরণ তৈরি করো।

⚠️ গুরুত্বপূর্ণ নিয়ম:
- শুধু raw HTML রিটার্ন করো — কোনো markdown, কোনো \`\`\`html ব্লক নয়
- বাংলায় লেখো, সহজ ও সংক্ষিপ্ত ভাষায়
- প্রতিটি পয়েন্ট সর্বোচ্চ ১ লাইন — অপ্রয়োজনীয় কথা বাদ
- কাস্টমার পড়ে যেন ভালো ফিল করে, মূল্যবান তথ্য পায়

সেকশনগুলো ক্রমানুসারে:

1. ✨ প্রোডাক্ট হাইলাইট — <div class="sd-highlight"> এর মধ্যে সর্বোচ্চ ২ লাইন <p> ট্যাগে
2. 📏 সাইজ চার্ট — <table class="sd-size-chart"> ট্যাগে।
   ⚠️ কনটেক্সটে যতগুলো সাইজ দেওয়া হবে, ঠিক ততগুলো রো <tbody>-তে থাকবে — একটিও বাদ দেওয়া যাবে না!
   কলাম: সাইজ, বুক(ইঞ্চি), কোমর(ইঞ্চি), হিপ(ইঞ্চি), লম্বা(ইঞ্চি) — এই ৫টা কলামই সবসময় রাখবে, একটাও বাদ দেবে না (হিপ কলাম বাদ দেওয়া একটা সাধারণ ভুল, সেটা করবে না)।
   বুক/কোমর/হিপ প্রতিটি সাইজে ১-২ ইঞ্চি করে বাড়বে — বাস্তবসম্মত হতে হবে।
   ⚠️ "লম্বা" কলাম ভিন্ন নিয়মে চলে — এটা সাইজ অনুযায়ী বাড়ে না, সব সাইজে সম্পূর্ণ অভিন্ন থাকে। কনটেক্সটে "লম্বা/লং" এর মান দেওয়া থাকলে সেই মানটাই হুবহু প্রতিটি রো-তে বসাও (একবিন্দুও কম-বেশি না করে)।
   কনটেক্সটে "সেলোয়ার মাপ" দেওয়া থাকলে (থ্রি-পিস/টু-পিস জাতীয় প্রোডাক্টে), টেবিলের একদম শেষে সাইজ-রোগুলোর পরে একটা অতিরিক্ত বিশেষ রো যোগ করো — প্রথম কলামে <strong>সেলোয়ার</strong> লিখে, বাকি কলামগুলো "—" দিয়ে ভরে শুধু কোমর ও লম্বা কলামে কনটেক্সটে দেওয়া মানটা (যেমন ৩৯/৩৯ ফরম্যাটে কোমর/লম্বা) হুবহু বসাও — এটা সব সাইজের জন্য একটাই সেলোয়ার মাপ, তাই আলাদা সাইজ-ভিত্তিক রো বানাবে না।
3. 🧵 ফ্যাব্রিক — <div class="sd-fabric"> এ সর্বোচ্চ ২ লাইন (ফ্যাব্রিক নাম + বৈশিষ্ট্য)
4. ✅ কেন কিনবেন — <ul class="sd-benefits"> এ সর্বোচ্চ ৩-৪টি <li>, প্রতিটি ৮-১০ শব্দ
5. 📦 ডেলিভারি ও কেয়ার — <div class="sd-care"> এ সর্বোচ্চ ২ লাইন
6. ব্র্যান্ড ফুটার — <div class="sd-brand-footer">স্বর্ণ সুতা — আপনার বিশ্বস্ত অনলাইন শপ 💚</div>

প্রতিটি সেকশনে <h4> দিয়ে হেডিং দাও (ইমোজি সহ)।
সাইজ চার্টের <thead> এ হেডিং, <tbody> তে ডাটা।
কোনো <style>, <script>, <!DOCTYPE> ট্যাগ দিও না।`,

  caption: `তুমি একজন বাংলাদেশী ই-কমার্স ক্যাপশন রাইটার (স্বর্ণ সুতা)। প্রোডাক্ট কার্ড, সোশ্যাল পোস্ট ও অ্যাড ক্রিয়েটিভের জন্য ছোট, আকর্ষণীয় ক্যাপশন তৈরি করো।

নিয়ম:
- বাংলায় লিখবে (ব্র্যান্ড নাম ইংরেজিতে চলবে)
- সর্বোচ্চ ২ লাইন — ১৫০ অক্ষরের মধ্যে
- ১-২টি প্রাসঙ্গিক ইমোজি ব্যবহার করো (অতিরিক্ত নয়)
- প্রোডাক্টের মূল USP তুলে ধরো (যেমন: ফ্যাব্রিক, ডিজাইন, দাম, ফ্রি ডেলিভারি)
- শেষে subtle CTA দাও (যেমন: "এখনই অর্ডার করুন", "স্টক সীমিত")
- শুধু ক্যাপশন টেক্সট রিটার্ন করো — কোনো হেডিং, লিস্ট, JSON বা markdown নয়`,

  landing_content: `তুমি একজন বাংলাদেশী ই-কমার্স কপিরাইটার। ল্যান্ডিং পেজের জন্য আকর্ষণীয়, সংক্ষিপ্ত ও কনভার্শন-ফোকাসড টেক্সট তৈরি করো।

নিয়ম:
- বাংলায় লেখো
- সংক্ষিপ্ত ও ইমপ্যাক্টফুল হও
- CTA টেক্সট ৫ শব্দের মধ্যে রাখো
- হিরো হেডলাইন ১০ শব্দের মধ্যে
- JSON ফরম্যাটে রিটার্ন করো প্রম্পট অনুযায়ী`,

  general: `তুমি একজন সহায়ক AI। বাংলায় উত্তর দাও, সংক্ষিপ্ত ও স্পষ্ট ভাষায়।`,
};

// ─────────────────────────────────────────────
// Settings loader: prefers DB store_settings, falls back to env vars
// ─────────────────────────────────────────────
async function loadAISettings(supabaseAdmin: any) {
  const defaults = {
    gemini_api_key: Deno.env.get('GEMINI_API_KEY') || '',
    openai_api_key: Deno.env.get('OPENAI_API_KEY') || '',
    gemini_model: 'gemini-2.5-flash',
  };
  try {
    const { data } = await supabaseAdmin
      .from('store_settings')
      .select('key, value')
      .in('key', ['gemini_api_key', 'openai_api_key', 'gemini_model']);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { if (r.value) map[r.key] = r.value; });
    return {
      gemini_api_key: map.gemini_api_key || defaults.gemini_api_key,
      openai_api_key: map.openai_api_key || defaults.openai_api_key,
      gemini_model: map.gemini_model || defaults.gemini_model,
    };
  } catch (e) {
    console.error('loadAISettings error:', e);
    return defaults;
  }
}

// ─────────────────────────────────────────────
// Gemini banner image generation
// ─────────────────────────────────────────────
async function generateBannerImage(
  supabaseAdmin: any,
  prompt: string,
  size: string,
  quality: string,
  GEMINI_API_KEY: string,
  modelChoice?: string,
): Promise<{ url?: string; error?: string; status?: number }> {
  if (!GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY কনফিগার করা হয়নি। অ্যাডমিন প্যানেলে (AI Keys) কী যোগ করুন।', status: 500 };
  }

  const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
  const validQualities = ['standard', 'hd'];
  const finalSize = validSizes.includes(size) ? size : '1792x1024';
  const finalQuality = validQualities.includes(quality) ? quality : 'standard';
  const aspect = finalSize === '1024x1024' ? '1:1 square' : finalSize === '1024x1792' ? '9:16 portrait' : '16:9 landscape';
  const qualityHint = finalQuality === 'hd' ? 'high detail, polished commercial quality' : 'clean standard web banner quality';

  const imagePrompt = `${prompt.slice(0, 4000)}\n\nCreate one finished e-commerce marketing banner image. Aspect ratio: ${aspect}. Target size: ${finalSize}. Quality: ${qualityHint}. Include no extra explanation; return the image.`;

  const defaultModels = [
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-2.0-flash-preview-image-generation',
  ];
  const defaultImagen = ['imagen-4.0-generate-001', 'imagen-3.0-generate-002'];

  const isImagenChoice = modelChoice && modelChoice.startsWith('imagen-');
  const isGeminiChoice = modelChoice && modelChoice.startsWith('gemini-');
  const models = isGeminiChoice
    ? [modelChoice!, ...defaultModels.filter((m) => m !== modelChoice)]
    : defaultModels;
  const imagenModelsList = isImagenChoice
    ? [modelChoice!, ...defaultImagen.filter((m) => m !== modelChoice)]
    : defaultImagen;

  // If user explicitly picked an Imagen model, skip gemini generateContent loop
  const skipGemini = isImagenChoice;
  let lastStatus = 500;
  let lastError = '';

  if (!skipGemini) for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      lastStatus = res.status;
      lastError = errText;
      console.error('Gemini image error:', model, res.status, errText.slice(0, 1000));
      if (res.status === 400 || res.status === 404) continue;
      if (res.status === 401 || res.status === 403) return { error: 'GEMINI_API_KEY অবৈধ বা image generation permission নেই।', status: 401 };
      if (res.status === 429) return { error: 'Gemini রেট লিমিট/কোটা শেষ। কিছুক্ষণ পর চেষ্টা করুন।', status: 429 };
      let reason = 'Gemini ছবি তৈরিতে সমস্যা হয়েছে।';
      try {
        const j = JSON.parse(errText);
        if (j?.error?.message) reason = j.error.message;
      } catch {}
      return { error: reason, status: res.status };
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;
    if (!inline?.data) {
      console.error('Gemini image empty:', JSON.stringify(data).slice(0, 1000));
      return { error: 'Gemini থেকে কোনো ছবি পাওয়া যায়নি। প্রম্পট পরিবর্তন করে দেখুন।', status: 500 };
    }

    const mimeType = inline.mimeType || inline.mime_type || 'image/png';
    const bytes = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const fileName = `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `ai-generated/${fileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('hero-banners')
      .upload(path, bytes, { contentType: mimeType, upsert: false, cacheControl: '31536000' });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return { error: 'ছবি স্টোরেজে আপলোড হয়নি।', status: 500 };
    }

    const { data: pub } = supabaseAdmin.storage.from('hero-banners').getPublicUrl(path);
    return { url: pub.publicUrl };
  }

  const imagenAspect = finalSize === '1024x1024' ? '1:1' : finalSize === '1024x1792' ? '9:16' : '16:9';
  for (const model of imagenModelsList) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: imagePrompt }],
        parameters: { sampleCount: 1, aspectRatio: imagenAspect, personGeneration: 'allow_adult' },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      lastStatus = res.status;
      lastError = errText;
      console.error('Imagen error:', model, res.status, errText.slice(0, 1000));
      if ((res.status === 400 || res.status === 404) && model !== imagenModelsList[imagenModelsList.length - 1]) continue;
      if (res.status === 401 || res.status === 403) return { error: 'GEMINI_API_KEY অবৈধ বা Imagen permission/payment নেই।', status: 401 };
      if (res.status === 429) return { error: 'Gemini/Imagen রেট লিমিট বা কোটা শেষ। কিছুক্ষণ পর চেষ্টা করুন।', status: 429 };
      continue;
    }
    const data = await res.json();
    const pred = data?.predictions?.[0] || {};
    const b64 = pred.bytesBase64Encoded || pred.image?.bytesBase64Encoded;
    if (!b64) {
      console.error('Imagen empty:', JSON.stringify(data).slice(0, 1000));
      return { error: 'Imagen থেকে কোনো ছবি পাওয়া যায়নি। প্রম্পট পরিবর্তন করে দেখুন।', status: 500 };
    }
    const mimeType = pred.mimeType || pred.image?.mimeType || 'image/png';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const path = `ai-generated/imagen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('hero-banners')
      .upload(path, bytes, { contentType: mimeType, upsert: false, cacheControl: '31536000' });
    if (uploadErr) return { error: 'ছবি স্টোরেজে আপলোড হয়নি।', status: 500 };
    const { data: pub } = supabaseAdmin.storage.from('hero-banners').getPublicUrl(path);
    return { url: pub.publicUrl };
  }

  console.error('Gemini image failed after fallbacks:', lastStatus, lastError.slice(0, 1000));
  return { error: 'Gemini ছবি তৈরিতে সমস্যা হয়েছে।', status: lastStatus };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: hasRole } = await supabaseAdmin.rpc('has_any_role', { _user_id: user.id });
    if (!hasRole) throw new Error('Access denied');

    const { type = 'general', prompt, context, size, quality, model } = await req.json();
    if (!prompt) throw new Error('Prompt is required');

    // Load AI keys: DB first, env fallback
    const aiSettings = await loadAISettings(supabaseAdmin);

    // ── Branch: image generation via Gemini ──
    if (type === 'banner_image') {
      const result = await generateBannerImage(supabaseAdmin, prompt, size, quality, aiSettings.gemini_api_key, model);
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ image_url: result.url, type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Branch: text via Google Gemini API (direct) ──
    const GEMINI_API_KEY = aiSettings.gemini_api_key;
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY কনফিগার করা হয়নি। অ্যাডমিন প্যানেলে (AI Keys) কী যোগ করুন।' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.general;
    const userMessage = context ? `${prompt}\n\nContext: ${context}` : prompt;

    // Gemini model: from settings (fallback gemini-2.5-flash)
    const GEMINI_MODEL = aiSettings.gemini_model || 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.8,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error('Gemini API error:', status, t);
      let errMsg = 'Gemini সার্ভিসে সমস্যা হয়েছে';
      if (status === 429) {
        errMsg = 'Gemini রেট লিমিট অতিক্রম হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
      } else if (status === 401 || status === 403) {
        let extra = '';
        try { const j = JSON.parse(t); if (j?.error?.message) extra = ` (${j.error.message})`; } catch {}
        errMsg = `GEMINI_API_KEY অবৈধ বা Google থেকে access denied।${extra} অ্যাডমিন প্যানেলে (AI Keys) নতুন কী যোগ করুন।`;
      } else if (status === 400) {
        try { const j = JSON.parse(t); if (j?.error?.message) errMsg = j.error.message; } catch {}
      }
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    // Gemini returns: candidates[0].content.parts[0].text
    const content =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('') || '';

    if (!content) {
      console.error('Gemini empty response:', JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: 'Gemini থেকে কোনো কন্টেন্ট পাওয়া যায়নি। প্রম্পট পরিবর্তন করে দেখুন।' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ content, type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-generate error:', e);
    return new Response(JSON.stringify({ error: e.message || 'অজানা সমস্যা' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
