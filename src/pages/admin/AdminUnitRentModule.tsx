import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Home, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUnits } from '@/hooks/useAccounting';
import { useRentUnitSummary, useRentPayments, useDeleteRentPayment } from '@/hooks/useRent';
import RentCard from '@/components/admin/accounting/RentCard';
import PayRentDialog from '@/components/admin/accounting/PayRentDialog';

const BANGLA_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

export default function AdminUnitRentModule() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const unit = useMemo(() => units.find(u => u.id === unitId), [units, unitId]);
  const settings = unit?.settings || {};
  const rentAmount = Number(settings.rent_amount || 0);
  const rentStartDate: string | null = settings.rent_start_date || null;

  const summary = useRentUnitSummary(unitId, rentAmount, rentStartDate);
  const { data: payments = [] } = useRentPayments(unitId);
  const deletePayment = useDeleteRentPayment();

  const [payOpen, setPayOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId || !unitId) return;
    try {
      await deletePayment.mutateAsync({ id: deleteId, unit_id: unitId });
      toast.success('পেমেন্ট ডিলিট হয়েছে — হিসাব ফিরিয়ে দেওয়া হয়েছে');
      setDeleteId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/accounting/units/${unitId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <div className="text-sm text-muted-foreground">{unit?.name} — ভাড়া</div>
      </div>

      {!settings.has_rent || !rentStartDate ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            এই ইউনিটের জন্য ভাড়া হিসাব এখনো সেটআপ করা হয়নি। "হিসাব সেটিংস" পেজে গিয়ে এই ইউনিটের এডিটে "ভাড়া" চালু করে মাসিক ভাড়া ও শুরুর মাস দিন।
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <RentCard unitId={unitId!} rentAmount={rentAmount} rentStartDate={rentStartDate} onPayClick={() => setPayOpen(true)} />
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Home className="h-4 w-4" /> মাস অনুযায়ী হিসাব</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {summary.rows.slice().reverse().map(r => (
                    <div key={`${r.year}-${r.month}`} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${r.due > 0 ? 'bg-destructive/5' : 'bg-green-50 dark:bg-green-950/20'}`}>
                      <span>{BANGLA_MONTHS[r.month - 1]} {r.year}</span>
                      <span className="text-muted-foreground">৳{r.rentAmount.toLocaleString('bn-BD')}</span>
                      <span className={r.due > 0 ? 'text-destructive font-medium' : 'text-green-700 dark:text-green-400 font-medium'}>
                        {r.due > 0 ? `বাকি ৳${r.due.toLocaleString('bn-BD')}` : 'পরিশোধিত'}
                      </span>
                    </div>
                  ))}
                  {summary.rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">কোনো মাস নেই</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">পেমেন্ট হিস্টোরি</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">কোনো পেমেন্ট নেই</p>
              ) : (
                <div className="space-y-1">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50">
                      <span>{new Date(p.payment_date + 'T12:00:00').toLocaleDateString('bn-BD')}</span>
                      <span className="text-muted-foreground capitalize">{p.source === 'bank' ? 'ব্যাংক' : 'ক্যাশ'}</span>
                      <span className="text-muted-foreground flex-1 min-w-0 mx-2 truncate">{p.note || (p.allocations || []).map(a => `${a.month}/${a.year}`).join(', ')}</span>
                      <span className="font-medium">৳{Number(p.amount).toLocaleString('bn-BD')}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 ml-1 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <PayRentDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            unitId={unitId || null}
            unitName={unit?.name}
            rentAmount={rentAmount}
            rentStartDate={rentStartDate}
          />
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পেমেন্টটি ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              এই পেমেন্টটি মুছে গেলে সংশ্লিষ্ট মাসগুলোর "পরিশোধিত" পরিমাণ এবং ক্যাশ/ব্যাংক ব্যালেন্স আগের অবস্থায় ফিরে যাবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              ডিলিট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
