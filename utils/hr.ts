/**
 * Staff records for the company admin: residency (iqama), passport and health
 * certificate expiry reminders, and a monthly payroll tracker.
 * Pure TS — shared by the app and tests.
 */

export const DEFAULT_WARN_DAYS = 10;

export type DocKind = "iqama" | "passport" | "health" | "contract";
export const DOC_KINDS: DocKind[] = ["iqama", "passport", "health", "contract"];

export interface HrWorker {
  id: string;
  name: string;
  /** Linked app employee (optional). */
  employeeId?: string;
  jobTitle?: string;
  nationality?: string;
  phone?: string;
  iqamaNumber?: string;
  iqamaExpiry?: string;      // YYYY-MM-DD
  passportNumber?: string;
  passportExpiry?: string;
  healthExpiry?: string;     // municipal health certificate
  contractExpiry?: string;
  basicSalary: number;
  housing: number;
  transport: number;
  otherAllowance: number;
  bankIban?: string;
  startDate?: string;
  active: boolean;
  notes?: string;
  /** Document renewals, newest last (recorded when an expiry date moves forward). */
  renewals?: RenewalEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RenewalEntry {
  kind: DocKind;
  /** Previous expiry (YYYY-MM-DD), when there was one. */
  from?: string;
  /** New expiry (YYYY-MM-DD). */
  to: string;
  /** When the renewal was recorded (ISO). */
  at: string;
}

export const EXPIRY_FIELD: Record<DocKind, keyof HrWorker> = {
  iqama: "iqamaExpiry",
  passport: "passportExpiry",
  health: "healthExpiry",
  contract: "contractExpiry",
};

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const latin = (s: string) => s.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));

/** Accepts 2026-11-20, 2026/11/20, 20/11/2026, 20-11-2026, Arabic digits. "" when invalid. */
export function parseDateInput(raw: string | undefined | null): string {
  const t = latin(String(raw ?? "")).trim().replace(/[.\s]/g, "-").replace(/\//g, "-");
  let y: number, m: number, d: number;
  let mm = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mm) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
  else if ((mm = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) { d = +mm[1]; m = +mm[2]; y = +mm[3]; }
  else return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 2000 || y > 2100) return "";
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `today` (YYYY-MM-DD) until `date`; negative when past. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000);
}

export type ExpiryState = "expired" | "soon" | "ok" | "missing";

export function expiryState(date: string | undefined, today: string, warnDays = DEFAULT_WARN_DAYS): ExpiryState {
  if (!date) return "missing";
  const n = daysUntil(date, today);
  if (n < 0) return "expired";
  if (n <= warnDays) return "soon";
  return "ok";
}

export interface ExpiryAlert {
  workerId: string;
  name: string;
  kind: DocKind;
  date: string;
  days: number;
  state: "expired" | "soon";
}

/** Documents already expired or expiring within `warnDays`, most urgent first. */
export function expiryAlerts(workers: HrWorker[], today: string, warnDays = DEFAULT_WARN_DAYS): ExpiryAlert[] {
  const out: ExpiryAlert[] = [];
  for (const w of workers) {
    if (!w.active) continue;
    for (const kind of DOC_KINDS) {
      const date = w[EXPIRY_FIELD[kind]] as string | undefined;
      const st = expiryState(date, today, warnDays);
      if (st === "expired" || st === "soon") out.push({ workerId: w.id, name: w.name, kind, date: date!, days: daysUntil(date!, today), state: st });
    }
  }
  return out.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, "ar"));
}

export const isValidIqama = (n: string) => /^[12]\d{9}$/.test(latin(n).replace(/\s/g, ""));

const money = (n: unknown) => {
  const v = Math.round(Number(latin(String(n ?? "0")).replace(/[^\d.]/g, "")) * 100) / 100;
  return Number.isFinite(v) && v >= 0 ? Math.min(v, 1_000_000) : 0;
};
export const toMoney = money;

