import { Link } from 'react-router-dom';
import { Lock, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBnDate, formatTaka, type CoreStatus } from '@/lib/coreConnect';

/**
 * Shown in place of every admin page while CORE has locked the panel for an unpaid
 * bill. Only the Billing page stays open, so the bill can be paid; paying (once CORE
 * approves it) unlocks the panel at once.
 */
export default function CoreLockScreen({ core }: { core: CoreStatus }) {
  const billing = core.billing;
  const support = core.support;
  const whatsapp = support?.whatsapp?.replace(/\D/g, '');

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-lg rounded-3xl border border-destructive/20 bg-background p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">অ্যাডমিন প্যানেল লক করা হয়েছে</h1>
        <p className="mt-3 text-muted-foreground">
          মাসিক বিল নির্ধারিত সময়ের মধ্যে পরিশোধ না হওয়ায় প্যানেলটি লক হয়েছে। বিল পরিশোধ হলেই সাথে সাথে আবার চালু হবে।
          আপনার ওয়েবসাইট কাস্টমারদের জন্য চালু আছে।
        </p>

        {core.can_pay && billing?.due_amount ? (
          <div className="mt-6 rounded-2xl bg-muted/60 p-4">
            <div className="text-sm text-muted-foreground">বকেয়া বিল</div>
            <div className="mt-1 text-3xl font-bold text-destructive">{formatTaka(billing.due_amount)}</div>
            {billing.next_due_date && (
              <div className="mt-1 text-xs text-muted-foreground">শেষ তারিখ ছিল {formatBnDate(billing.next_due_date)}</div>
            )}
          </div>
        ) : null}

        {core.can_pay ? (
          <Button asChild size="lg" className="mt-6 w-full">
            <Link to="/admin/billing">এখনই বিল পরিশোধ করুন</Link>
          </Button>
        ) : (
          <p className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm font-medium">
            প্যানেল চালু করতে আপনার অ্যাডমিনকে বিল পরিশোধ করতে বলুন।
          </p>
        )}

        {support && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>সাহায্য দরকার? CORE Automation:</span>
            <a href={`tel:${support.phone}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
              <Phone className="h-4 w-4" /> {support.phone}
            </a>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
