// Centralised friendly Bengali error messages for the audience engine.

export function friendlyError(err: unknown): string {
  const msg = (err as any)?.message || String(err || '');
  const m = msg.toLowerCase();

  if (!msg) return 'অজানা সমস্যা হয়েছে';
  if (m.includes('network') || m.includes('failed to fetch'))
    return 'ইন্টারনেট সংযোগে সমস্যা — আবার চেষ্টা করুন';
  if (m.includes('timeout')) return 'সময় শেষ হয়ে গেছে — আবার চেষ্টা করুন';
  if (m.includes('rate limit') || m.includes('429'))
    return 'অনেক বেশি রিকোয়েস্ট — কিছুক্ষণ পরে চেষ্টা করুন';
  if (m.includes('unauthor') || m.includes('jwt') || m.includes('401'))
    return 'লগইন সেশন শেষ — আবার লগইন করুন';
  if (m.includes('rls') || m.includes('row-level') || m.includes('permission'))
    return 'অনুমতি নেই — অ্যাডমিনের সাথে যোগাযোগ করুন';
  if (m.includes('balance') || m.includes('insufficient'))
    return 'SMS ব্যালেন্স কম — রিচার্জ করুন';
  if (m.includes('provider')) return 'SMS প্রোভাইডার সমস্যায় আছে';
  return msg;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 1;
  const delay = opts.delayMs ?? 500;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw lastErr;
}
