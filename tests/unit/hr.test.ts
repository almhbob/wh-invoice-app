import { describe, expect, test } from "bun:test";
import {
  computeNet, daysUntil, expiryAlerts, expiryState, HrWorker, isValidIqama, monthKey, newPayrollLine, parseDateInput,
  payrollCsv, payrollTotals, shiftMonth,
} from "../../utils/hr";

const w = (over: Partial<HrWorker>): HrWorker => ({
  id: "w1", name: "أحمد", basicSalary: 3000, housing: 750, transport: 300, otherAllowance: 0, active: true, ...over,
});

describe("staff documents", () => {
  test("dates typed any common way", () => {
    expect(parseDateInput("2026-11-20")).toBe("2026-11-20");
    expect(parseDateInput("20/11/2026")).toBe("2026-11-20");
    expect(parseDateInput("٢٠٢٦/١١/٢٠")).toBe("2026-11-20");
    expect(parseDateInput("2026-02-30")).toBe("");
    expect(parseDateInput("1448-05-10")).toBe(""); // Hijri years are rejected, not misread
  });

  test("10-day warning window", () => {
    const today = "2026-11-01";
    expect(daysUntil("2026-11-11", today)).toBe(10);
    expect(expiryState("2026-11-11", today)).toBe("soon");
    expect(expiryState("2026-11-12", today)).toBe("ok");
    expect(expiryState("2026-10-31", today)).toBe("expired");
    expect(expiryState(undefined, today)).toBe("missing");
  });

  test("alerts list the most urgent first and skip inactive staff", () => {
    const list = expiryAlerts([
      w({ id: "a", name: "أحمد", iqamaExpiry: "2026-11-09", healthExpiry: "2026-10-20" }),
      w({ id: "b", name: "بلال", passportExpiry: "2026-11-05" }),
      w({ id: "c", name: "خالد", iqamaExpiry: "2026-11-02", active: false }),
      w({ id: "d", name: "دانيال", iqamaExpiry: "2027-01-01" }),
    ], "2026-11-01");
    expect(list.map((a) => `${a.workerId}:${a.kind}:${a.days}`)).toEqual(["a:health:-12", "b:passport:4", "a:iqama:8"]);
  });

  test("iqama number format", () => {
    expect(isValidIqama("2412345678")).toBe(true);
    expect(isValidIqama("٢٤١٢٣٤٥٦٧٨")).toBe(true);
    expect(isValidIqama("3412345678")).toBe(false);
  });
});

describe("payroll", () => {
  test("line from salary, net with additions and deductions", () => {
    const l = newPayrollLine(w({}), "2026-11");
    expect(l).toMatchObject({ id: "2026-11_w1", basic: 3000, allowances: 1050, net: 4050, status: "unpaid" });
    expect(computeNet({ ...l, additions: 200, deductions: 100.5, advance: 500 })).toBe(3649.5);
  });

  test("totals and months", () => {
    const a = { ...newPayrollLine(w({}), "2026-11"), status: "paid" as const };
    const b = newPayrollLine(w({ id: "w2", name: "بلال", basicSalary: 2000, housing: 0, transport: 0 }), "2026-11");
    expect(payrollTotals([a, b])).toMatchObject({ count: 2, net: 6050, paid: 4050, unpaid: 2000, unpaidCount: 1 });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthKey(new Date("2026-10-31T22:00:00Z"))).toBe("2026-11");
  });

  test("CSV opens in Excel with Arabic", () => {
    const csv = payrollCsv([{ ...newPayrollLine(w({ name: 'أحمد "أبو علي"' }), "2026-11"), note: "سلفة, شهر" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"أحمد ""أبو علي"""');
    expect(csv).toContain('"سلفة, شهر"');
  });
});
