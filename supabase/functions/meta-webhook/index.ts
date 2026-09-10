import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacSha256Verify(secret: string, payload: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === signature;
}

async function getSettings(supabase: any, keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabase.from("store_settings").select("key, value").in("key", keys);
  const map: Record<string, string> = {};
  data?.forEach((r: any) => { map[r.key] = r.value; });
  return map;
}

async function findOrCreateConversation(supabase: any, platform: string, platformId: string, senderName: string, customerPhone?: string) {
  // Step 1: Search by platform + platform_conversation_id
  const { data: existing } = await supabase
    .from("inbox_conversations").select("id, unread_count, customer_phone")
    .eq("platform", platform).eq("platform_conversation_id", platformId).single();
  if (existing) {
    if (customerPhone && !existing.customer_phone) {
      await supabase.from("inbox_conversations").update({ customer_phone: customerPhone }).eq("id", existing.id);
    }
    return existing;
  }

  // Step 2: Fallback — search by phone + platform
  if (customerPhone) {
    const phoneCandidates = [customerPhone];
    const clean = customerPhone.replace(/[\s-]/g, "");
    if (clean.startsWith("0")) {
      phoneCandidates.push("880" + clean.slice(1));
      phoneCandidates.push("+880" + clean.slice(1));
    } else if (clean.startsWith("880")) {
      phoneCandidates.push("0" + clean.slice(3));
      phoneCandidates.push("+" + clean);
    }
    const uniquePhones = [...new Set(phoneCandidates)];

    const { data: phoneMatch } = await supabase
      .from("inbox_conversations").select("id, unread_count, customer_phone")
      .eq("platform", platform).in("customer_phone", uniquePhones)
      .order("created_at", { ascending: true }).limit(1).single();

    if (phoneMatch) {
      log("PHONE_FALLBACK_MATCH", { id: phoneMatch.id, platformId, phone: customerPhone });
      await supabase.from("inbox_conversations").update({
        platform_conversation_id: platformId,
        customer_name: senderName || undefined,
      }).eq("id", phoneMatch.id);
      return phoneMatch;
    }
  }

  // Step 3: Create new conversation
  const insertData: any = { platform, platform_conversation_id: platformId, customer_name: senderName || platformId, status: "open", unread_count: 0 };
  if (customerPhone) insertData.customer_phone = customerPhone;

  const { data: created, error } = await supabase
    .from("inbox_conversations")
    .insert(insertData)
    .select("id, unread_count").single();
  if (error) { console.error("Failed to create conversation:", error); throw error; }
  return created;
}

async function saveMessage(supabase: any, conversationId: string, currentUnread: number, text: string, imageUrl: string | null, senderName: string, providerMessageId?: string | null): Promise<{ inserted: boolean }> {
  const insertRow: any = {
    conversation_id: conversationId, message: text || "", image_url: imageUrl,
    sender_type: "customer", sender_name: senderName || "Customer", is_read: false,
  };
  if (providerMessageId) insertRow.provider_message_id = providerMessageId;

  const { error } = await supabase.from("inbox_messages").insert(insertRow);
  if (error) {
    // 23505 = unique violation -> duplicate webhook retry, skip silently
    if ((error as any).code === "23505") {
      log("DEDUP_SKIP", { conversationId, providerMessageId });
      return { inserted: false };
    }
    throw error;
  }

  await supabase.from("inbox_conversations").update({
    last_message: text || (imageUrl ? "📷 ছবি" : ""),
    last_message_at: new Date().toISOString(),
    unread_count: currentUnread + 1, status: "open",
  }).eq("id", conversationId);
  return { inserted: true };
}

