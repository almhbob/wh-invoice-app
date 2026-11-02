import { describe, expect, test } from "bun:test";
import { deepClean, normalizeEvents } from "../../utils/deepClean";

class Sentinel { constructor(public _methodName: string, public elements: unknown[]) {} }

describe("deepClean", () => {
  test("keeps Firestore sentinels (arrayUnion…) and strips undefined from plain data", () => {
    const s = new Sentinel("arrayUnion", [{ a: 1 }]);
    const d = new Date(0);
    const out = deepClean({ events: s, when: d, x: undefined, nested: { y: undefined, z: [1, undefined, 2] } }) as Record<string, any>;
    expect(out.events).toBe(s);
    expect(out.when).toBe(d);
    expect("x" in out).toBe(false);
    expect(out.nested).toEqual({ z: [1, 2] });
  });

  test("normalizeEvents recovers a map-shaped timeline", () => {
    const ev = { type: "dept_started", at: "2026-10-24T10:00:00Z" };
    expect(normalizeEvents({ _methodName: "arrayUnion", Ac: [ev] })).toEqual([ev]);
    expect(normalizeEvents([ev, null, { bad: 1 }])).toEqual([ev]);
    expect(normalizeEvents(undefined)).toBeUndefined();
    expect(normalizeEvents({ junk: 1 })).toEqual([]);
  });
});
