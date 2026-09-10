import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAccActivity } from '@/hooks/useAccActivityLog';

/**
 * Ensures an acc_transactions sale entry exists for an office_sell/delivered order.
 * Uses orders.total (after discount) as source of truth.
 * Handles: insert if missing, update if amount mismatch, skip if correct.
 */
export async function ensureOfficeSellSaleEntry(orderId: string, opts?: { silent?: boolean; source?: 'cash' | 'bank'; amount?: number; allowAnyStatus?: boolean }) {
  try {
    // 1. Fetch order total AND status (source of truth)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, subtotal, total, order_number, status, created_at')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) {
      if (!opts?.silent) toast.error('অর্ডার পাওয়া যায়নি');
      return;
    }

    // GUARD: Only office_sell orders should have sale entries — unless allowAnyStatus
    if (!opts?.allowAnyStatus && (order as any).status !== 'office_sell') {
      // If stale entry exists for a non-office_sell order, clean it up
      try { await deleteOfficeSellSaleEntry(orderId); } catch {}
      return;
    }

    // Use explicit amount if provided, otherwise fallback to total (after discount)
    const saleAmount = opts?.amount != null ? opts.amount : Number(order.total);
    if (saleAmount <= 0) return;

    // 2. Find sale account
    const { data: saleAccount } = await (supabase.from('acc_accounts' as any) as any)
      .select('id')
      .eq('type', 'sale')
      .limit(1)
      .single();
    if (!saleAccount) {
      if (!opts?.silent) toast.warning('সেল একাউন্ট পাওয়া যায়নি');
      return;
    }

    // 3. Check existing transaction
    const { data: existing } = await (supabase.from('acc_transactions' as any) as any)
      .select('id, amount')
      .eq('reference_id', orderId)
      .eq('reference_type', 'order')
      .eq('type', 'sale')
      .limit(1);

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const orderNum = order.order_number || '';

    if (existing && existing.length > 0) {
      // Exists — check amount mismatch
      const existingAmount = Number(existing[0].amount);
      if (existingAmount !== saleAmount) {
        // Update the amount
        await (supabase.from('acc_transactions' as any) as any)
          .update({ amount: saleAmount } as any)
          .eq('id', existing[0].id);
        
        // Adjust account balance by delta
        const delta = saleAmount - existingAmount;
        const { data: acc } = await (supabase.from('acc_accounts' as any) as any)
          .select('balance')
          .eq('id', (saleAccount as any).id)
          .single();
        if (acc) {
          const newBalance = Number((acc as any).balance) + delta;
          await (supabase.from('acc_accounts' as any) as any)
            .update({ balance: newBalance } as any)
            .eq('id', (saleAccount as any).id);
        }
        if (!opts?.silent) toast.success('সেল এন্ট্রি আপডেট হয়েছে');
        logAccActivity({
          action: 'update', entity_type: 'transaction',
          entity_id: existing[0].id,
          entity_name: `বিক্রি #${orderNum}`,
          description: `সেল এন্ট্রি আপডেট: ৳${existingAmount} → ৳${saleAmount}`,
          old_data: { amount: existingAmount, orderId },
          new_data: { amount: saleAmount, orderId },
        });
      }
      // else: correct, do nothing
      return;
    }

    // 4. Insert new sale transaction
    const saleSource = opts?.source || 'cash';
    const descPrefix = saleSource === 'bank' ? 'অনলাইন পেমেন্ট' : 'অফিস সেল';
    const desc = orderNum ? `${descPrefix} #${orderNum} — অটো এন্ট্রি` : `${descPrefix} — অটো এন্ট্রি`;
    await (supabase.from('acc_transactions' as any) as any).insert({
      account_id: (saleAccount as any).id,
      type: 'sale',
      amount: saleAmount,
      description: desc,
      reference_id: orderId,
      reference_type: 'order',
      created_by: userId,
      source: saleSource,
      created_at: (order as any).created_at,
    } as any);

    // Update account balance
    const { data: acc } = await (supabase.from('acc_accounts' as any) as any)
      .select('balance')
      .eq('id', (saleAccount as any).id)
      .single();
    if (acc) {
      const newBalance = Number((acc as any).balance) + saleAmount;
      await (supabase.from('acc_accounts' as any) as any)
        .update({ balance: newBalance } as any)
        .eq('id', (saleAccount as any).id);
    }

    if (!opts?.silent) toast.success('সেল একাউন্টে এন্ট্রি হয়েছে');
    logAccActivity({
      action: 'create', entity_type: 'transaction',
      entity_name: `বিক্রি ৳${saleAmount} #${orderNum}`,
      description: desc,
      new_data: { orderId, amount: saleAmount, source: opts?.source || 'cash' },
    });
  } catch (err: any) {
    console.error('ensureOfficeSellSaleEntry error:', err);
    if (!opts?.silent) toast.error('সেল এন্ট্রি ব্যর্থ: ' + (err?.message || 'Unknown error'));
  }
}