async function saveAuditLog(supabase: any, audit: {
  platform: string; object_type?: string; event_type: string;
  parsed_count: number; saved_count: number; status_count: number;
  skipped_reasons: string[]; raw_preview?: string; error?: string; has_signature: boolean;
}) {
  try {
    await supabase.from("webhook_event_logs").insert({
      platform: audit.platform,
      object_type: audit.object_type || null,
      event_type: audit.event_type,
      parsed_count: audit.parsed_count,
      saved_count: audit.saved_count,
      status_count: audit.status_count,
      skipped_reasons: audit.skipped_reasons.length > 0 ? audit.skipped_reasons : null,
      raw_preview: audit.raw_preview || null,
      error: audit.error || null,
      has_signature: audit.has_signature,
    });
  } catch (e) { console.error("Audit log save failed:", e); }

  // Also keep the legacy store_settings key for backward compat
  try {
    const value = JSON.stringify({
      type: audit.event_type, timestamp: new Date().toISOString(),
      objectType: audit.object_type, totalParsed: audit.parsed_count,
      totalSaved: audit.saved_count, totalStatuses: audit.status_count,
      hasSignature: audit.has_signature,
      ...(audit.raw_preview ? { raw_preview: audit.raw_preview } : {}),
      ...(audit.error ? { error: audit.error } : {}),
      ...(audit.skipped_reasons.length > 0 ? { skipped_reasons: audit.skipped_reasons } : {}),
    });
    const { data: existing } = await supabase.from("store_settings").select("id").eq("key", "meta_webhook_last_hit").single();
    if (existing) {
      await supabase.from("store_settings").update({ value }).eq("key", "meta_webhook_last_hit");
    } else {
      await supabase.from("store_settings").insert({ key: "meta_webhook_last_hit", value });
    }
  } catch {}
}

async function updateDeliveryStatus(supabase: any, waMessageId: string, status: string, timestamp: string, errorInfo?: { code?: number | null; title?: string | null; details?: string | null } | null) {
  try {
    const { data: msgs } = await supabase
      .from("inbox_messages").select("id, metadata")
      .eq("sender_type", "staff")
      .order("created_at", { ascending: false }).limit(50);
    if (!msgs) return;
    for (const msg of msgs) {
      const meta = msg.metadata || {};
      if (meta.wa_message_id === waMessageId) {
        const next: any = { ...meta, wa_delivery_status: status, wa_delivery_updated_at: timestamp };
        if (status === "failed" && errorInfo) {
          if (errorInfo.title) next.wa_error = errorInfo.title;
          if (errorInfo.details) next.wa_error_details = errorInfo.details;
          if (errorInfo.code != null) next.wa_error_code = errorInfo.code;
          // 131047 = re-engagement window
          if (errorInfo.code === 131047) next.wa_policy_blocked = "24h_window";
        }
        await supabase.from("inbox_messages").update({ metadata: next }).eq("id", msg.id);
        log("STATUS_UPDATED", { msgId: msg.id, status, code: errorInfo?.code });
        return;
      }
    }
  } catch (e) { log("STATUS_UPDATE_ERROR", String(e)); }
}

interface ParsedMessage {
  platform: string; senderId: string; senderName: string; text: string; imageUrl: string | null; customerPhone?: string; providerMessageId?: string | null;
}
interface StatusUpdate {
  waMessageId: string; status: string; timestamp: string; recipientId: string;
  errorCode?: number | null; errorTitle?: string | null; errorDetails?: string | null;
}

// ===== HARDENED PARSERS =====

