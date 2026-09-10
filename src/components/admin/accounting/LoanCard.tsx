import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, Calendar, CheckCircle2, ChevronDown, ChevronUp, MoreVertical, Power, Trash2 } from 'lucide-react';
import type { AccLoan } from '@/hooks/useLoans';
import { useLoanPayments, useDeleteLoanPayment } from '@/hooks/useLoans';
import { computeAccruedInterest, elapsedMonths } from '@/lib/loanInterest';
import { toast } from 'sonner';

interface Props {
  loan: AccLoan & { tracking_start_date?: string | null };
  paymentCount: { count: number; totalPaid: number };
  expanded?: boolean;
  onPayClick?: () => void;
  onToggleHistory?: () => void;
  onToggleStatus?: () => void;
  onDelete?: () => void;
  extraActions?: React.ReactNode;
}

function LoanDetailPanel({ loanId }: { loanId: string }) {
  const { data: payments = [] } = useLoanPayments(loanId);
  const deletePayment = useDeleteLoanPayment();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deletePayment.mutateAsync({ id, loan_id: loanId });
      toast.success('পেমেন্ট ডিলিট হয়েছে — হিসাব ফিরিয়ে দেওয়া হয়েছে');
      setConfirmId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  if (payments.length === 0) return <p className="text-xs text-muted-foreground py-2">কোনো পেমেন্ট নেই</p>;
  return (
    <div className="space-y-1 mt-2">
      {payments.map(p => (
        <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
          <span>{new Date(p.payment_date).toLocaleDateString('bn-BD')}</span>
          <span className="capitalize">{p.payment_source}</span>
          <span className="font-medium">৳{Number(p.amount).toLocaleString('bn-BD')}</span>
          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive shrink-0" onClick={() => setConfirmId(p.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <AlertDialog open={!!confirmId} onOpenChange={(o) => { if (!o) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পেমেন্টটি ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              এই পেমেন্টটি মুছে গেলে ক্যাশ/ব্যাংক ব্যালেন্স আগের অবস্থায় ফিরে যাবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmId && handleDelete(confirmId)}>
              ডিলিট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function LoanCard({ loan, paymentCount: pc, expanded, onPayClick, onToggleHistory, onToggleStatus, onDelete, extraActions }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const principal = Number(loan.principal_amount) || 0;
  const totalPaid = Number(pc.totalPaid) || 0;
  const isFlatInterest = loan.interest_type === 'monthly_flat' && Number(loan.monthly_interest_amount) > 0;
  const accruedInterest = isFlatInterest ? computeAccruedInterest(loan) : 0;
  const monthsElapsed = isFlatInterest ? elapsedMonths(loan.start_date) : 0;
  const totalOwed = principal + accruedInterest;
  const remainingAmount = Math.max(0, totalOwed - totalPaid);
  const progressPercent = totalOwed > 0 ? Math.min(100, (totalPaid / totalOwed) * 100) : 0;
  const hasInstallments = (loan.total_installments || 0) > 0;
  const installmentsLeft = hasInstallments ? Math.max(0, loan.total_installments - pc.count) : 0;
  const totalInterest = hasInstallments
    ? (loan.monthly_installment * loan.total_installments) - principal
    : 0;
  const startDateStr = (() => {
    try { return new Date((loan.start_date || '') + 'T12:00:00').toLocaleDateString('bn-BD'); }
    catch { return loan.start_date || ''; }
  })();
  const nextDue = hasInstallments ? (() => {
    const base = (loan as any).tracking_start_date || loan.start_date;
    const d = new Date(base + 'T12:00:00');
    d.setMonth(d.getMonth() + pc.count);
    return d;
  })() : null;
  const isOverdue = nextDue && nextDue < new Date() && loan.status === 'active' && installmentsLeft > 0;
  const hasPayments = pc.count > 0;
  const canPay = loan.status === 'active' && remainingAmount > 0;

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm flex items-center gap-1.5">
            {loan.name}
            {loan.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={loan.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
              {loan.status === 'active' ? 'সক্রিয়' : loan.status === 'closed' ? 'বন্ধ' : 'সম্পন্ন'}
            </Badge>
            {(onToggleStatus || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {onToggleStatus && (
                    <DropdownMenuItem onClick={onToggleStatus}>
                      <Power className="h-3.5 w-3.5 mr-2" />
                      {loan.status === 'active' ? 'বন্ধ করুন' : 'চালু করুন'}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        ডিলিট করুন
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>মূলধন: <span className="font-medium text-foreground">৳{principal.toLocaleString('bn-BD')}</span></div>
          <div>সুদ: <span className="font-medium text-foreground">{isFlatInterest ? `৳${Number(loan.monthly_interest_amount).toLocaleString('bn-BD')}/মাস` : `${loan.interest_rate}%`}</span></div>
          <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /><span className="font-medium text-foreground">{startDateStr}</span></div>
        </div>

        {isFlatInterest && (
          <div className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-950/20 rounded p-2">
            <span className="text-muted-foreground">
              সুদ জমেছে ({monthsElapsed} মাস {loan.status === 'active' ? '— চলমান' : ''})
            </span>
            <span className="font-bold text-amber-700 dark:text-amber-500">৳{accruedInterest.toLocaleString('bn-BD')}</span>
          </div>
        )}

        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs">
          <span>
            {hasInstallments
              ? `${pc.count}/${loan.total_installments} কিস্তি`
              : `পরিশোধিত: ৳${totalPaid.toLocaleString('bn-BD')}`}
          </span>
          <span className="font-medium">বাকি (আসল{isFlatInterest ? '+সুদ' : ''}): ৳{remainingAmount.toLocaleString('bn-BD')}</span>
        </div>

        {(hasInstallments || nextDue) && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/50 rounded p-2">
              <div className="text-muted-foreground">মোট সুদ</div>
              <div className="font-bold text-destructive">৳{totalInterest.toLocaleString('bn-BD')}</div>
            </div>
            {nextDue && (
              <div className={`rounded p-2 ${isOverdue ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                <div className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> পরবর্তী কিস্তি
                </div>
                <div className={`font-bold ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                  {installmentsLeft > 0 ? nextDue.toLocaleDateString('bn-BD') : 'সম্পন্ন'}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {canPay && onPayClick && (
            <Button size="sm" variant="default" className="flex-1 h-7 text-xs" onClick={onPayClick}>
              <CreditCard className="h-3 w-3 mr-1" /> পরিশোধ করুন
            </Button>
          )}
          {onToggleHistory && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onToggleHistory}>
              {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              হিস্টোরি
            </Button>
          )}
          {extraActions}
        </div>

        {expanded && <LoanDetailPanel loanId={loan.id} />}
      </CardContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ঋণটি ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{loan.name}</strong> ঋণটি সম্পূর্ণরূপে মুছে যাবে।
              {hasPayments && (
                <span className="block mt-2 text-destructive">
                  ⚠️ এই ঋণে {pc.count}টি পেমেন্ট রয়েছে। সেগুলোও মুছে যাবে। বরং "বন্ধ করুন" ব্যবহার করার পরামর্শ দেওয়া হচ্ছে।
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onDelete?.(); setConfirmDelete(false); }}
            >
              ডিলিট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
