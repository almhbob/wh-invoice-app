import { describe, expect, test } from "bun:test";
import { DEFAULT_LOYALTY as S, loyaltyKey, maxRedeemable, nextTier, normalizeLoyalty, pointsFor, pointsValue, settleDelta, tierFor } from "../../constants/loyalty";

describe("loyalty rules", () => {
  test("one customer whatever the phone format", () => {
    for (const p of ["0551234567", "966551234567", "+966 55 123 4567", "00966551234567", "551234567"]) expect(loyaltyKey(p)).toBe("551234567");
    expect(loyaltyKey("123")).toBe("");
    expect(loyaltyKey(undefined)).toBe("");
  });

  test("tiers by lifetime spend and points with multiplier", () => {
    expect(tierFor(0, S).id).toBe("silver");
    expect(tierFor(1500, S).id).toBe("gold");
    expect(tierFor(9999, S).id).toBe("platinum");
    expect(nextTier(1200, S)).toEqual({ tier: S.tiers[1], remaining: 300 });
    expect(nextTier(6000, S)).toBeNull();
    expect(pointsFor(199.9, S, S.tiers[0])).toBe(199);
    expect(pointsFor(200, S, S.tiers[1])).toBe(250);
    expect(pointsFor(200, { ...S, enabled: false }, S.tiers[0])).toBe(0);
  });

  test("redemption is capped by balance, minimum and share of the invoice", () => {
    expect(pointsValue(100, S)).toBe(5);
    expect(maxRedeemable(80, 500, S)).toBe(0);            // below minimum
    expect(maxRedeemable(10000, 100, S)).toBe(1000);      // 50% of 100 SAR = 50 SAR = 1000 pts
    expect(maxRedeemable(300, 100, S)).toBe(300);
    expect(maxRedeemable(10000, 3, S)).toBe(0);           // cap below minimum
  });

  test("settling never redeems more than the balance", () => {
    expect(settleDelta(100, 300, 200, 0, S)).toEqual({ earned: 100, redeemed: 200, delta: -100 });
    expect(settleDelta(100, 0, 0, 2000, S)).toEqual({ earned: 125, redeemed: 0, delta: 125 });
  });

  test("stored settings are sanitized", () => {
    const n = normalizeLoyalty({ pointsPerRiyal: "2", pointValue: -1, maxRedeemPercent: 400, tiers: [{ id: "b", name: "B", minSpent: 10, multiplier: 2 }, { id: "a", name: "A", minSpent: 0, multiplier: 1 }], startAt: "nope" });
    expect(n.pointsPerRiyal).toBe(2);
    expect(n.pointValue).toBe(0);
    expect(n.maxRedeemPercent).toBe(100);
    expect(n.tiers.map((t) => t.id)).toEqual(["a", "b"]);
    expect(n.startAt).toBe(S.startAt);
  });
});
