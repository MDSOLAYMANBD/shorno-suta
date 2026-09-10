import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadGeminiKey, geminiChatCompletion } from "../_shared/gemini-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, session_token, voice_url, mime_type } = await req.json();
    if (!session_id || !session_token || !voice_url) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify session
    const { data: sess } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", session_id)
      .eq("session_token", session_token)
      .maybeSingle();
    if (!sess) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download voice file → base64
    const audioResp = await fetch(voice_url);
    if (!audioResp.ok) throw new Error("Failed to download voice file");
    const audioBuf = await audioResp.arrayBuffer();
    const bytes = new Uint8Array(audioBuf);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as any);
    }
    const base64 = btoa(binary);

    const audioMime = mime_type || "audio/webm";

    const GEMINI_API_KEY = await loadGeminiKey(supabase);

    // Send to Gemini directly with audio input
    const aiResp = await geminiChatCompletion(GEMINI_API_KEY, {
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "তুমি একজন অভিজ্ঞ বাংলা/ইংরেজি ভয়েস transcriber। প্রদত্ত অডিও ক্লিপ থেকে কথা শুনে clean text-এ রূপান্তর করো। যত elomelo, accent, ভুল উচ্চারণ, বা আঞ্চলিক ভাষা হোক না কেন, intent বুঝে স্পষ্ট ও সঠিক বাংলায় (বা ইংরেজি হলে ইংরেজিতে) দাও। শুধু transcribed text return করো, কোনো ব্যাখ্যা না।",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "এই ভয়েস মেসেজটি transcribe করো:" },
            { type: "input_audio", input_audio: { data: base64, format: audioMime.includes("mp4") ? "mp4" : audioMime.includes("ogg") ? "ogg" : "webm" } },
          ] as any,
        },
      ],
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "একটু পরে চেষ্টা করুন" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI সার্ভিস ক্রেডিট শেষ" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("Transcribe error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Transcription failed", details: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const transcript: string = (aiData.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("voice-transcribe error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
