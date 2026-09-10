import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadGeminiKey, geminiChatCompletion } from "../_shared/gemini-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { product_id } = await req.json();
    if (!product_id) throw new Error('product_id required');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', product_id)
      .single();

    if (pErr || !product) throw new Error('Product not found');

    const categoryName = product.categories?.name || '';
    const productName = product.name || '';
    const description = product.description || '';

    const prompt = `You are a Google Merchant Center and Facebook Catalog compliance expert for women's fashion e-commerce in Bangladesh.

Generate an optimized English feed title and description for this product:

Product Name: ${productName}
Category: ${categoryName}
Short Description: ${description}

STRICT RULES:
1. Title must be under 150 characters, English only
2. Description must be under 500 characters, English only
3. Format title as: "Women's [Fabric if known] [Product Type] - [Key Feature] | Shorno Suta"
4. NEVER use these words: alcoholic, alcohol, beverage, wine, beer, liquor, drug, tobacco, weapon, adult content
5. NEVER use emojis, promotional text like "best", "cheapest", "free", "sale", "discount", "offer"
6. NEVER use ALL CAPS or excessive punctuation
7. Focus on: product type, fabric, style, occasion, fit
8. For description: mention fabric quality, comfort, suitable occasions, available in Bangladesh
9. Product category is women's apparel/clothing - make this very clear

Return ONLY valid JSON:
{"feed_title": "...", "feed_description": "..."}`;

    const GEMINI_API_KEY = await loadGeminiKey(supabase);
    let aiResponse: Response | null = null;
    let lastRateLimitDetails = '';

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      aiResponse = await geminiChatCompletion(GEMINI_API_KEY, {
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      });

      if (aiResponse.status === 429) {
        lastRateLimitDetails = await aiResponse.text();
        const retryAfterHeader = aiResponse.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Math.min(30000, (attempt + 1) * 5000);

        console.warn(`AI gateway rate limited for product ${product_id} (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${waitMs}ms before retry.`);

        if (attempt < MAX_RETRIES - 1) {
          await sleep(waitMs);
          continue;
        }

        return new Response(JSON.stringify({
          error: 'AI rate limit reached. কিছুক্ষণ পর আবার চেষ্টা করুন।',
          code: 'RATE_LIMITED',
          details: lastRateLimitDetails,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (aiResponse.status === 402) {
        const errText = await aiResponse.text();
        return new Response(JSON.stringify({
          error: 'AI credit শেষ। Lovable workspace-এ credit যোগ করুন।',
          code: 'PAYMENT_REQUIRED',
          details: errText,
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      break;
    }

    if (!aiResponse || !aiResponse.ok) {
      const errText = aiResponse ? await aiResponse.text() : 'No response';
      return new Response(JSON.stringify({
        error: 'AI সার্ভিসে সমস্যা হয়েছে',
        code: 'AI_API_ERROR',
        details: errText,
      }), {
        status: aiResponse?.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let parsed: { feed_title?: string; feed_description?: string } = {};
    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const titleMatch = content.match(/"feed_title"\s*:\s*"([^"]+)"/);
      const descMatch = content.match(/"feed_description"\s*:\s*"([^"]+)"/);
      if (titleMatch) parsed.feed_title = titleMatch[1];
      if (descMatch) parsed.feed_description = descMatch[1];
    }

    if (!parsed.feed_title && !parsed.feed_description) {
      throw new Error('AI failed to generate feed data');
    }

    const banned = ['alcoholic', 'alcohol', 'beverage', 'wine', 'beer', 'liquor', 'vodka', 'whiskey'];
    let title = parsed.feed_title || '';
    let desc = parsed.feed_description || '';
    for (const word of banned) {
      title = title.replace(new RegExp(word, 'gi'), '');
      desc = desc.replace(new RegExp(word, 'gi'), '');
    }
    title = title.replace(/\s+/g, ' ').trim();
    desc = desc.replace(/\s+/g, ' ').trim();

    const { error: updateErr } = await supabase
      .from('products')
      .update({ feed_title: title, feed_description: desc })
      .eq('id', product_id);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return new Response(JSON.stringify({ success: true, feed_title: title, feed_description: desc }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});