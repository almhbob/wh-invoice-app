/**
 * Customer loyalty rules (companies/{id}/settings/loyalty).
 * Plain TS: shared by the app, the Cloudflare functions and tests.
 *
 * Customers are identified by their phone number. They earn points on what they
 * pay (after discounts, excluding tray insurance), climb tiers by lifetime spend,
 * and redeem points as a discount at the counter.
 */

export interface LoyaltyTier {
  id: string;
  name: string;
  /** Lifetime spend (SAR) needed to reach this tier. */
  minSpent: number;
  /** Points multiplier on every purchase. */
  multiplier: number;
}

export interface LoyaltySettings {
  enabled: boolean;
  /** Points earned per 1 SAR spent (before the tier multiplier). */
  pointsPerRiyal: number;
  /** SAR value of 1 point when redeemed. */
  pointValue: number;
  /** Smallest number of points that can be redeemed at once. */
  minRedeemPoints: number;
  /** Redemption can cover at most this share of an invoice (0–100). */
  maxRedeemPercent: number;
  /** Only orders created at or after this instant earn points. */
  startAt: string;
  tiers: LoyaltyTier[];
}

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  pointsPerRiyal: 1,
  pointValue: 0.05, // 100 points = 5 SAR → 5% back
  minRedeemPoints: 100,
  maxRedeemPercent: 50,
  startAt: "2026-10-24T16:00:00.000Z",
  tiers: [
    { id: "silver", name: "فضي", minSpent: 0, multiplier: 1 },
    { id: "gold", name: "ذهبي", minSpent: 1500, multiplier: 1.25 },
    { id: "platinum", name: "بلاتيني", minSpent: 5000, multiplier: 1.5 },
  ],
};

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function normalizeLoyalty(raw: unknown): LoyaltySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_LOYALTY;
  const tiers = Array.isArray(r.tiers)
    ? (r.tiers as Record<string, unknown>[])
        .filter((t) => t && t.id && t.name)
        .map((t) => ({ id: String(t.id).slice(0, 20), name: String(t.name).slice(0, 30), minSpent: num(t.minSpent, 0, 0, 1e7), multiplier: num(t.multiplier, 1, 0, 10) }))
    : d.tiers;
  return {
    enabled: r.enabled === undefined ? d.enabled : Boolean(r.enabled),
    pointsPerRiyal: num(r.pointsPerRiyal, d.pointsPerRiyal, 0, 100),
    pointValue: num(r.pointValue, d.pointValue, 0, 100),
    minRedeemPoints: Math.round(num(r.minRedeemPoints, d.minRedeemPoints, 1, 1e6)),
    maxRedeemPercent: num(r.maxRedeemPercent, d.maxRedeemPercent, 0, 100),
    startAt: typeof r.startAt === "string" && !isNaN(Date.parse(r.startAt)) ? r.startAt : d.startAt,
    tiers: (tiers.length ? tiers : d.tiers).slice().sort((a, b) => a.minSpent - b.minSpent),
  };
}

/** Same customer whatever way the number was typed (05…, 9665…, +966 5…). "" when unusable. */
export function loyaltyKey(phone: string | undefined | null): string {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length >= 8 && d.length <= 12 ? d : "";
}

export function tierFor(lifetimeSpent: number, s: LoyaltySettings): LoyaltyTier {
  let tier = s.tiers[0] ?? DEFAULT_LOYALTY.tiers[0];
  for (const t of s.tiers) if (lifetimeSpent >= t.minSpent) tier = t;
  return tier;
}

export function nextTier(lifetimeSpent: number, s: LoyaltySettings): { tier: LoyaltyTier; remaining: number } | null {
  const t = s.tiers.find((x) => x.minSpent > lifetimeSpent);
  return t ? { tier: t, remaining: Math.ceil(t.minSpent - lifetimeSpent) } : null;
}

export function pointsFor(amount: number, s: LoyaltySettings, tier: LoyaltyTier): number {
  if (!s.enabled || !(amount > 0)) return 0;
  return Math.floor(amount * s.pointsPerRiyal * tier.multiplier);
}

export function pointsValue(points: number, s: LoyaltySettings) {
  return Math.round(points * s.pointValue * 100) / 100;
}

/** Most points usable on an invoice of `total` SAR with `balance` points available. */
export function maxRedeemable(balance: number, total: number, s: LoyaltySettings): number {
  if (!s.enabled || s.pointValue <= 0 || balance < s.minRedeemPoints || total <= 0) return 0;
  const capByInvoice = Math.floor(((total * s.maxRedeemPercent) / 100) / s.pointValue);
  const pts = Math.min(Math.floor(balance), capByInvoice);
  return pts >= s.minRedeemPoints ? pts : 0;
}

/** Loyalty details stored on an order (written by the cashier, settled once on the server). */
export interface OrderLoyalty {
  key: string;
  /** Amount that earns points (SAR, after discounts, excluding insurance). */
  base?: number;
  redeemPoints?: number;
  redeemValue?: number;
  /** Filled when settled. */
  earnedPoints?: number;
  state?: "applied" | "reversed";
  appliedAt?: string;
}

/** Points movement when an order is settled: earn on the base, minus what was redeemed. */
export function settleDelta(base: number, redeemPoints: number, balance: number, lifetimeSpent: number, s: LoyaltySettings) {
  const tier = tierFor(lifetimeSpent, s);
  const earned = pointsFor(base, s, tier);
  const redeemed = Math.min(Math.max(0, Math.floor(redeemPoints)), Math.max(0, Math.floor(balance)));
  return { earned, redeemed, delta: earned - redeemed };
}
