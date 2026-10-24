import type { Lang } from "@/constants/translations";
import { UI_DICTIONARY } from "@/constants/uiDictionary";

/**
 * Lightweight translation for operational screens.
 *
 *   tr("بدء التحضير", "Start preparing")
 *
 * Arabic is the source text and the dictionary key; English is given inline;
 * Urdu, Hindi and Bengali come from constants/uiDictionary.ts (falling back to
 * English). The current language is set by LanguageProvider on every render.
 */

let current: Lang = "ar";

export function setCurrentLang(lang: Lang) {
  current = lang;
}

export function currentLang(): Lang {
  return current;
}

export function tr(ar: string, en?: string): string {
  if (current === "ar") return ar;
  const entry = UI_DICTIONARY[ar];
  if (current === "en") return en ?? entry?.en ?? ar;
  return entry?.[current] ?? en ?? entry?.en ?? ar;
}

/** Same as tr() with {placeholders}: trf("{n} طلب", "{n} orders", { n: 3 }). */
export function trf(ar: string, en: string, vars: Record<string, string | number>): string {
  return tr(ar, en).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