function parseMessengerAndInstagram(entry: any, platform: string): { messages: ParsedMessage[]; statuses: StatusUpdate[]; skipped: string[] } {
  const messages: ParsedMessage[] = [];
  const skipped: string[] = [];

  const messagingArray = entry.messaging || entry.changes?.map((c: any) => c.value)?.flat() || [];

  if (!messagingArray || messagingArray.length === 0) {
    // Check if there's a standby/read/delivery event
    if (entry.standby) { skipped.push(`${platform}:standby_event`); }
    else if (entry.read || entry.delivery) { skipped.push(`${platform}:read_or_delivery_receipt`); }
    else { skipped.push(`${platform}:no_messaging_array`); }
    return { messages, statuses: [], skipped };
  }

  for (const event of messagingArray) {
    // Handle messaging[] items directly
    if (event.message) {
      const senderId = event.sender?.id || "";
      const text = event.message?.text || "";
      const attachments = event.message?.attachments || [];
      const mid = event.message?.mid || null;
      let imageUrl: string | null = null;

      // Check for image attachments
      for (const att of attachments) {
        if (att.type === "image" && att.payload?.url) {
          imageUrl = att.payload.url;
          break;
        }
      }

      // Skip echo messages (our own outgoing) - sender is the page
      if (event.message?.is_echo) {
        skipped.push(`${platform}:echo_skipped`);
        continue;
      }

      if (senderId) {
        messages.push({ platform, senderId, senderName: senderId, text, imageUrl, providerMessageId: mid });
      } else {
        skipped.push(`${platform}:message_no_sender_id`);
      }
    } else if (event.postback) {
      // Messenger/Instagram postback (button click)
      const senderId = event.sender?.id || "";
      if (senderId) {
        messages.push({
          platform, senderId, senderName: senderId,
          text: event.postback?.title || event.postback?.payload || "[postback]",
          imageUrl: null,
          providerMessageId: event.postback?.mid || null,
        });
      }
    } else if (event.referral) {
      // Messenger referral
      const senderId = event.sender?.id || "";
      if (senderId) {
        messages.push({
          platform, senderId, senderName: senderId,
          text: `[referral: ${event.referral?.ref || ""}]`,
          imageUrl: null,
        });
      }
    } else if (event.read || event.delivery) {
      skipped.push(`${platform}:read_or_delivery_receipt`);
    } else if (event.reaction) {
      skipped.push(`${platform}:reaction_event`);
    } else if (event.optin) {
      skipped.push(`${platform}:optin_event`);
    } else {
      skipped.push(`${platform}:unknown_event_type:${Object.keys(event).filter(k => k !== 'sender' && k !== 'recipient' && k !== 'timestamp').join(',')}`);
    }
  }

  return { messages, statuses: [], skipped };
}

function parseWhatsApp(entry: any): { messages: ParsedMessage[]; statuses: StatusUpdate[]; skipped: string[] } {
  const messages: ParsedMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const skipped: string[] = [];

  const changes = entry.changes || [];
  if (changes.length === 0) {
    skipped.push("whatsapp:no_changes_array");
    return { messages, statuses, skipped };
  }

  for (const change of changes) {
    if (change.field !== "messages") {
      skipped.push(`whatsapp:field_${change.field || 'unknown'}`);
      continue;
    }
    const value = change.value || {};

    // Parse contacts for name resolution
    const contactMap: Record<string, string> = {};
    (value.contacts || []).forEach((c: any) => { contactMap[c.wa_id] = c.profile?.name || c.wa_id; });

    // Parse incoming messages — support ALL message types
    for (const msg of value.messages || []) {
      const senderId = msg.from || "";
      let text = ""; let imageUrl: string | null = null;

      switch (msg.type) {
        case "text":
          text = msg.text?.body || "";
          break;
        case "image":
          text = msg.image?.caption || "[ছবি]";
          // Note: imageUrl requires download via Graph API with media ID
          break;
        case "video":
          text = msg.video?.caption || "[ভিডিও]";
          break;
        case "audio":
          text = "[অডিও]";
          break;
        case "document":
          text = msg.document?.caption || `[ডকুমেন্ট: ${msg.document?.filename || ""}]`;
          break;
        case "sticker":
          text = "[স্টিকার]";
          break;
        case "location":
          text = `[লোকেশন: ${msg.location?.latitude},${msg.location?.longitude}]`;
          break;
        case "contacts":
          text = `[কন্টাক্ট: ${msg.contacts?.[0]?.name?.formatted_name || ""}]`;
          break;
        case "reaction":
          text = `[রিয়্যাকশন: ${msg.reaction?.emoji || ""}]`;
          break;
        case "button":
          text = msg.button?.text || "[বাটন]";
          break;
        case "interactive":
          // Interactive replies (list replies, button replies)
          if (msg.interactive?.type === "list_reply") {
            text = msg.interactive.list_reply?.title || "[লিস্ট রিপ্লাই]";
          } else if (msg.interactive?.type === "button_reply") {
            text = msg.interactive.button_reply?.title || "[বাটন রিপ্লাই]";
          } else {
            text = `[ইন্টার‍্যাক্টিভ: ${msg.interactive?.type || "unknown"}]`;
          }
          break;
        case "order":
          text = "[অর্ডার]";
          break;
        case "system":
          text = msg.system?.body || "[সিস্টেম]";
          break;
        default:
          text = `[${msg.type || "unknown"}]`;
          if (!msg.type) skipped.push("whatsapp:message_no_type");
          break;
      }

      const customerPhone = senderId.startsWith("880") ? "0" + senderId.slice(3) : senderId;
      if (senderId) {
        messages.push({ platform: "whatsapp", senderId, senderName: contactMap[senderId] || senderId, text, imageUrl, customerPhone, providerMessageId: msg.id || null });
      } else {
        skipped.push("whatsapp:message_no_from");
      }
    }

    // Parse status updates (now also capture WA error[] when status === failed)
    for (const st of value.statuses || []) {
      const errArr = Array.isArray(st.errors) ? st.errors : [];
      const firstErr = errArr[0] || null;
      statuses.push({
        waMessageId: st.id || "",
        status: st.status || "",
        timestamp: st.timestamp ? new Date(parseInt(st.timestamp) * 1000).toISOString() : new Date().toISOString(),
        recipientId: st.recipient_id || "",
        errorCode: firstErr?.code ?? null,
        errorTitle: firstErr?.title ?? firstErr?.message ?? null,
        errorDetails: firstErr?.error_data?.details ?? firstErr?.href ?? null,
      });
    }

    // If no messages and no statuses from this change
    if ((value.messages || []).length === 0 && (value.statuses || []).length === 0) {
      skipped.push("whatsapp:change_no_messages_or_statuses");
    }
  }
  return { messages, statuses, skipped };
}

