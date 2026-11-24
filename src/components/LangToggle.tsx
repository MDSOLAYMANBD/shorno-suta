import { useLocation } from 'react-router-dom';
import { scopeOf, useLang, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ lang: Lang; short: string; long: string }> = [
  { lang: 'bn', short: 'বাং', long: 'বাংলা' },
  { lang: 'en', short: 'EN', long: 'English' },
];

/**
 * বাংলা | English for the website (lib/i18n.ts); the admin and the reseller panel stay Bangla.
 * `wide` spells the names out (menus); `compact` is one round button that switches to the
 * other language (phone headers); the default is the small pill for headers. Its own names
 * never change (translate="no": lib/pageTranslate.ts leaves them).
 */
export default function LangToggle({ wide = false, compact = false, className }: { wide?: boolean; compact?: boolean; className?: string }) {
  const { lang, setLang } = useLang();
  // pages that stay in Bangla (landing pages …) have no switch
  const { pathname } = useLocation();
  if (scopeOf(pathname) !== 'shop') return null;
  if (compact) {
    const other = lang === 'bn' ? OPTIONS[1] : OPTIONS[0];
    return (
      <button
        type="button"
        translate="no"
        lang={other.lang}
        onClick={() => setLang(other.lang)}
        aria-label={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
        title={lang === 'bn' ? 'English' : 'বাংলা'}
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-muted/60 text-[13px] font-bold text-foreground transition-colors hover:border-primary/45 hover:bg-primary/10 hover:text-primary',
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
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5',
        wide ? 'h-10 w-full' : 'h-9',
        className,
      )}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          aria-pressed={lang === o.lang}
          onClick={() => setLang(o.lang)}
          className={cn(
            'h-full rounded-full text-xs font-bold transition-colors',
            wide ? 'flex-1 text-sm' : 'min-w-[2.1rem] px-2',
            lang === o.lang ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {wide ? o.long : o.short}
        </button>
      ))}
    </div>
  );
}
