import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBnDate, formatTaka, type CoreStatus } from '@/lib/coreConnect';

/** The sidebar card while a CORE bill is open: how much, by when, and when the panel would lock. */
export default function CoreBillingNotice({ core, onNavigate }: { core?: CoreStatus; onNavigate?: () => void }) {
  const billing = core?.billing;
  if (!core?.connected || !billing || billing.status === 'active') return null;

  const overdue = billing.status !== 'due';
  const title =
    billing.status === 'locked'
      ? 'প্যানেল লক: বিল বাকি'
      : overdue
        ? 'বিলের তারিখ পার হয়ে গেছে!'
        : `${formatTaka(billing.due_amount)} বিল পরিশোধ করুন`;
  const detail =
    billing.status === 'locked'
      ? 'পরিশোধ করলেই চালু হবে →'
      : overdue && billing.lock_date
        ? `${formatBnDate(billing.lock_date)} প্যানেল লক হবে →`
        : billing.next_due_date
          ? `শেষ তারিখ ${formatBnDate(billing.next_due_date)} →`
          : 'বিল দেখুন →';

  const card = (
    <div className="flex items-center gap-3">
      <Crown className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-[11px] text-white/90">{core.can_pay ? detail : 'অ্যাডমিনকে বিল পরিশোধ করতে বলুন'}</p>
      </div>
    </div>
  );
  const className = cn(
    'block mx-1 mb-3 p-3 rounded-xl shadow-lg text-white transition-all duration-300',
    overdue ? 'bg-gradient-to-r from-red-600 to-rose-700 animate-pulse' : 'bg-gradient-to-r from-amber-500 to-orange-600',
    core.can_pay && 'hover:shadow-xl hover:scale-[1.02]',
  );

  return core.can_pay ? (
    <Link to="/admin/billing" onClick={onNavigate} className={className}>
      {card}
    </Link>
  ) : (
    <div className={className}>{card}</div>
  );
}
