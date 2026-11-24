import { Fragment, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { scopeOf, useLang } from '@/lib/i18n';
import { startEnglish, stopEnglish } from '@/lib/pageTranslate';

/**
 * Draws the pages again when the language changes, so text read outside React's state
 * (trNow / nameNow / tx in helpers and lists) follows too. The cart, the signed-in customer
 * and loaded data live above it and stay. It follows the route because the website and the
 * admin each have their own language.
 *
 * On the English website, the texts still written only in Bangla are put in English on the
 * page (lib/pageTranslate.ts).
 */
export default function LangRoot({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { lang } = useLang();
  const site = scopeOf(pathname) === 'shop';
  useEffect(() => {
    if (!site || lang !== 'en') return;
    startEnglish('site');
    return () => stopEnglish('site');
  }, [site, lang]);
  return <Fragment key={lang}>{children}</Fragment>;
}
