import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize BD phone: Bengali digits → English, strip spaces/dashes, remove 88/880 prefix → 01XXXXXXXXX */
export function normalizeBDPhone(raw: string): string {
  const bnDigits = '০১২৩৪৫৬৭৮৯';
  let s = raw.replace(/[০-৯]/g, d => String(bnDigits.indexOf(d)));
  s = s.replace(/[^0-9]/g, '');
  if (s.startsWith('880')) s = '0' + s.substring(3);
  else if (s.startsWith('88') && s.length > 2 && s[2] === '0') s = s.substring(2);
  return s;
}

/** Returns today's date as YYYY-MM-DD in the user's local timezone */
export function toLocalDateStr(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
