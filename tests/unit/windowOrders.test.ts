import { describe, expect, test } from "bun:test";
import {
  canEditOrder, deptTotals, normalizeItems, orderStage, readyDeptCount, receiptDiff, riyadhDate, slugWindowId, WindowOrder,
} from "../../utils/windowOrders";

const base = (over: Partial<WindowOrder> = {}): WindowOrder => ({
  id: "w1_2026-11-02", windowId: "w1", windowName: "نافذة العليا", date: "2026-11-02", status: "sent",
  items: normalizeItems([
    { productId: "p1", name: "كيك شوكولاتة", department: "cake", qty: 4 },
    { productId: "p2", name: "بسبوسة", department: "halwa", qty: 10 },
  ]),
  depts: { cake: { status: "pending" }, halwa: { status: "pending" } },
  ...over,
});

describe("sales windows daily orders", () => {
  test("Riyadh business day", () => {
    expect(riyadhDate(new Date("2026-11-01T22:30:00Z"))).toBe("2026-11-02"); // 01:30 Riyadh
    expect(riyadhDate(new Date("2026-11-01T20:00:00Z"), 1)).toBe("2026-11-02");
  });

  test("lines are cleaned and merged", () => {
    const items = normalizeItems([
      { productId: "a", name: "A", department: "halwa", qty: 2 },
      { productId: "a", name: "A", department: "halwa", qty: 3.7 },
      { productId: "b", name: "B", department: "cake", qty: 0 },
      { productId: "c", name: "C", department: "nope" as never, qty: 5 },
      { productId: "d", name: "D", department: "cake", qty: 1 },
    ]);
    expect(items).toEqual([
      { productId: "d", name: "D", department: "cake", qty: 1 },
      { productId: "a", name: "A", department: "halwa", qty: 5 },
    ]);
  });

  test("stage follows the departments, then dispatch and receipt", () => {
    expect(orderStage(base())).toBe("sent");
    expect(canEditOrder(base())).toBe(true);
    const preparing = base({ depts: { cake: { status: "preparing" }, halwa: { status: "pending" } } });
    expect(orderStage(preparing)).toBe("preparing");
    expect(canEditOrder(preparing)).toBe(false);
    const ready = base({ depts: { cake: { status: "ready" }, halwa: { status: "ready" } } });
    expect(orderStage(ready)).toBe("ready");
    expect(readyDeptCount(preparing)).toEqual({ ready: 0, total: 2 });
    expect(orderStage(base({ status: "dispatched" }))).toBe("dispatched");
    expect(orderStage(base({ status: "received", shortageCount: 1 }))).toBe("received_short");
    expect(orderStage(base({ status: "received", shortageCount: 0 }))).toBe("received");
  });

  test("department totals across windows", () => {
    const other = base({ id: "w2_2026-11-02", windowId: "w2", windowName: "نافذة الملقا", items: normalizeItems([{ productId: "p2", name: "بسبوسة", department: "halwa", qty: 6 }]) });
    expect(deptTotals([base(), other], "halwa")).toEqual([
      { productId: "p2", name: "بسبوسة", total: 16, perWindow: [{ windowId: "w1", windowName: "نافذة العليا", qty: 10 }, { windowId: "w2", windowName: "نافذة الملقا", qty: 6 }] },
    ]);
    expect(deptTotals([other], "cake")).toEqual([]);
  });

  test("receipt shortages", () => {
    const r = receiptDiff(base().items, { p2: 8 });
    expect(r.shortageCount).toBe(1);
    expect(r.shortQty).toBe(2);
    expect(r.lines.find((l) => l.productId === "p1")?.receivedQty).toBe(4);
  });

  test("window ids are stable and unique", () => {
    const a = slugWindowId("نافذة العليا", []);
    expect(a).toMatch(/^w[0-9a-z]+$/);
    expect(slugWindowId("نافذة العليا", [a])).toBe(`${a}2`);
  });
});

import { dispatchPatch, expectedQty, isLateDept, lateDeptPatch } from "../../utils/windowOrders";

