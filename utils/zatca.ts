/**
 * Saudi simplified tax invoice (ZATCA / Fatoora phase 1 "generation" requirements):
 * seller name, VAT number, date-time, total incl. VAT and the VAT amount, plus the
 * QR code that encodes those five fields as base64 TLV.
 *
 * Shop prices shown to consumers in KSA must already include VAT, so the VAT is
 * extracted from the amount paid (VAT = taxable × rate / (100 + rate)).
 * Refundable deposits (tray insurance) are not a supply and are left out of the tax.
 * Pure TS — shared by the app and tests.
 */

export const DEFAULT_VAT_RATE = 15;

export interface TaxProfile {
  enabled: boolean;
  /** Seller name exactly as registered with ZATCA. */
  sellerName: string;
  /** 15 digits, starts and ends with 3. */
  vatNumber: string;
  vatRate: number;
  crNumber?: string;
  address?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const EMPTY_TAX_PROFILE: TaxProfile = { enabled: false, sellerName: "", vatNumber: "", vatRate: DEFAULT_VAT_RATE };

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const toLatinDigits = (s: string) => s.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));

export function normalizeVatNumber(raw: string | undefined | null): string {
  return toLatinDigits(String(raw ?? "")).replace(/\D/g, "");
}

export function isValidVatNumber(raw: string): boolean {
  return /^3\d{13}3$/.test(normalizeVatNumber(raw));
}

export type TaxProfileError = "seller_required" | "vat_invalid" | "rate_invalid";

export function taxProfileError(p: TaxProfile): TaxProfileError | null {
  if (!p.enabled) return null;
  if (!p.sellerName.trim()) return "seller_required";
  if (!isValidVatNumber(p.vatNumber)) return "vat_invalid";
  if (!(p.vatRate > 0 && p.vatRate <= 100)) return "rate_invalid";
  return null;
}

export function normalizeTaxProfile(raw: Partial<TaxProfile> | null | undefined): TaxProfile {
  const rate = Number(raw?.vatRate);
  return {
    enabled: Boolean(raw?.enabled),
    sellerName: String(raw?.sellerName ?? "").trim().slice(0, 120),
    vatNumber: normalizeVatNumber(raw?.vatNumber).slice(0, 15),
    vatRate: rate > 0 && rate <= 100 ? rate : DEFAULT_VAT_RATE,
    crNumber: toLatinDigits(String(raw?.crNumber ?? "")).replace(/\D/g, "").slice(0, 10) || undefined,
    address: String(raw?.address ?? "").trim().slice(0, 200) || undefined,
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface VatBreakdown {
  /** What the customer pays for goods, VAT included. */
  totalWithVat: number;
  vat: number;
  totalWithoutVat: number;
  /** Refundable deposit outside the tax base. */
  deposit: number;
}

export function vatBreakdown(totalPaid: number, deposit = 0, rate = DEFAULT_VAT_RATE): VatBreakdown {
  const dep = Math.max(0, round2(deposit || 0));
  const taxable = Math.max(0, round2((totalPaid || 0) - dep));
  const vat = round2((taxable * rate) / (100 + rate));
  return { totalWithVat: taxable, vat, totalWithoutVat: round2(taxable - vat), deposit: dep };
}

function utf8(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function tlv(tag: number, value: string): number[] {
  const bytes = utf8(value);
  if (bytes.length > 255) throw new Error("tlv_too_long");
  return [tag, bytes.length, ...bytes];
}

function toBase64(bytes: number[]): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[n & 63] : "=";
  }
  return out;
}

/** ISO 8601 in UTC without milliseconds, e.g. 2026-11-01T09:30:00Z. */
export function zatcaTimestamp(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const t = isNaN(date.getTime()) ? new Date() : date;
  return t.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Base64 TLV payload for the invoice QR (tags 1–5). */
export function zatcaQrPayload(p: { sellerName: string; vatNumber: string; timestamp: Date | string; totalWithVat: number; vat: number }): string {
  return toBase64([
    ...tlv(1, p.sellerName.trim()),
    ...tlv(2, normalizeVatNumber(p.vatNumber)),
    ...tlv(3, zatcaTimestamp(p.timestamp)),
    ...tlv(4, p.totalWithVat.toFixed(2)),
    ...tlv(5, p.vat.toFixed(2)),
  ]);
}

/** Reads a payload back (used by tests and the in-app checker). */
export function decodeZatcaQr(b64: string): Record<number, string> {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const out: Record<number, string> = {};
  for (let i = 0; i + 1 < bytes.length; ) {
    const tag = bytes[i], len = bytes[i + 1];
    out[tag] = new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len));
    i += 2 + len;
  }
  return out;
}
