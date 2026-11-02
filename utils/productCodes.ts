/**
 * Product codes: barcodes (EAN-13 / EAN-8 / UPC-A / Code128…) and the shop's own
 * item numbers (SKU). Pure TS — shared by the app and tests.
 */

export interface CodedProduct {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  isAvailable?: boolean;
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Same code however it was typed: Arabic-Indic digits, spaces, dashes, letter case. */
export function normalizeCode(raw: string | undefined | null): string {
  return String(raw ?? "")
    .replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

/** "3*6281000000123" or "3x…" → 3 of that code. Quantity 1–999. */
export function parseScanInput(raw: string): { code: string; qty: number } {
  const t = String(raw ?? "").replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10)).trim();
  const m = t.match(/^(\d{1,3})\s*[*xX×]\s*(.+)$/);
  if (m) {
    const qty = Math.min(999, Math.max(1, parseInt(m[1], 10)));
    return { code: normalizeCode(m[2]), qty };
  }
  return { code: normalizeCode(t), qty: 1 };
}

function checkDigit(body: string): number {
  // GS1: weights 3,1,3,1… from the right of the body.
  let sum = 0;
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w;
  return (10 - (sum % 10)) % 10;
}

/** True for a numeric GS1 code (EAN-8, UPC-A, EAN-13, GTIN-14) whose check digit is right. */
export function isValidGtin(code: string): boolean {
  const c = normalizeCode(code);
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return false;
  return checkDigit(c.slice(0, -1)) === Number(c[c.length - 1]);
}

/** A warning for a code that looks like a retail barcode but fails its check digit. */
export function barcodeWarning(code: string): "check_digit" | null {
  const c = normalizeCode(code);
  if (/^\d+$/.test(c) && [8, 12, 13, 14].includes(c.length) && !isValidGtin(c)) return "check_digit";
  return null;
}

/**
 * A new in-store EAN-13 (GS1 prefix 2x is reserved for internal use), unique among `taken`.
 * `seed` makes it deterministic in tests.
 */
export function generateInternalBarcode(taken: Iterable<string>, seed = Date.now()): string {
  const used = new Set([...taken].map(normalizeCode));
  let n = Math.abs(Math.floor(seed)) % 1e10;
  for (let tries = 0; tries < 1000; tries++, n = (n * 7919 + 104729) % 1e10) {
    const body = "20" + String(n).padStart(10, "0");
    const code = body + checkDigit(body);
    if (!used.has(code)) return code;
  }
  throw new Error("no_free_code");
}

/** Exact match on barcode first, then SKU. Unavailable products are still found (the caller decides). */
export function findProductByCode<T extends CodedProduct>(products: T[], raw: string): T | null {
  const code = normalizeCode(raw);
  if (!code) return null;
  return (
    products.find((p) => p.barcode && normalizeCode(p.barcode) === code) ??
    products.find((p) => p.sku && normalizeCode(p.sku) === code) ??
    null
  );
}

/** Suggestions while typing: code prefix, or name containing the text. */
export function searchProducts<T extends CodedProduct>(products: T[], raw: string, limit = 6): T[] {
  const q = String(raw ?? "").trim();
  if (!q) return [];
  const code = normalizeCode(q);
  const low = q.toLowerCase();
  const scored: { p: T; s: number }[] = [];
  for (const p of products) {
    const b = normalizeCode(p.barcode);
    const k = normalizeCode(p.sku);
    let s = 0;
    if (code && (b === code || k === code)) s = 100;
    else if (code.length >= 2 && (b.startsWith(code) || k.startsWith(code))) s = 60;
    else if (p.name.toLowerCase().includes(low)) s = 30;
    if (s) scored.push({ p, s: s + (p.isAvailable === false ? -10 : 0) });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.p);
}

/** Another product already using this barcode or SKU (for the product form). */
export function codeConflict<T extends CodedProduct>(products: T[], selfId: string | undefined, raw: string): T | null {
  const code = normalizeCode(raw);
  if (!code) return null;
  return products.find((p) => p.id !== selfId && (normalizeCode(p.barcode) === code || normalizeCode(p.sku) === code)) ?? null;
}