describe("partial dispatch", () => {
  test("unready departments send 0 and are listed as late", () => {
    const o = base({ depts: { cake: { status: "ready" }, halwa: { status: "preparing" } } });
    const p = dispatchPatch(o);
    expect(p.lateDepts).toEqual(["halwa"]);
    expect(p.items.find((i) => i.department === "cake")?.sentQty).toBe(4);
    expect(p.items.find((i) => i.department === "halwa")?.sentQty).toBe(0);
  });

  test("a fully ready order has no late departments", () => {
    const p = dispatchPatch(base({ depts: { cake: { status: "ready" }, halwa: { status: "ready" } } }));
    expect(p.lateDepts).toEqual([]);
    expect(p.items.every((i) => i.sentQty === i.qty)).toBe(true);
  });

  test("a late department sends its part afterwards", () => {
    const sent = base({ depts: { cake: { status: "ready" }, halwa: { status: "pending" } } });
    const d = dispatchPatch(sent);
    const dispatched = { ...sent, status: "dispatched" as const, items: d.items, lateDepts: d.lateDepts };
    expect(isLateDept(dispatched, "halwa")).toBe(true);
    expect(isLateDept(dispatched, "cake")).toBe(false);
    const after = lateDeptPatch(dispatched, "halwa");
    expect(after.lateDepts).toEqual([]);
    expect(after.items.find((i) => i.department === "halwa")?.sentQty).toBe(10);
  });

  test("receipt is prefilled with what was sent, so a missing department shows as short", () => {
    const sent = base({ depts: { cake: { status: "ready" }, halwa: { status: "pending" } } });
    const items = dispatchPatch(sent).items;
    expect(items.map(expectedQty)).toEqual(items.map((i) => (i.department === "cake" ? 4 : 0)));
    const r = receiptDiff(items, {});
    expect(r.shortageCount).toBe(1);
    expect(r.shortQty).toBe(10);
  });

  test("older orders without sentQty expect the ordered amount", () => {
    expect(expectedQty({ productId: "x", name: "x", department: "cake", qty: 3 })).toBe(3);
    expect(receiptDiff(base().items, {}).shortageCount).toBe(0);
  });
});

import { editBlock, isPastCutoff, lockedLineChanges, mergeDepts, normalizeCutoff, orderDeadline, startedDepts } from "../../utils/windowOrders";

describe("cutoff and day lock", () => {
  test("deadline is the evening before at the cutoff, Riyadh time", () => {
    // 22:00 Riyadh on Nov 1 = 19:00 UTC
    expect(new Date(orderDeadline("2026-11-02", "22:00")).toISOString()).toBe("2026-11-01T19:00:00.000Z");
    expect(new Date(orderDeadline("2026-11-01", "01:30")).toISOString()).toBe("2026-10-30T22:30:00.000Z"); // 01:30 Oct 31 Riyadh
    expect(normalizeCutoff("7:05")).toBe("07:05");
    expect(normalizeCutoff("bad")).toBe("22:00");
  });
  test("past the cutoff", () => {
    expect(isPastCutoff("2026-11-02", "22:00", new Date("2026-11-01T18:59:00Z"))).toBe(false);
    expect(isPastCutoff("2026-11-02", "22:00", new Date("2026-11-01T19:01:00Z"))).toBe(true);
  });
  test("why the window can't edit; managers override cutoff and lock", () => {
    const late = new Date("2026-11-01T20:00:00Z");
    expect(editBlock(null, "2026-11-02", {}, { now: late })).toBe("past_cutoff");
    expect(editBlock(null, "2026-11-02", {}, { now: late, manager: true })).toBeNull();
    expect(editBlock(null, "2026-11-02", { locked: { "2026-11-02": {} } }, { now: new Date("2026-11-01T10:00:00Z") })).toBe("locked_day");
    expect(editBlock(base({ status: "dispatched" }), "2026-11-02", {}, { manager: true })).toBe("dispatched");
    expect(editBlock(base(), "2026-11-02", {}, { now: new Date("2026-11-01T10:00:00Z") })).toBeNull();
  });
});

describe("top-ups", () => {
  const started = base({ depts: { cake: { status: "preparing", by: "x" }, halwa: { status: "pending" } } });
  test("started departments' lines are locked, others can change", () => {
    expect(startedDepts(started)).toEqual(["cake"]);
    const addHalwa = normalizeItems([...started.items, { productId: "p3", name: "كنافة", department: "halwa", qty: 5 }]);
    expect(lockedLineChanges(started, addHalwa)).toEqual([]);
    const moreCake = normalizeItems([...started.items, { productId: "p1", name: "كيك شوكولاتة", department: "cake", qty: 1 }]);
    expect(lockedLineChanges(started, moreCake)).toEqual(["cake"]);
  });
  test("progress is kept for started departments, new ones start pending", () => {
    const next = normalizeItems([...started.items, { productId: "p4", name: "كرواسون", department: "mawali", qty: 6 }]);
    const d = mergeDepts(started, next);
    expect(d.cake?.status).toBe("preparing");
    expect(d.halwa?.status).toBe("pending");
    expect(d.mawali?.status).toBe("pending");
  });
});
