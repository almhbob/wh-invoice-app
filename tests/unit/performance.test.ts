import { describe, expect, test } from "bun:test";
import { computePerformance, fmtMinutes } from "../../utils/performance";

const at = (min: number) => new Date(Date.UTC(2026, 9, 20, 7, 0) + min * 60000).toISOString();
const by = (name: string, employeeId: string) => ({ name, employeeId });

describe("computePerformance", () => {
  const orders = [
    {
      id: "a", createdAt: at(0), deliveryTime: "2026-10-20 23:00", deliveryDriver: by("ماجد", "R1"),
      events: [
        { type: "created", at: at(0) },
        { type: "dept_started", at: at(10), dept: "cake", by: by("منى", "K1") },
        { type: "dept_done", at: at(70), dept: "cake", by: by("منى", "K1") },
        { type: "ready", at: at(80) },
        { type: "dispatched", at: at(90) },
        { type: "delivered", at: at(120) },
      ],
    },
    {
      id: "b", createdAt: at(0), deliveryTime: "2026-10-20 07:30",
      events: [
        { type: "dept_started", at: at(30), dept: "cake", by: by("منى", "K1") },
        { type: "dept_done", at: at(60), dept: "cake" },
        { type: "ready", at: at(100) },
        { type: "picked_up", at: at(600) },
      ],
    },
    { id: "c", createdAt: at(0), deleted: true, events: [{ type: "ready", at: at(5) }] },
    { id: "d", createdAt: at(0), events: { broken: true } as unknown as [] },
  ];
  const p = computePerformance(orders);

  test("averages department wait and work time and finds the top worker", () => {
    const cake = p.depts.find((d) => d.dept === "cake")!;
    expect(cake.jobs).toBe(2);
    expect(cake.avgWaitMin).toBe(20);
    expect(cake.avgWorkMin).toBe(45);
    expect(cake.topWorker).toEqual({ name: "منى", jobs: 2 });
  });

  test("ready time, on-time rate and drivers; deleted and malformed orders are ignored", () => {
    expect(p.orders).toBe(3);
    expect(p.avgReadyMin).toBe(90);
    expect(p.lateCount).toBe(1);
    expect(p.drivers).toEqual([{ employeeId: "R1", name: "ماجد", assigned: 1, delivered: 1, failed: 0, avgRideMin: 30, onTime: 1 }]);
  });

  test("formats minutes", () => {
    expect(fmtMinutes(85)).toBe("1 س 25 د");
    expect(fmtMinutes(null)).toBe("—");
  });
});
