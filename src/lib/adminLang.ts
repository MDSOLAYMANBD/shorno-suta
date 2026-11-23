// The admin's language: বাংলা (the admin is written in Bangla) or English, remembered in this
// browser. In English the admin's texts are shown in English by lib/adminTranslate.ts. The
// website (what customers see) stays Bangla either way.
import { useSyncExternalStore } from 'react';

export type AdminLang = 'bn' | 'en';

const KEY = 'admin-lang';
let current: AdminLang | null = null;
const listeners = new Set<() => void>();

function read(): AdminLang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

export function getAdminLang(): AdminLang {
  return (current ??= read());
}

export function setAdminLang(lang: AdminLang) {
  if (getAdminLang() === lang) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* kept for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The admin's language, re-rendering when it changes (here or in another tab). */
export function useAdminLang() {
  return useSyncExternalStore(subscribe, getAdminLang, () => 'bn' as AdminLang);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    current = null;
    listeners.forEach((l) => l());
  });
}
