// Inbox AI Assist — suggestions + summary, cached per latest message.
// Body: { conversation_id: string, kind: "suggestions" | "summary" }
// Returns: { payload: ..., cached: boolean, last_message_id: string | null }

import { createClient } from "npm:@supabase/supabase-js@2";
import { loadGeminiKey, geminiChatCompletion } from "../_shared/gemini-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { conversation_id?: string; kind?: string };
  try { body = await req.json(); } catch { return j({ error: "bad_json" }, 400); }
  const { conversation_id, kind } = body;
  if (!conversation_id || !kind || !["suggestions", "summary"].includes(kind)) {
    return j({ error: "conversation_id and valid kind required" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Latest message
  const { data: latest } = await sb.from("inbox_messages")
    .select("id").eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const lastMessageId: string | null = latest?.id ?? null;

  // Cache hit?
  const { data: cached } = await sb.from("inbox_ai_cache")
    .select("payload, last_message_id")
    .eq("conversation_id", conversation_id).eq("kind", kind).maybeSingle();
  if (cached && cached.last_message_id === lastMessageId) {
    return j({ payload: cached.payload, cached: true, last_message_id: lastMessageId });
  }

  // Fetch last 12 messages for context
  const { data: msgs } = await sb.from("inbox_messages")
    .select("sender_type, sender_name, message, created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false }).limit(12);
  const transcript = (msgs ?? []).reverse().map((m: any) =>
    `${m.sender_type}: ${m.message ?? ""}`).join("\n");

  const sys = kind === "suggestions"
    ? `You are a helpful Bangla/English customer-support assistant for Shorno Suta (women's fashion). Suggest 3 short reply options (max 18 words each) the agent can send next. Match the customer's language. Return ONLY a JSON array of 3 strings.`
    : `You summarize a chat in 2-3 short Bangla sentences for a busy agent. Cover: customer intent, key questions, current state. Return plain text only.`;

  const GEMINI_API_KEY = await loadGeminiKey(sb);
  const aiRes = await geminiChatCompletion(GEMINI_API_KEY, {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `Conversation:\n${transcript}` },
    ],
  });
  if (aiRes.status === 429) return j({ error: "rate_limited" }, 429);
  if (aiRes.status === 402) return j({ error: "credits_exhausted" }, 402);
  if (!aiRes.ok) return j({ error: "ai_failed", detail: await aiRes.text() }, 500);
  const aiJson = await aiRes.json();
  const raw = aiJson.choices?.[0]?.message?.content ?? "";

  let payload: unknown = raw;
  if (kind === "suggestions") {
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) payload = parsed.slice(0, 3).map(String);
    } catch { payload = [raw]; }
  }

  await sb.from("inbox_ai_cache").upsert({
    conversation_id, kind, payload, last_message_id: lastMessageId,
  }, { onConflict: "conversation_id,kind" });

  return j({ payload, cached: false, last_message_id: lastMessageId });
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
