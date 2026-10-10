import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/config';

// CORE Connect: this site's monthly package, bills and admin lock, managed by CORE
// Automation. The browser talks to /api/core-connect (api/core-connect.js), which holds
// the project's key and checks the signed-in staff member.

export interface CorePlan {
  id: string;
  name: string;
  tagline: string | null;
  price: number;
  ram: string | null;
  cpu: string | null;
  storage: string | null;
  bandwidth: string | null;
  features: string[];
  badge: string | null;
  current?: boolean;
}

export interface CoreBilling {
  status: 'active' | 'due' | 'overdue' | 'locked';
  locked: boolean;
  lock_date: string | null;
  next_due_date: string | null;
  due_amount?: number;
  open_invoices?: number;
  package?: string | null;
  monthly_price?: number | null;
  next_bill_on?: string | null;
  next_renewal?: string | null;
  bill_days_before?: number;
  grace_days?: number;
}

export interface CoreInvoice {
  id: string;
  number: string;
  description: string | null;
  kind: string;
  amount: number;
  status: 'sent' | 'overdue' | 'paid' | 'cancelled';
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  url: string;
}

export interface CorePayment {
  id: string;
  invoice_id: string | null;
  method: string;
  amount: number;
  trx_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
}

export interface CoreService {
  id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  price: number | null;
  price_label: string | null;
}

export interface CoreSupport {
  phone: string;
  whatsapp: string;
  email: string;
}

export interface CoreStatus {
  /** false: CORE_CONNECT_KEY is not set yet (or CORE does not know it): never lock. */
  connected: boolean;
  /** true: CORE could not be reached; this is the last state seen. */
  stale?: boolean;
  can_pay?: boolean;
  role?: string;
  billing?: CoreBilling;
  plan?: CorePlan | null;
  plans?: CorePlan[];
  invoices?: CoreInvoice[];
  payments?: CorePayment[];
  orders?: { id: string; service_name: string; status: string; created_at: string }[];
  services?: CoreService[];
  payment?: {
    methods: { method: string; label: string; number: string }[];
    bank_details: string | null;
    instructions: string | null;
  };
  support?: CoreSupport;
}

export class CoreError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new CoreError('অ্যাডমিন প্যানেলে লগইন করুন।', 401);
  const res = await fetch('/api/core-connect', {
    method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new CoreError(json?.error || 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।', res.status);
  return json as T;
}

const CACHE_KEY = 'core-connect-billing';

/**
 * The project's status at CORE. When CORE cannot be reached, the last state seen is
 * used (so a short outage neither locks nor unlocks the panel); never seen: not locked.
 */
export async function getCoreStatus(): Promise<CoreStatus> {
  try {
    const status = await call<Omit<CoreStatus, 'connected'>>('GET');
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ billing: status.billing, support: status.support }));
    } catch {
      // private mode: no cache
    }
    return { ...status, connected: true };
  } catch (e) {
    const error = e as CoreError;
    // not set up yet, the dev server (no /api), or not signed in: never lock
    if (error.message === 'not_connected' || error.status === 404 || error.status === 401) {
      return { connected: false };
    }
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.billing) return { ...cached, connected: true, stale: true };
    } catch {
      // unreadable cache
    }
    return { connected: false };
  }
}

export type CoreAction =
  | { action: 'pay'; invoice_id: string; method: string; amount: number; trx_id: string; sender?: string }
  | { action: 'plan'; package_id: string }
  | { action: 'ticket'; subject: string; description?: string }
  | { action: 'order'; service_id: string; note?: string };

export const coreAction = <T = Record<string, unknown>>(body: CoreAction) => call<T>('POST', body);

export const formatTaka = (value: number | null | undefined) =>
  value == null ? '' : `৳${Number(value).toLocaleString('bn-BD')}`;

export const formatBnDate = (value: string | null | undefined) =>
  value
    ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
