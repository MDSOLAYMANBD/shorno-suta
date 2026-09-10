// Shared Gemini client — uses user's Gemini API key (stored in store_settings)
// instead of the Lovable AI Gateway. Provides an OpenAI-style chat completion
// shim so existing call sites need minimal changes.

export async function loadGeminiKey(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "gemini_api_key")
      .maybeSingle();
    const dbKey = typeof data?.value === "string" ? data.value.trim() : "";
    return dbKey || Deno.env.get("GEMINI_API_KEY") || "";
  } catch {
    return Deno.env.get("GEMINI_API_KEY") || "";
  }
}

// Map OpenAI-style "google/gemini-X" or vendor-less id → bare Gemini model id
function mapModel(model: string): string {
  let m = (model || "gemini-2.5-flash").replace(/^google\//, "");
  // Lovable gateway uses "-preview" variants; map a few to public Gemini ids
  if (m === "gemini-3-flash-preview") m = "gemini-2.5-flash";
  return m;
}

async function fetchAsInlineData(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    const mimeType = r.headers.get("content-type") || "image/jpeg";
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
    }
    return { mimeType, data: btoa(binary) };
  } catch (e) {
    console.error("fetchAsInlineData error:", e);
    return null;
  }
}

// OpenAI-compatible chat completion that calls Gemini directly.
// Returns a Response that mirrors OpenAI's `/v1/chat/completions` shape.
export async function geminiChatCompletion(apiKey: string, body: any): Promise<Response> {
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: "GEMINI_API_KEY কনফিগার করা হয়নি। অ্যাডমিন প্যানেলে (AI Keys) Gemini key দিন।" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const model = mapModel(body.model);
  const messages = body.messages || [];

  let systemInstruction: any = undefined;
  const contents: any[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      const text = typeof m.content === "string"
        ? m.content
        : (m.content || []).map((p: any) => p.text || "").join("\n");
      systemInstruction = { parts: [{ text }] };
      continue;
    }
    const role = m.role === "assistant" ? "model" : "user";
    const parts: any[] = [];
    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === "text") parts.push({ text: p.text });
        else if (p.type === "image_url") {
          const url = typeof p.image_url === "string" ? p.image_url : p.image_url?.url;
          if (typeof url === "string" && url.startsWith("data:")) {
            const [meta, data] = url.split(",");
            const mimeType = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
            parts.push({ inlineData: { mimeType, data } });
          } else if (url) {
            const inline = await fetchAsInlineData(url);
            if (inline) parts.push({ inlineData: inline });
          }
        } else if (p.type === "input_audio") {
          const fmt = p.input_audio?.format || "webm";
          const mimeType = fmt === "mp4" ? "audio/mp4" : fmt === "ogg" ? "audio/ogg" : `audio/${fmt}`;
          if (p.input_audio?.data) {
            parts.push({ inlineData: { mimeType, data: p.input_audio.data } });
          }
        }
      }
    }
    if (parts.length) contents.push({ role, parts });
  }

  const reqBody: any = { contents };
  if (systemInstruction) reqBody.systemInstruction = systemInstruction;
  const genConfig: any = {};
  if (body.response_format?.type === "json_object") {
    genConfig.responseMimeType = "application/json";
  }
  if (Array.isArray(body.modalities) && body.modalities.includes("image")) {
    genConfig.responseModalities = ["TEXT", "IMAGE"];
  }
  if (typeof body.temperature === "number") genConfig.temperature = body.temperature;
  if (typeof body.max_tokens === "number") genConfig.maxOutputTokens = body.max_tokens;
  if (Object.keys(genConfig).length) reqBody.generationConfig = genConfig;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Gemini error ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.error?.message) errMsg = j.error.message;
    } catch {}
    return new Response(
      JSON.stringify({ error: { message: errMsg, status: res.status, raw: text.slice(0, 600) } }),
      { status: res.status, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await res.json();
  const candidates = data?.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  let textOut = "";
  const images: any[] = [];
  for (const p of parts) {
    if (typeof p.text === "string") textOut += p.text;
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) {
      images.push({
        image_url: { url: `data:${inline.mimeType || inline.mime_type || "image/png"};base64,${inline.data}` },
      });
    }
  }

  const openAI = {
    id: `gemini-${Date.now()}`,
    object: "chat.completion",
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textOut,
        ...(images.length ? { images } : {}),
      },
      finish_reason: "stop",
    }],
    usage: data?.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount || 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata.totalTokenCount || 0,
    } : undefined,
  };

  return new Response(JSON.stringify(openAI), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
