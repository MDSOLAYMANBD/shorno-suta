import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/utils';
import { useAccounts, useCreateTransaction, useUpdateTransaction } from '@/hooks/useAccounting';
import { usePersons } from '@/hooks/usePersons';
import { sendPartyLedgerSMS } from '@/lib/sms';

/** Convert YYYY-MM-DD date string to ISO timestamp preserving current time. */
function dateStrToIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const time = new Date().toTimeString().slice(0, 8);
  return new Date(`${dateStr}T${time}`).toISOString();
}

export interface SalesPartyPaymentEditTarget {
  id: string;
  account_id: string;
  amount: number;
  source: string | null;
  description: string | null;
  created_at: string;
}

interface SalesPartyPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When known (opened from a specific party's own profile), skip the picker.
  personId?: string;
  personName?: string;
  // Used to auto-SMS the party when a new deposit is recorded — skipped silently if absent.
  personPhone?: string | null;
  // When set, the dialog edits this existing deposit instead of creating a new one.
  editTx?: SalesPartyPaymentEditTarget | null;
  // Label to show in the dialog title — "বিক্রি পার্টি" or "কাজ পার্টি". Defaults to "বিক্রি পার্টি".
  partyLabel?: string;
}

// Records money received FROM a sales party (a customer we sell to on
// credit) against a chosen cash/bank account. Uses type "deposit" — already
// correctly treated as money-in everywhere balances are computed (useCreateTransaction,
// useLiveCashBank) — rather than "party_payment", which is hard-wired as a
// debit (money we pay OUT to a purchase party) across the codebase.
export default function SalesPartyPaymentDialog({ open, onOpenChange, personId, personName, personPhone, editTx, partyLabel = 'বিক্রি পার্টি' }: SalesPartyPaymentDialogProps) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  // Includes both "বিক্রি পার্টি" (office) and "কাজ পার্টি" (factory unit work profiles) —
  // both use the same জমা/deposit flow.
  const { data: allPartyCandidates = [] } = usePersons();
  const salesParties = personId ? [] : (allPartyCandidates as any[]).filter((p) => p.type === 'sales_party' || p.type === 'work_party');

  // Parties from different units/EM/karkhana/print can share similar names,
  // and the flat dropdown gave no way to tell which unit a party belonged
  // to — group by unit (with an "অফিস" bucket for unit_id-less parties) so
  // it's unambiguous which one is being selected. usePersons already joins
  // acc_units(name), no separate unit lookup needed.
  const partiesByUnit = (() => {
    const groups = new Map<string, { label: string; parties: any[] }>();
    for (const p of salesParties as any[]) {
      const key = p.unit_id || '__office__';
      const label = p.unit_id ? (p.acc_units?.name || 'অজানা ইউনিট') : 'অফিস';
      if (!groups.has(key)) groups.set(key, { label, parties: [] });
      groups.get(key)!.parties.push(p);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  })();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const isEdit = !!editTx;

  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [account, setAccount] = useState<'cash' | 'bank'>('cash');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toLocalDateStr());
  const [note, setNote] = useState('');

  const resolvedPersonId = personId || selectedPersonId;
  const selectedParty = personId ? null : (salesParties as any[]).find((p) => p.id === selectedPersonId);
  const resolvedPersonName = personId ? personName : selectedParty?.name;
  const resolvedPersonPhone = personId ? personPhone : selectedParty?.phone;

  const reset = () => {
    setSelectedPersonId('');
    setAccount('cash');
    setAmount('');
    setDate(toLocalDateStr());
    setNote('');
  };

  // Pre-fill the form when opening in edit mode.
  useEffect(() => {
    if (open && editTx) {
      setAccount(editTx.source === 'bank' ? 'bank' : 'cash');
      setAmount(String(editTx.amount));
      setDate(toLocalDateStr(editTx.created_at));
      setNote(editTx.description || '');
    } else if (open && !editTx) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTx]);

  const handleSubmit = async () => {
    if (!resolvedPersonId) { toast.error('একটি পার্টি নির্বাচন করুন'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('সঠিক পরিমাণ দিন'); return; }
    const targetAccount = accounts.find((a: any) => a.type === account);
    if (!targetAccount) { toast.error('একাউন্ট পাওয়া যায়নি'); return; }

    try {
      if (isEdit && editTx) {
        await updateTx.mutateAsync({
          id: editTx.id,
          account_id: editTx.account_id,
          type: 'deposit',
          oldAmount: editTx.amount,
          newAmount: amt,
          newDescription: note || `জমা গ্রহণ — ${resolvedPersonName || ''}`,
          newAccountId: targetAccount.id,
          oldSource: editTx.source || 'cash',
          newSource: account,
          newCreatedAt: dateStrToIso(date),
          oldPersonName: resolvedPersonName,
          newPersonName: resolvedPersonName,
        });
        toast.success('জমা আপডেট হয়েছে');
      } else {
        await createTx.mutateAsync({
          account_id: targetAccount.id,
          person_id: resolvedPersonId,
          type: 'deposit',
          amount: amt,
          description: note || `জমা গ্রহণ — ${resolvedPersonName || ''}`,
          source: account,
          created_at: dateStrToIso(date),
          person_name: resolvedPersonName,
        });
        toast.success('জমা রেকর্ড হয়েছে');

        // Auto-SMS the party the moment a payment is recorded — not on edits,
        // and silently skipped when there's no phone on file for them.
        if (resolvedPersonPhone) {
          const msg = `${resolvedPersonName || ''}, আপনাকে ৳${amt.toLocaleString('bn-BD')} জমা/পেমেন্ট দেওয়া হয়েছে (${date})।${note ? ' ' + note : ''} — স্বর্ণ সুতা`;
          sendPartyLedgerSMS(resolvedPersonPhone, msg).catch((e) => console.error('[SalesPartyPaymentDialog] SMS failed', e));
        }
      }
      qc.invalidateQueries({ queryKey: ['person-expense-txns', resolvedPersonId] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'সমস্যা হয়েছে');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? '✏️ জমা এডিট করুন' : `💰 ${partyLabel} থেকে জমা নিন`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!personId && !isEdit && (
            <div>
              <Label>পার্টি নির্বাচন করুন</Label>
              <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {partiesByUnit.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.parties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>জমা হবে</Label>
              <Select value={account} onValueChange={(v) => setAccount(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">ক্যাশ</SelectItem>
                  <SelectItem value="bank">ব্যাংক</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>পরিমাণ (৳)</Label>
              <Input
                type="text" inputMode="numeric"
                value={amount ? Number(amount).toLocaleString() : ''}
                onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*$/.test(raw)) setAmount(raw); }}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label>📅 তারিখ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>বিবরণ (ঐচ্ছিক)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট..." />
          </div>
          <Button onClick={handleSubmit} disabled={createTx.isPending || updateTx.isPending} className="w-full">
            {createTx.isPending || updateTx.isPending ? 'প্রসেস হচ্ছে...' : isEdit ? 'আপডেট করুন' : 'জমা নিন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
