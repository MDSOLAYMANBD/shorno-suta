import { useAdminLang, setAdminLang, type AdminLang } from '@/lib/adminLang';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ lang: AdminLang; short: string }> = [
  { lang: 'bn', short: 'বাং' },
  { lang: 'en', short: 'EN' },
];

/**
 * বাং | EN for the admin (lib/adminLang.ts), the same look as the CORE Shop engine's.
 * `compact` is one round button that switches to the other language (the phone's header).
 * Marked translate="no" so its own labels never change.
 */
export default function AdminLangToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const lang = useAdminLang();
  if (compact) {
    const other = lang === 'bn' ? OPTIONS[1] : OPTIONS[0];
    return (
      <button
        type="button"
        translate="no"
        lang={other.lang}
        onClick={() => setAdminLang(other.lang)}
        aria-label={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
        title={lang === 'bn' ? 'English' : 'বাংলা'}
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-foreground transition-colors hover:bg-primary/10 hover:text-primary',
          className,
        )}
      >
        {other.short}
      </button>
    );
  }
  return (
    <div
      role="group"
      translate="no"
      aria-label="ভাষা / Language"
      className={cn('inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5', className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          aria-pressed={lang === o.lang}
          onClick={() => setAdminLang(o.lang)}
          className={cn(
            'h-full min-w-[2.1rem] rounded-full px-2 text-xs font-bold transition-colors',
            lang === o.lang ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
