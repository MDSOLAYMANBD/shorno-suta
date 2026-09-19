// Shared OpenAI client — used as the automatic fallback when Gemini fails
// (rate limit, revoked/invalid key, access denied, etc).

export async function loadOpenAIKey(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .maybeSingle();
    if (data?.value) return data.value;
  } catch (_e) {
    // fall through to env var
  }
  return Deno.env.get('OPENAI_API_KEY') || '';
}

export async function openaiChatCompletion(apiKey: string, opts: {
  model?: string;
  systemPrompt?: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<Response> {
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push({ role: 'user', content: opts.userMessage });

  const body: Record<string, unknown> = {
    model: opts.model || 'gpt-4o-mini',
    messages,
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

const OPENAI_IMAGE_SIZES = ['1024x1024', '1792x1024', '1024x1792'];

export async function openaiGenerateImage(apiKey: string, opts: {
  prompt: string;
  size?: string;
}): Promise<Response> {
  const size = OPENAI_IMAGE_SIZES.includes(opts.size || '') ? opts.size : '1024x1024';
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: opts.prompt.slice(0, 4000),
      n: 1,
      size,
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });
}
