// Dropshipping from Shadamon Shop (admin → ড্রপশিপিং): the shop's calls to the supplier edge
// function, which talks to Shadamon with the shop's own key (the same as the CORE Shop
// engine). Shadamon is in the order pages' courier menu once the shop sells its products.
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/integrations/supabase/config';

/** The admin is written in Bangla; its English comes from the page translator's word list. */
export const bnText = <T,>(bn: T, _en?: T): T => bn;

/** Calls the supplier function (`?action=`) as the signed-in staff member. */
export async function callSupplier<T = Record<string, unknown>>(action: string, body: object = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/supplier?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Shadamon (${res.status})`);
  return data as T;
}
