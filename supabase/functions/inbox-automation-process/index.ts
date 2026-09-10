// Inbox Automation Engine — v2 (strict matchers + SLA state machine + idempotent)
// Invoked from the frontend after every new visitor/customer message OR staff reply.
// Body: { conversation_id: string, message_id: string }
//
// Behaviour summary (v2 hardening):
//   - Order detection requires BOTH a number AND an intent keyword.
//   - "Price-only" queries trigger keyword auto-reply but NEVER create a draft order.
//   - At most one PENDING detected order per conversation: existing rows are UPDATED.
//   - Lead score uses a recency-weighted window over the last 5 visitor messages.
//   - SLA timer is a state machine: starts on awaiting visitor msg, RESETS on staff reply.
//   - Idempotent: replaying the same message_id is a no-op.
//   - Rate-limit: max one bot reply per conversation per 20s (prevents loops).
//   - Loop guard: never automates on bot/staff messages (only triggers SLA reset).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ----- text utils -----
function bnDigitsToEn(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}
function normalize(s: string): string {
  return bnDigitsToEn((s || "").toLowerCase()).slice(0, 1000);
}

const INTENT_WORDS = [
  "nibo", "nebo", "nilam", "niba", "oder", "order",
  "kinbo", "kinbo", "kinbe", "buy",
  "confirm korbo", "confirm",
  "অর্ডার", "নিবো", "নিব", "নিলাম", "নেব", "কিনবো", "কিনব", "কনফার্ম",
];
const PRICING_ONLY = ["price", "koto", "kotota", "দাম", "কত", "koto taka", "kt", "rate"];
const CONFIRM_WORDS = ["confirm", "haa", "ha", "জি", "হ্যাঁ", "ঠিক আছে", "ok", "okay", "ji"];
const CANCEL_WORDS = ["cancel", "no", "lagbe na", "লাগবে না", "ক্যান্সেল", "বাদ", "na"];

const NUMBER_RE = /(?<!\d)(\d{2,5})(?:\s*(tk|taka|৳|টাকা))?/i;

type Decision =
  | { kind: "order_intent"; price: number; raw: string }
  | { kind: "pricing_only"; price: number | null }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "noop"; reason: string };

function wordHit(t: string, w: string): boolean {
  // ASCII words use word boundaries; non-ASCII (e.g. Bangla) use substring.
  if (/^[a-z0-9 ]+$/i.test(w)) {
    return new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, "i").test(t);
  }
  return t.includes(w);
}

function classify(text: string): Decision {
  const t = normalize(text);
  if (!t.trim()) return { kind: "noop", reason: "empty" };

  const m = t.match(NUMBER_RE);
  let price: number | null = null;
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 50 && n <= 100000) price = n;
  }
  const hasIntent = INTENT_WORDS.some((w) => wordHit(t, w));
  const hasCancel = CANCEL_WORDS.some((w) => wordHit(t, w));
  const hasConfirm = CONFIRM_WORDS.some((w) => wordHit(t, w));
  const hasPricingOnly = PRICING_ONLY.some((w) => wordHit(t, w));

  // Cancel always wins over a stray number
  if (hasCancel) return { kind: "cancel" };
  if (price !== null && hasIntent) return { kind: "order_intent", price, raw: text };
  if (hasConfirm && !hasIntent) return { kind: "confirm" };
  if (hasPricingOnly) return { kind: "pricing_only", price };
  return { kind: "noop", reason: "no_match" };
}

// Exposed for testing
export const __test = { normalize, classify, bnDigitsToEn };

