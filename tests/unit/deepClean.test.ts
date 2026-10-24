import { describe, expect, test } from "bun:test";
import { deepClean } from "../../utils/deepClean";

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
});
