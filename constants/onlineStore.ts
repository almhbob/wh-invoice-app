/**
 * Online store rules (companies/{id}/settings/onlineStore).
 * Plain TS: shared by the app, the Cloudflare functions and tests.
 * All dates/times are Riyadh wall-clock (UTC+3, no DST).
 */

export interface StoreBranch {
  id: string;
  name: string;
}

export interface OnlineStoreSettings {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  openDays: number[];
  openFrom: string; // "HH:MM"
  openTo: string; // "HH:MM" (last bookable slot)
  slotMinutes: number;
  defaultLeadHours: number;
  categoryLeadHours: Record<string, number>;
  maxDaysAhead: number;
  /** 0 = unlimited */
  maxOrdersPerDay: number;
  /** 0 = unlimited */
  maxOrdersPerSlot: number;
  closedDates: string[]; // "YYYY-MM-DD"
  minOrder: number;
  delivery: { enabled: boolean; fee: number; freeOver: number };
  branches: StoreBranch[];
  notice: string;
}

export const RIYADH_OFFSET_MIN = 180;

export const DEFAULT_STORE_SETTINGS: OnlineStoreSettings = {
  enabled: true,
  openDays: [0, 1, 2, 3, 4, 5, 6],
  openFrom: "10:00",
  openTo: "23:00",
  slotMinutes: 30,
  defaultLeadHours: 4,
  categoryLeadHours: {
    "New Cake Collection": 24,
    "Laviviane Cakes": 24,
    "Mousse Cake": 24,
    "Distributions and Gifts": 48,
    "Occasion Chocolate": 24,
  },
  maxDaysAhead: 60,
  maxOrdersPerDay: 0,
  maxOrdersPerSlot: 0,
  closedDates: [],
  minOrder: 0,
  delivery: { enabled: true, fee: 0, freeOver: 0 },
  branches: [],
  notice: "",
};

const num = (v: unknown, d: number, min = 0, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const hhmm = (v: unknown, d: string) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);

/** Merge a stored (possibly partial / untrusted) document over the defaults. */
export function normalizeStoreSettings(raw: unknown): OnlineStoreSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_STORE_SETTINGS;
  const delivery = (r.delivery && typeof r.delivery === "object" ? r.delivery : {}) as Record<string, unknown>;
  const cat = (r.categoryLeadHours && typeof r.categoryLeadHours === "object" ? r.categoryLeadHours : d.categoryLeadHours) as Record<string, unknown>;
  return {
    enabled: r.enabled === undefined ? d.enabled : Boolean(r.enabled),
    openDays: Array.isArray(r.openDays) ? (r.openDays as unknown[]).map(Number).filter((x) => x >= 0 && x <= 6) : d.openDays,
    openFrom: hhmm(r.openFrom, d.openFrom),
    openTo: hhmm(r.openTo, d.openTo),
    slotMinutes: [15, 30, 60].includes(Number(r.slotMinutes)) ? Number(r.slotMinutes) : d.slotMinutes,
    defaultLeadHours: num(r.defaultLeadHours, d.defaultLeadHours, 0, 720),
    categoryLeadHours: Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, num(v, 0, 0, 720)])),
    maxDaysAhead: num(r.maxDaysAhead, d.maxDaysAhead, 1, 365),
    maxOrdersPerDay: num(r.maxOrdersPerDay, 0, 0, 10000),
    maxOrdersPerSlot: num(r.maxOrdersPerSlot, 0, 0, 1000),
    closedDates: Array.isArray(r.closedDates) ? (r.closedDates as unknown[]).map(String).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) : [],
    minOrder: num(r.minOrder, 0),
    delivery: {
      enabled: delivery.enabled === undefined ? d.delivery.enabled : Boolean(delivery.enabled),
      fee: num(delivery.fee, 0),
      freeOver: num(delivery.freeOver, 0),
    },
    branches: Array.isArray(r.branches)
      ? (r.branches as Record<string, unknown>[]).filter((b) => b && b.id && b.name).map((b) => ({ id: String(b.id).slice(0, 40), name: String(b.name).slice(0, 60) }))
      : [],
    notice: typeof r.notice === "string" ? r.notice.slice(0, 200) : "",
  };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Epoch ms of a Riyadh wall-clock date + time. */
export function riyadhMs(date: string, time: string) {
  return Date.parse(`${date}T${time}:00+03:00`);
}

/** Riyadh wall-clock parts for an epoch ms. */
export function riyadhParts(ms: number) {
  const d = new Date(ms + RIYADH_OFFSET_MIN * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, weekday: d.getUTCDay() };
}

export function leadHoursFor(categories: string[], s: OnlineStoreSettings) {
  return Math.max(s.defaultLeadHours, ...categories.map((c) => s.categoryLeadHours[c] ?? 0));
}

export type ScheduleError = "store_closed" | "closed_day" | "closed_date" | "outside_hours" | "bad_slot" | "lead_time" | "too_far";

export function slotsFor(s: OnlineStoreSettings) {
  const out: string[] = [];
  for (let m = toMin(s.openFrom); m <= toMin(s.openTo); m += s.slotMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

/** Why a requested date/time cannot be booked, or null when it can. */
export function scheduleError(s: OnlineStoreSettings, date: string, time: string, leadHours: number, nowMs = Date.now()): ScheduleError | null {
  if (!s.enabled) return "store_closed";
  const at = riyadhMs(date, time);
  if (isNaN(at)) return "bad_slot";
  if (s.closedDates.includes(date)) return "closed_date";
  if (!s.openDays.includes(riyadhParts(at).weekday)) return "closed_day";
  const m = toMin(time);
  if (m < toMin(s.openFrom) || m > toMin(s.openTo)) return "outside_hours";
  if ((m - toMin(s.openFrom)) % s.slotMinutes !== 0) return "bad_slot";
  if (at < nowMs + leadHours * 3600_000) return "lead_time";
  if (at > nowMs + s.maxDaysAhead * 86400_000) return "too_far";
  return null;
}

/** First bookable slot for the given lead time (searching up to maxDaysAhead). */
export function earliestSlot(s: OnlineStoreSettings, leadHours: number, nowMs = Date.now()): { date: string; time: string } | null {
  if (!s.enabled) return null;
  const slots = slotsFor(s);
  for (let i = 0; i <= s.maxDaysAhead; i++) {
    const { date } = riyadhParts(nowMs + i * 86400_000);
    for (const time of slots) if (!scheduleError(s, date, time, leadHours, nowMs)) return { date, time };
  }
  return null;
}

export function deliveryFeeFor(s: OnlineStoreSettings, subtotal: number) {
  if (!s.delivery.enabled) return 0;
  if (s.delivery.freeOver > 0 && subtotal >= s.delivery.freeOver) return 0;
  return s.delivery.fee;
}
