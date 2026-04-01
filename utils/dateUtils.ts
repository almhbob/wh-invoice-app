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