/**
 * Deletes the sale entry for an order and reverses the account balance.
 * Used when payment is reset to 'unpaid'.
 */
export async function deleteOfficeSellSaleEntry(orderId: string) {
  // Validate session first
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    toast.error('সেশন শেষ — আবার লগইন করুন');
    throw new Error('No active session');
  }

  // Find existing transaction
  const { data: existing, error: fetchErr } = await (supabase.from('acc_transactions' as any) as any)
    .select('id, amount, account_id, description')
    .eq('reference_id', orderId)
    .eq('reference_type', 'order')
    .eq('type', 'sale');

  if (fetchErr) {
    console.error('deleteOfficeSellSaleEntry fetch error:', fetchErr);
    toast.error('সেল এন্ট্রি খুঁজে পাওয়া যায়নি');
    throw fetchErr;
  }

  if (!existing || existing.length === 0) return;

  for (const tx of existing) {
    // Reverse balance
    const { data: acc, error: accErr } = await (supabase.from('acc_accounts' as any) as any)
      .select('balance')
      .eq('id', tx.account_id)
      .single();
    if (accErr) {
      console.error('deleteOfficeSellSaleEntry balance fetch error:', accErr);
      toast.error('একাউন্ট ব্যালেন্স পাওয়া যায়নি');
      throw accErr;
    }
    if (acc) {
      const newBalance = Number((acc as any).balance) - Number(tx.amount);
      const { error: balanceError } = await (supabase.from('acc_accounts' as any) as any)
        .update({ balance: newBalance } as any)
        .eq('id', tx.account_id);
      if (balanceError) {
        console.error('deleteOfficeSellSaleEntry balance update error:', balanceError);
        toast.error('ব্যালেন্স আপডেট ব্যর্থ');
        throw balanceError;
      }
    }

    // Delete the transaction
    const { error: deleteError } = await (supabase.from('acc_transactions' as any) as any)
      .delete()
      .eq('id', tx.id);
    if (deleteError) {
      console.error('deleteOfficeSellSaleEntry delete error:', deleteError);
      toast.error('সেল এন্ট্রি ডিলিট ব্যর্থ: ' + deleteError.message);
      throw deleteError;
    }

    // Verify deletion actually happened (RLS can silently block deletes)
    const { data: check } = await (supabase.from('acc_transactions' as any) as any)
      .select('id')
      .eq('id', tx.id);
    if (check && check.length > 0) {
      console.error('deleteOfficeSellSaleEntry: row still exists after delete — RLS blocked');
      toast.error('সেল এন্ট্রি ডিলিট হয়নি — অনুমতি সমস্যা');
      throw new Error('Delete blocked by RLS — row still exists');
    }
    // Log deletion to activity log
    logAccActivity({
      action: 'delete', entity_type: 'transaction',
      entity_id: tx.id,
      entity_name: `বিক্রি ৳${tx.amount}`,
      description: `অর্ডার সেল এন্ট্রি ডিলিট — ${tx.description || ''}`,
      old_data: { id: tx.id, amount: tx.amount, account_id: tx.account_id, orderId },
    });
  }

  toast.success('সেল এন্ট্রি মুছে ফেলা হয়েছে');
}

/**
 * Backfill: ensures all paid/partial orders have a bank sale entry in acc_transactions.
 * Idempotent — ensureOfficeSellSaleEntry skips/updates existing entries.
 * Returns number of orders processed (created or updated).
 */
export async function backfillPaidOrderSaleEntries(): Promise<{ processed: number; created: number }> {
  // 1. Fetch all paid/partial orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, paid_amount')
    .in('payment_status', ['paid', 'partial'])
    .gt('paid_amount', 0)
    .is('deleted_at', null);
  if (error || !orders) return { processed: 0, created: 0 };

  if (orders.length === 0) return { processed: 0, created: 0 };

  // 2. Find which already have a sale entry
  const orderIds = orders.map((o: any) => o.id);
  const { data: existing } = await (supabase.from('acc_transactions' as any) as any)
    .select('reference_id')
    .eq('type', 'sale')
    .eq('reference_type', 'order')
    .in('reference_id', orderIds);
  const existingSet = new Set<string>((existing || []).map((e: any) => e.reference_id));

  const missing = orders.filter((o: any) => !existingSet.has(o.id));

  // 3. Create entries for missing ones (sequential to keep balance updates consistent)
  let created = 0;
  for (const o of missing) {
    try {
      await ensureOfficeSellSaleEntry(o.id, {
        source: 'bank',
        amount: Number((o as any).paid_amount),
        silent: true,
        allowAnyStatus: true,
      });
      created++;
    } catch (e) {
      console.warn('Backfill skip', o.id, e);
    }
  }

  return { processed: orders.length, created };
}