// ----- main handler -----
async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { conversation_id?: string; message_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const conversationId = body.conversation_id;
  const messageId = body.message_id;
  if (!conversationId || !messageId) {
    return json({ error: "conversation_id and message_id required" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Idempotency: if we already logged 'processed' for this message, exit.
  const { data: dup } = await sb
    .from("inbox_automation_logs")
    .select("id")
    .eq("message_id", messageId)
    .eq("event", "processed")
    .maybeSingle();
  if (dup) return json({ ok: true, skipped: "already_processed" });

  // Fetch the message
  const { data: msg, error: msgErr } = await sb
    .from("inbox_messages")
    .select("id, conversation_id, sender_type, message, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr || !msg) return json({ error: "message_not_found" }, 404);

  // ----- SLA state machine (runs for both staff and customer) -----
  await applySla(sb, conversationId, msg.sender_type, msg.created_at);

  // Loop guard
  if (msg.sender_type === "staff" || msg.sender_type === "bot" || msg.sender_type === "ai") {
    await logEvent(sb, conversationId, messageId, null, "skipped_non_customer", {
      sender_type: msg.sender_type,
    });
    // Still recompute lead score so it can downgrade after a staff reply.
    await recomputeLeadScore(sb, conversationId);
    await logEvent(sb, conversationId, messageId, null, "processed", { ran: "sla_only" });
    return json({ ok: true, ran: "sla_only" });
  }

  // ----- Decision -----
  const decision = classify(msg.message || "");
  await logEvent(sb, conversationId, messageId, null, `decision_${decision.kind}`, decision);

  // Rate guard for bot replies
  const canBotReply = await rateGuardOk(sb, conversationId);

  if (decision.kind === "order_intent") {
    await upsertPendingOrder(sb, conversationId, messageId, decision.price, msg.message || "");
    if (canBotReply) {
      await sendBotReply(
        sb,
        conversationId,
        `কনফার্ম করতে চান ৳${decision.price} এর অর্ডারটি? "হ্যাঁ" / "না" লিখে পাঠান 🙏`,
        { trigger: "order_intent" },
      );
    }
  } else if (decision.kind === "pricing_only") {
    // fire keyword rule but do NOT create order
    await runKeywordRules(sb, conversationId, messageId, msg.message || "", canBotReply);
  } else if (decision.kind === "confirm") {
    await handleConfirm(sb, conversationId, messageId, canBotReply);
  } else if (decision.kind === "cancel") {
    await handleCancel(sb, conversationId, messageId, canBotReply);
  } else {
    await runKeywordRules(sb, conversationId, messageId, msg.message || "", canBotReply);
  }

  await recomputeLeadScore(sb, conversationId);
  await logEvent(sb, conversationId, messageId, null, "processed", { decision: decision.kind });

  return json({ ok: true, decision: decision.kind });
}

// ----- helpers -----
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logEvent(
  sb: any, conversationId: string, messageId: string | null,
  ruleId: string | null, event: string, payload: unknown,
) {
  await sb.from("inbox_automation_logs").insert({
    conversation_id: conversationId,
    message_id: messageId,
    rule_id: ruleId,
    event,
    payload,
  });
}

async function applySla(
  sb: any, conversationId: string, senderType: string, createdAt: string,
) {
  if (senderType === "staff") {
    await sb.from("inbox_conversations").update({
      sla_last_agent_reply_at: createdAt,
      sla_first_response_at: null,
      sla_due_at: null,
      sla_breached: false,
    }).eq("id", conversationId);
    return;
  }
  if (senderType === "customer" || senderType === "visitor") {
    const { data: c } = await sb
      .from("inbox_conversations")
      .select("sla_first_response_at")
      .eq("id", conversationId).maybeSingle();
    if (!c?.sla_first_response_at) {
      const due = new Date(new Date(createdAt).getTime() + 5 * 60_000).toISOString();
      await sb.from("inbox_conversations").update({
        sla_first_response_at: createdAt,
        sla_due_at: due,
        sla_breached: false,
      }).eq("id", conversationId);
    }
  }
}

async function rateGuardOk(sb: any, conversationId: string): Promise<boolean> {
  const since = new Date(Date.now() - 20_000).toISOString();
  const { data } = await sb
    .from("inbox_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("sender_type", "bot")
    .gte("created_at", since)
    .limit(1);
  return !data || data.length === 0;
}

async function sendBotReply(
  sb: any, conversationId: string, text: string, metadata: Record<string, unknown>,
) {
  await sb.from("inbox_messages").insert({
    conversation_id: conversationId,
    sender_type: "bot",
    sender_name: "Auto-Bot",
    message: text,
    metadata,
  });
  await sb.from("inbox_conversations").update({
    last_message: text,
    last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
}

async function upsertPendingOrder(
  sb: any, conversationId: string, messageId: string, price: number, raw: string,
) {
  // Look for existing pending row (partial unique index guarantees ≤1)
  const { data: existing } = await sb
    .from("inbox_detected_orders")
    .select("id, detected_price")
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    await sb.from("inbox_detected_orders").update({
      detected_price: price,
      raw_text: raw,
      message_id: messageId,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    await logEvent(sb, conversationId, messageId, null, "detected_order_updated", {
      id: existing.id, old_price: existing.detected_price, new_price: price,
    });
  } else {
    const { data: inserted } = await sb.from("inbox_detected_orders").insert({
      conversation_id: conversationId,
      message_id: messageId,
      detected_price: price,
      raw_text: raw,
      status: "pending",
    }).select("id").single();
    await logEvent(sb, conversationId, messageId, null, "detected_order_created", {
      id: inserted?.id, price,
    });
  }
  // Track last intent for confirm/cancel ordering
  await sb.from("inbox_conversations").update({
    last_intent_message_id: messageId,
  }).eq("id", conversationId);
}

async function handleConfirm(
  sb: any, conversationId: string, messageId: string, canBotReply: boolean,
) {
  const { data: pending } = await sb
    .from("inbox_detected_orders")
    .select("id, detected_price")
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .maybeSingle();
  if (!pending) {
    await logEvent(sb, conversationId, messageId, null, "confirm_ignored_no_pending", {});
    return;
  }
  await sb.from("inbox_detected_orders").update({
    status: "confirmed", updated_at: new Date().toISOString(),
  }).eq("id", pending.id);
  await logEvent(sb, conversationId, messageId, null, "order_confirmed", { id: pending.id });
  if (canBotReply) {
    await sendBotReply(
      sb, conversationId,
      `ধন্যবাদ! আপনার অর্ডার কনফার্ম হয়েছে ✅ একজন এজেন্ট শীঘ্রই যোগাযোগ করবেন।`,
      { trigger: "order_confirmed", detected_order_id: pending.id },
    );
  }
}

async function handleCancel(
  sb: any, conversationId: string, messageId: string, canBotReply: boolean,
) {
  const { data: pending } = await sb
    .from("inbox_detected_orders")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .maybeSingle();
  if (!pending) {
    await logEvent(sb, conversationId, messageId, null, "cancel_ignored_no_pending", {});
    return;
  }
  await sb.from("inbox_detected_orders").update({
    status: "cancelled", updated_at: new Date().toISOString(),
  }).eq("id", pending.id);
  await logEvent(sb, conversationId, messageId, null, "order_cancelled", { id: pending.id });
  if (canBotReply) {
    await sendBotReply(
      sb, conversationId,
      `ঠিক আছে, অর্ডার ক্যান্সেল করা হলো। প্রয়োজন হলে আবার জানাবেন 🙏`,
      { trigger: "order_cancelled", detected_order_id: pending.id },
    );
  }
}

async function runKeywordRules(
  sb: any, conversationId: string, messageId: string, text: string, canBotReply: boolean,
) {
  const t = normalize(text);
  const { data: rules } = await sb
    .from("inbox_automation_rules")
    .select("id, name, match_keywords, reply_template, action")
    .eq("is_active", true)
    .eq("trigger_type", "keyword")
    .order("priority", { ascending: true });
  if (!rules?.length) return;

  for (const r of rules) {
    const kws: string[] = r.match_keywords || [];
    if (kws.some((k) => t.includes(k.toLowerCase()))) {
      await logEvent(sb, conversationId, messageId, r.id, "keyword_matched", { rule: r.name });
      if (canBotReply && r.reply_template) {
        await sendBotReply(sb, conversationId, r.reply_template, {
          trigger: "keyword", rule_id: r.id,
        });
      } else if (!canBotReply) {
        await logEvent(sb, conversationId, messageId, r.id, "reply_suppressed_rate_limit", {});
      }
      return; // first match wins
    }
  }
}

async function recomputeLeadScore(sb: any, conversationId: string) {
  const { data: msgs } = await sb
    .from("inbox_messages")
    .select("message, created_at, sender_type")
    .eq("conversation_id", conversationId)
    .in("sender_type", ["customer", "visitor"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (!msgs?.length) return;

  const weights = [1.5, 1.2, 1.0, 0.8, 0.6];
  let score = 0;
  let prevTs: number | null = null;
  msgs.forEach((m: any, i: number) => {
    const t = normalize(m.message || "");
    const hasIntent = INTENT_WORDS.some((w) => wordHit(t, w));
    const hasNum = NUMBER_RE.test(t);
    const hasConfirm = CONFIRM_WORDS.some((w) => wordHit(t, w));
    const hasCancel = CANCEL_WORDS.some((w) => wordHit(t, w));
    const isQuestion = /\?|koto|ki|size|color|delivery|available|দাম|কত/i.test(t);

    let s = 0;
    if (hasNum && hasIntent) s += 3;
    else if (hasIntent) s += 2;
    if (hasConfirm) s += 2;
    if (isQuestion) s += 1;
    if (hasCancel) s -= 2;

    const ts = new Date(m.created_at).getTime();
    if (prevTs !== null && Math.abs(prevTs - ts) > 6 * 3600_000) s -= 1;
    prevTs = ts;

    score += s * weights[i];
  });

  let lead: "hot" | "medium" | "cold" = "cold";
  if (score >= 5) lead = "hot";
  else if (score >= 2) lead = "medium";

  await sb.from("inbox_conversations").update({ lead_score: lead }).eq("id", conversationId);
  await logEvent(sb, conversationId, null, null, "lead_score_recomputed", {
    score: Number(score.toFixed(2)), lead,
  });
}

Deno.serve(handle);