export function monthlyGross(w: Pick<HrWorker, "basicSalary" | "housing" | "transport" | "otherAllowance">) {
  return money(w.basicSalary) + money(w.housing) + money(w.transport) + money(w.otherAllowance);
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export interface PayrollLine {
  id: string;            // `${month}_${workerId}`
  month: string;         // YYYY-MM
  workerId: string;
  name: string;
  basic: number;
  allowances: number;
  additions: number;     // overtime, bonus
  deductions: number;    // absence, penalties
  advance: number;       // salary advance recovered this month
  net: number;
  status: "unpaid" | "paid";
  paidAt?: string;
  method?: "cash" | "transfer";
  note?: string;
  updatedAt?: string;
}

export function monthKey(d: Date = new Date()): string {
  const t = new Date(d.getTime() + 3 * 3600_000); // Riyadh
  return t.toISOString().slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + by, 1));
  return dt.toISOString().slice(0, 7);
}

export function payrollId(month: string, workerId: string) {
  return `${month}_${workerId}`;
}

export function computeNet(l: Pick<PayrollLine, "basic" | "allowances" | "additions" | "deductions" | "advance">): number {
  return Math.round((money(l.basic) + money(l.allowances) + money(l.additions) - money(l.deductions) - money(l.advance)) * 100) / 100;
}

/** A fresh line for a worker from their current salary. */
export function newPayrollLine(w: HrWorker, month: string): PayrollLine {
  const basic = money(w.basicSalary);
  const allowances = money(w.housing) + money(w.transport) + money(w.otherAllowance);
  const line = { basic, allowances, additions: 0, deductions: 0, advance: 0 };
  return { id: payrollId(month, w.id), month, workerId: w.id, name: w.name, ...line, net: computeNet(line), status: "unpaid" };
}

export function payrollTotals(lines: PayrollLine[]) {
  const sum = (f: (l: PayrollLine) => number) => Math.round(lines.reduce((s, l) => s + f(l), 0) * 100) / 100;
  return {
    count: lines.length,
    gross: sum((l) => l.basic + l.allowances + l.additions),
    deductions: sum((l) => l.deductions + l.advance),
    net: sum((l) => l.net),
    paid: sum((l) => (l.status === "paid" ? l.net : 0)),
    unpaid: sum((l) => (l.status === "paid" ? 0 : l.net)),
    unpaidCount: lines.filter((l) => l.status !== "paid").length,
  };
}

