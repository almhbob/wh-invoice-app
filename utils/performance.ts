/**
 * Operational performance from order timelines (pure TS: shared by the app and tests).
 * Durations are minutes. Only orders with the needed events are counted, so
 * figures improve automatically as more orders flow through the new timeline.
 */

type Dept = "halwa" | "mawali" | "chocolate" | "cake" | "packaging";

export interface PerfEvent {
  type: string;
  at: string;
  dept?: string;
  by?: { name: string; employeeId: string };
}

export interface PerfOrder {
  id: string;
  createdAt: string;
  deliveryTime?: string;
  orderType?: string;
  deleted?: boolean;
  events?: PerfEvent[];
  deliveryDriver?: { name: string; employeeId: string };
  items?: { name: string; quantity: number; price?: number; department?: string }[];
}

export interface DeptPerf {
  dept: Dept;
  jobs: number;
  avgWaitMin: number | null;   // order created → department started
  avgWorkMin: number | null;   // started → done
  topWorker: { name: string; jobs: number } | null;
}

export interface DriverPerf {
  employeeId: string;
  name: string;
  assigned: number;
  delivered: number;
  failed: number;
  avgRideMin: number | null;   // dispatched → delivered
  onTime: number;              // delivered at or before the due time
}

export interface PerfSummary {
  orders: number;
  withTimeline: number;
  avgReadyMin: number | null;  // created → ready
  onTimeRate: number | null;   // share of completed orders handed over by the due time
  lateCount: number;
  depts: DeptPerf[];
  drivers: DriverPerf[];
}

const DEPTS: Dept[] = ["cake", "halwa", "chocolate", "mawali", "packaging"];
const ON_TIME_GRACE_MIN = 10;

const ms = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** "YYYY-MM-DD HH:MM" wall-clock due time → epoch ms (same convention as the app). */
export function dueMs(dt?: string): number | null {
  if (!dt) return null;
  const m = dt.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (m) return ms(`${m[1]}T${m[2]}:00`);
  const d = dt.match(/^(\d{4}-\d{2}-\d{2})$/);
  return d ? ms(`${d[1]}T23:59:00`) : null;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const minutes = (a: number | null, b: number | null) => (a !== null && b !== null && b >= a ? (b - a) / 60000 : null);

export function computePerformance(orders: PerfOrder[]): PerfSummary {
  const live = orders.filter((o) => !o.deleted);
  const readyTimes: number[] = [];
  let onTime = 0;
  let completed = 0;
  let late = 0;
  let withTimeline = 0;

  const dept = new Map<Dept, { wait: number[]; work: number[]; jobs: number; workers: Map<string, { name: string; jobs: number }> }>();
  DEPTS.forEach((d) => dept.set(d, { wait: [], work: [], jobs: 0, workers: new Map() }));
  const drivers = new Map<string, DriverPerf & { rides: number[] }>();

  for (const o of live) {
    const ev = Array.isArray(o.events) ? o.events : [];
    if (ev.length) withTimeline++;
    const created = ms(o.createdAt);
    const first = (type: string, d?: string) => ev.find((e) => e.type === type && (d === undefined || e.dept === d));

    const ready = first("ready");
    const r = minutes(created, ms(ready?.at));
    if (r !== null && r < 60 * 24 * 14) readyTimes.push(r);

    for (const d of DEPTS) {
      const started = first("dept_started", d);
      const done = first("dept_done", d);
      if (!started && !done) continue;
      const slot = dept.get(d)!;
      if (done) slot.jobs++;
      const wait = minutes(created, ms(started?.at));
      const work = minutes(ms(started?.at), ms(done?.at));
      if (wait !== null && wait < 60 * 24 * 14) slot.wait.push(wait);
      if (work !== null && work < 60 * 24 * 3) slot.work.push(work);
      const who = started?.by ?? done?.by;
      if (who?.employeeId && done) {
        const w = slot.workers.get(who.employeeId) ?? { name: who.name, jobs: 0 };
        w.jobs++;
        slot.workers.set(who.employeeId, w);
      }
    }

    // Handover: delivered for delivery orders, picked up for pickup orders.
    const handover = first("delivered") ?? first("picked_up");
    const due = dueMs(o.deliveryTime);
    if (handover && due !== null) {
      completed++;
      if ((ms(handover.at) ?? Infinity) <= due + ON_TIME_GRACE_MIN * 60000) onTime++;
      else late++;
    }

    const drv = o.deliveryDriver;
    if (drv?.employeeId) {
      const d = drivers.get(drv.employeeId) ?? { employeeId: drv.employeeId, name: drv.name, assigned: 0, delivered: 0, failed: 0, avgRideMin: null, onTime: 0, rides: [] };
      d.assigned++;
      const delivered = first("delivered");
      if (delivered) {
        d.delivered++;
        const ride = minutes(ms(first("dispatched")?.at), ms(delivered.at));
        if (ride !== null && ride < 60 * 12) d.rides.push(ride);
        if (due !== null && (ms(delivered.at) ?? Infinity) <= due + ON_TIME_GRACE_MIN * 60000) d.onTime++;
      }
      if (ev.some((e) => e.type === "delivery_failed")) d.failed++;
      drivers.set(drv.employeeId, d);
    }
  }

  return {
    orders: live.length,
    withTimeline,
    avgReadyMin: avg(readyTimes),
    onTimeRate: completed ? onTime / completed : null,
    lateCount: late,
    depts: DEPTS.map((d) => {
      const s = dept.get(d)!;
      const top = [...s.workers.values()].sort((a, b) => b.jobs - a.jobs)[0] ?? null;
      return { dept: d, jobs: s.jobs, avgWaitMin: avg(s.wait), avgWorkMin: avg(s.work), topWorker: top };
    }).filter((d) => d.jobs > 0 || d.avgWaitMin !== null),
    drivers: [...drivers.values()]
      .map(({ rides, ...d }) => ({ ...d, avgRideMin: avg(rides) }))
      .sort((a, b) => b.delivered - a.delivered),
  };
}

/** "1 س 25 د" / "45 د" */
export function fmtMinutes(min: number | null, lang: "ar" | "en" = "ar") {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (lang === "ar") return h ? `${h} س ${m} د` : `${m} د`;
  return h ? `${h}h ${m}m` : `${m}m`;
}
