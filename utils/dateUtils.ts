const LOCALE_MAP: Record<string, string> = {
  ar: "ar-EG",
  en: "en-US",
  ur: "ur-PK",
  hi: "hi-IN",
  bn: "bn-BD",
};

export function fmtDate(iso: string, lang = "ar"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const locale = LOCALE_MAP[lang] || "ar-EG";
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string, lang = "ar"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const locale = LOCALE_MAP[lang] || "ar-EG";
  return d.toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function fmtCurrency(n: number): string {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

/**
 * Local calendar day as YYYY-MM-DD. Use this for "today" filters —
 * `toISOString().slice(0, 10)` is the UTC day, which in Saudi Arabia (UTC+3)
 * puts orders made between 00:00 and 02:59 on the previous day.
 */
export function localDayKey(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** True when an ISO timestamp falls on the current local day. */
export function isLocalToday(iso?: string): boolean {
  return !!iso && localDayKey(iso) === localDayKey();
}