/** CSV for the accountant (UTF-8 with BOM so Excel shows Arabic). */
export function payrollCsv(lines: PayrollLine[]): string {
  const head = ["الشهر", "الاسم", "الأساسي", "البدلات", "الإضافات", "الخصومات", "السلفة", "الصافي", "الحالة", "طريقة الدفع", "تاريخ الدفع", "ملاحظة"];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = lines.map((l) => [l.month, l.name, l.basic, l.allowances, l.additions, l.deductions, l.advance, l.net,
    l.status === "paid" ? "مدفوع" : "غير مدفوع", l.method === "transfer" ? "تحويل" : l.method === "cash" ? "نقداً" : "", l.paidAt?.slice(0, 10) ?? "", l.note ?? ""]);
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

// ── Renewals ──────────────────────────────────────────────────────────────────

const MAX_RENEWALS = 40;

/**
 * Appends a renewal entry for every document whose expiry moved to a later
 * date (a correction to an earlier date is not a renewal). Keeps the last 40.
 */
export function recordRenewals(prev: Partial<HrWorker>, next: Partial<HrWorker>, at: string): RenewalEntry[] {
  const out = [...(prev.renewals ?? [])];
  for (const kind of DOC_KINDS) {
    const field = EXPIRY_FIELD[kind];
    const from = prev[field] as string | undefined;
    const to = next[field] as string | undefined;
    if (!to || !from || to <= from) continue;
    out.push({ kind, from, to, at });
  }
  return out.slice(-MAX_RENEWALS);
}

// ── End-of-service gratuity (Saudi Labor Law, arts. 84–85) ────────────────────

export type ServiceEndReason = "termination" | "resignation";

export interface Gratuity {
  years: number;          // service in years (fractional)
  wage: number;           // last monthly wage used (basic + allowances)
  full: number;           // entitlement before the resignation reduction
  factor: number;         // 1, 2/3, 1/3 or 0 on resignation
  amount: number;         // what is due
}

/**
 * Half a month's wage for each of the first five years, a full month for each
 * year after, pro-rated for part years (art. 84). On resignation (art. 85):
 * nothing under 2 years, a third for 2–5, two thirds for 5–10, all from 10.
 * Wage = basic + housing + transport + other allowances (the last actual wage).
 */
export function endOfServiceGratuity(
  w: Pick<HrWorker, "startDate" | "basicSalary" | "housing" | "transport" | "otherAllowance">,
  endDate: string,
  reason: ServiceEndReason,
): Gratuity | null {
  if (!w.startDate || !endDate || endDate <= w.startDate) return null;
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${w.startDate}T00:00:00Z`)) / 86400_000;
  if (!Number.isFinite(days) || days <= 0) return null;
  const years = days / 365;
  const wage = monthlyGross(w);
  const firstFive = Math.min(years, 5);
  const after = Math.max(0, years - 5);
  const full = Math.round((firstFive * wage / 2 + after * wage) * 100) / 100;
  let factor = 1;
  if (reason === "resignation") factor = years < 2 ? 0 : years < 5 ? 1 / 3 : years < 10 ? 2 / 3 : 1;
  return { years: Math.round(years * 100) / 100, wage, full, factor, amount: Math.round(full * factor * 100) / 100 };
}

// ── Payslip ───────────────────────────────────────────────────────────────────

/** Plain-text payslip for WhatsApp. */
export function payslipText(l: PayrollLine, opts: { company?: string; monthLabel?: string } = {}): string {
  const r = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("en-US")} ر.س`;
  const rows = [
    opts.company ? `*${opts.company}*` : "",
    `قسيمة راتب — ${opts.monthLabel ?? l.month}`,
    `الاسم: ${l.name}`,
    "",
    `الراتب الأساسي: ${r(l.basic)}`,
    l.allowances ? `البدلات: ${r(l.allowances)}` : "",
    l.additions ? `الإضافات: ${r(l.additions)}` : "",
    l.deductions ? `الخصومات: -${r(l.deductions)}` : "",
    l.advance ? `استرداد سلفة: -${r(l.advance)}` : "",
    `*الصافي: ${r(l.net)}*`,
    l.status === "paid"
      ? `تم الدفع${l.method === "transfer" ? " بالتحويل" : l.method === "cash" ? " نقداً" : ""}${l.paidAt ? ` بتاريخ ${l.paidAt.slice(0, 10)}` : ""}`
      : "الحالة: لم يُدفع بعد",
    l.note ? `ملاحظة: ${l.note}` : "",
  ];
  return rows.filter((x, i) => x !== "" || i === 3).join("\n");
}

// ── Date helpers for the pickers ──────────────────────────────────────────────

/**
 * Adds whole months to a YYYY-MM-DD date, clamping to the month's last day
 * (2026-01-31 + 1 month → 2026-02-28). "" when the date is invalid.
 */
export function addMonths(date: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return "";
  const y = +m[1], mo = +m[2] - 1 + months, d = +m[3];
  const target = new Date(Date.UTC(y, mo, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * Base for a renewal preset: the current expiry when it is set (renewing
 * extends from the old expiry), otherwise today.
 */
export function renewalBase(current: string | undefined, today: string): string {
  return current && /^\d{4}-\d{2}-\d{2}$/.test(current) ? current : today;
}

// ── Wage Protection System (WPS) bank file ────────────────────────────────────

/** Saudi bank codes (IBAN characters 5–6). */
export const SA_BANKS: Record<string, { ar: string; en: string }> = {
  "05": { ar: "مصرف الإنماء", en: "Alinma Bank" },
  "10": { ar: "البنك الأهلي السعودي", en: "Saudi National Bank" },
  "15": { ar: "بنك البلاد", en: "Bank Albilad" },
  "20": { ar: "بنك الرياض", en: "Riyad Bank" },
  "30": { ar: "البنك العربي الوطني", en: "Arab National Bank" },
  "40": { ar: "سامبا", en: "Samba" },
  "45": { ar: "البنك السعودي الأول", en: "Saudi Awwal Bank" },
  "50": { ar: "البنك الأول", en: "Alawwal Bank" },
  "55": { ar: "البنك السعودي الفرنسي", en: "Banque Saudi Fransi" },
  "60": { ar: "بنك الجزيرة", en: "Bank AlJazira" },
  "65": { ar: "البنك السعودي للاستثمار", en: "Saudi Investment Bank" },
  "80": { ar: "مصرف الراجحي", en: "Al Rajhi Bank" },
};

export function normalizeIban(raw: string | undefined | null): string {
  return latin(String(raw ?? "")).replace(/[\s-]/g, "").toUpperCase();
}

/** Saudi IBAN: SA + 22 digits with a valid ISO 13616 mod-97 checksum. */
export function isValidSaIban(raw: string | undefined | null): boolean {
  const iban = normalizeIban(raw);
  if (!/^SA\d{22}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

export function bankFromIban(raw: string | undefined | null): { code: string; ar: string; en: string } | null {
  const iban = normalizeIban(raw);
  if (!/^SA\d{4}/.test(iban)) return null;
  const code = iban.slice(4, 6);
  const bank = SA_BANKS[code];
  return bank ? { code, ...bank } : { code, ar: "بنك آخر", en: "Other bank" };
}

export interface WpsRow {
  name: string;
  idNumber: string;
  employeeNumber: string;
  bankCode: string;
  bankName: string;
  iban: string;
  basic: number;
  housing: number;
  otherEarnings: number;
  deductions: number;
  net: number;
}

export interface WpsProblem {
  name: string;
  reason: "missing_iban" | "invalid_iban" | "missing_id" | "not_positive";
}

/**
 * Builds WPS lines from a month's payroll. Housing is split out of the
 * allowances using the worker's file; additions go to other earnings and
 * advance recovery to deductions. Lines that a bank would reject (no or
 * invalid IBAN, no iqama/ID, net ≤ 0) are returned as problems instead.
 */
export function wpsRows(lines: PayrollLine[], workers: HrWorker[]): { rows: WpsRow[]; problems: WpsProblem[] } {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const rows: WpsRow[] = [];
  const problems: WpsProblem[] = [];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const l of lines) {
    const w = byId.get(l.workerId);
    const iban = normalizeIban(w?.bankIban);
    const idNumber = latin(String(w?.iqamaNumber ?? "")).replace(/\s/g, "");
    if (!iban) { problems.push({ name: l.name, reason: "missing_iban" }); continue; }
    if (!isValidSaIban(iban)) { problems.push({ name: l.name, reason: "invalid_iban" }); continue; }
    if (!idNumber) { problems.push({ name: l.name, reason: "missing_id" }); continue; }
    if (!(l.net > 0)) { problems.push({ name: l.name, reason: "not_positive" }); continue; }
    const housing = Math.min(money(w?.housing), money(l.allowances));
    const bank = bankFromIban(iban)!;
    rows.push({
      name: l.name,
      idNumber,
      employeeNumber: w?.employeeId ?? "",
      bankCode: bank.code,
      bankName: bank.en,
      iban,
      basic: r2(money(l.basic)),
      housing: r2(housing),
      otherEarnings: r2(money(l.allowances) - housing + money(l.additions)),
      deductions: r2(money(l.deductions) + money(l.advance)),
      net: r2(l.net),
    });
  }
  return { rows, problems };
}

/**
 * WPS payroll sheet (CSV, UTF-8 with BOM) with the columns Saudi banks and
 * Mudad ask for. Amounts use two decimals; ID and IBAN are forced to text
 * so Excel doesn't turn them into numbers.
 */
export function wpsCsv(rows: WpsRow[], month: string, company = ""): string {
  const head = [
    "Employee Name", "National ID / Iqama", "Employee Number", "Bank Code", "Bank", "IBAN",
    "Basic Salary", "Housing Allowance", "Other Earnings", "Deductions", "Net Salary", "Salary Month", "Company",
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = (s: string) => `="${s}"`; // keep leading zeros / long digit strings intact in Excel
  const f2 = (n: number) => n.toFixed(2);
  const body = rows.map((r) => [
    r.name, text(r.idNumber), r.employeeNumber, text(r.bankCode), r.bankName, r.iban,
    f2(r.basic), f2(r.housing), f2(r.otherEarnings), f2(r.deductions), f2(r.net), month, company,
  ]);
  const total = rows.reduce((s, r) => s + r.net, 0);
  const footer = ["TOTAL", "", "", "", "", "", "", "", "", "", f2(Math.round(total * 100) / 100), month, company];
  return "﻿" + [head, ...body, footer].map((r) => r.map(esc).join(",")).join("\n");
}
