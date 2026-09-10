import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PolicyAgreementProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}

export default function PolicyAgreement({ checked, onChange, className }: PolicyAgreementProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 sm:px-4 sm:py-3',
        className
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center border-2 transition-all',
          checked
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background hover:border-primary/60'
        )}
      >
        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <label
        onClick={() => onChange(!checked)}
        className="text-xs sm:text-sm leading-relaxed cursor-pointer select-none break-words min-w-0 flex-1"
      >
        আমি{' '}
        <a
          href="/terms-and-conditions"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-primary hover:underline"
        >
          Terms and Conditions
        </a>
        ,{' '}
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-primary hover:underline"
        >
          Privacy Policy
        </a>{' '}
        ও{' '}
        <a
          href="/return-policy"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-primary hover:underline"
        >
          Refund and Return Policy
        </a>{' '}
        পড়েছি এবং সম্মত আছি।
      </label>
    </div>
  );
}