function log(label: string, data: any) {
  console.log(`[DIAG:meta-webhook] ${label}:`, typeof data === 'string' ? data : JSON.stringify(data));
}

Deno.serve(async (req) => {
  log("HIT", { method: req.method, url: req.url, timestamp: new Date().toISOString() });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ===== GET: Verification (zero-DB-call for speed) =====
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    log("GET_VERIFY", { mode, challenge });

    if (mode !== "subscribe" || !token || !challenge) return new Response("Bad request", { status: 400 });

    let storedToken = Deno.env.get("META_VERIFY_TOKEN") || "";
    if (!storedToken) {
      log("VERIFY_FALLBACK_DB", "env var not set, querying DB");
      const settings = await getSettings(supabase, ["meta_verify_token"]);
      storedToken = settings.meta_verify_token || "";
    }

    if (!storedToken || token !== storedToken) {
      log("VERIFY_FAIL", "token mismatch");
      return new Response("Forbidden", { status: 403 });
    }

    log("VERIFY_OK", challenge);
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // ===== POST: Incoming events =====
  if (req.method === "POST") {
    const rawBody = await req.text();
    log("POST_BODY_LENGTH", rawBody.length);

    let body: any;
    try { body = JSON.parse(rawBody); }
    catch {
      log("JSON_PARSE_ERROR", rawBody.substring(0, 200));
      await saveAuditLog(supabase, {
        platform: "unknown", event_type: "json_error", parsed_count: 0, saved_count: 0,
        status_count: 0, skipped_reasons: ["invalid_json"], raw_preview: rawBody.substring(0, 500),
        error: "Invalid JSON", has_signature: false,
      });
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Signature verification
    const signature = req.headers.get("x-hub-signature-256") || "";
    const settings = await getSettings(supabase, ["meta_app_secret"]);
    const appSecret = settings.meta_app_secret;

    if (!appSecret) {
      log("SECRET_MISSING", "meta_app_secret not configured");
      await saveAuditLog(supabase, {
        platform: body.object || "unknown", event_type: "config_error", parsed_count: 0, saved_count: 0,
        status_count: 0, skipped_reasons: ["meta_app_secret_missing"],
        error: "meta_app_secret not configured", has_signature: !!signature,
      });
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const valid = await hmacSha256Verify(appSecret, rawBody, signature);
    if (!valid) {
      log("SIGNATURE_INVALID", "failed");
      // Diagnostic aid: surface header prefix + entry-app-id so admin can identify which Meta App actually signed it
      const sigPrefix = signature ? signature.substring(0, 20) + "…" : "none";
      const entryAppIds = (body.entry || []).map((e: any) => e?.id).filter(Boolean).slice(0, 3).join(",");
      const diagReasons = [
        "invalid_signature",
        `sig_prefix:${sigPrefix}`,
        `entry_ids:${entryAppIds || "none"}`,
        `secret_len:${appSecret.length}`,
      ];
      await saveAuditLog(supabase, {
        platform: body.object || "unknown", event_type: "signature_invalid", parsed_count: 0, saved_count: 0,
        status_count: 0, skipped_reasons: diagReasons, raw_preview: rawBody.substring(0, 300),
        has_signature: !!signature,
      });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const objectType = body.object;
    const entries = body.entry || [];
    let totalParsed = 0, totalSaved = 0, totalStatuses = 0;
    const allSkipped: string[] = [];

    // Determine platform from object type
    let platform = "unknown";
    if (objectType === "page") platform = "messenger";
    else if (objectType === "instagram") platform = "instagram";
    else if (objectType === "whatsapp_business_account") platform = "whatsapp";
    else {
      allSkipped.push(`unsupported_object:${objectType}`);
      log("UNSUPPORTED_OBJECT", objectType);
    }

    for (const entry of entries) {
      let parsedMessages: ParsedMessage[] = [];
      let parsedStatuses: StatusUpdate[] = [];
      let entrySkipped: string[] = [];

      if (objectType === "page") {
        const result = parseMessengerAndInstagram(entry, "messenger");
        parsedMessages = result.messages;
        entrySkipped = result.skipped;
      } else if (objectType === "instagram") {
        const result = parseMessengerAndInstagram(entry, "instagram");
        parsedMessages = result.messages;
        entrySkipped = result.skipped;
      } else if (objectType === "whatsapp_business_account") {
        const result = parseWhatsApp(entry);
        parsedMessages = result.messages;
        parsedStatuses = result.statuses;
        entrySkipped = result.skipped;
      }

      allSkipped.push(...entrySkipped);
      totalParsed += parsedMessages.length;
      totalStatuses += parsedStatuses.length;

      // Save incoming messages
      let dedupCount = 0;
      for (const msg of parsedMessages) {
        try {
          const conversation = await findOrCreateConversation(supabase, msg.platform, msg.senderId, msg.senderName, msg.customerPhone);
          const result = await saveMessage(supabase, conversation.id, conversation.unread_count || 0, msg.text, msg.imageUrl, msg.senderName, msg.providerMessageId);
          if (result.inserted) totalSaved++;
          else dedupCount++;
        } catch (err) {
          log("MSG_SAVE_ERROR", { error: String(err), sender: msg.senderId });
          allSkipped.push(`save_error:${msg.platform}:${String(err).substring(0, 100)}`);
        }
      }
      if (dedupCount > 0) allSkipped.push(`dedup_skipped:${dedupCount}`);

      // Process delivery status updates (now forwards error info to message metadata)
      for (const st of parsedStatuses) {
        try {
          const errInfo = (st.status === "failed" && (st.errorCode != null || st.errorTitle))
            ? { code: st.errorCode, title: st.errorTitle, details: st.errorDetails }
            : null;
          await updateDeliveryStatus(supabase, st.waMessageId, st.status, st.timestamp, errInfo);
        } catch (err) { log("STATUS_PROCESS_ERROR", { error: String(err), waMessageId: st.waMessageId }); }
      }
    }

    // Save detailed audit log
    const shouldSaveRaw = totalParsed === 0 && totalStatuses === 0;
    await saveAuditLog(supabase, {
      platform, object_type: objectType, event_type: "post_success",
      parsed_count: totalParsed, saved_count: totalSaved, status_count: totalStatuses,
      skipped_reasons: allSkipped,
      raw_preview: shouldSaveRaw ? rawBody.substring(0, 1000) : undefined,
      has_signature: !!signature,
    });

    log("SUMMARY", { platform, totalParsed, totalSaved, totalStatuses, skipped: allSkipped.length });
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});
