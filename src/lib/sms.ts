// Centralized client-side SMS helper. Edge function routes to whichever provider is active.
import { supabase } from '@/integrations/supabase/client';

export async function sendSMS(phone: string, message: string) {
  return supabase.functions.invoke('send-sms', { body: { phone, message } });
}

// send-sms blocks direct sends by default (an "emergency spend guard" —
// SMS may only go out for order confirmations, to keep the provider from
// flagging campaign-style content as spam). party_ledger is the one
// deliberate exception: payment-received notices and work-summary sends
// from a person's accounting profile. The message MUST contain "স্বর্ণ সুতা"
// (matches PARTY_LEDGER_PATTERN server-side) or the send is rejected —
// don't strip the store-name sign-off from these templates.
export async function sendPartyLedgerSMS(phone: string, message: string) {
  return supabase.functions.invoke('send-sms', { body: { phone, message, purpose: 'party_ledger' } });
}
