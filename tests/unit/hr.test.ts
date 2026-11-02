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

import { endOfServiceGratuity, payslipText, recordRenewals } from "../../utils/hr";

describe("renewals", () => {
  test("records only expiries that moved forward", () => {
    const prev = { iqamaExpiry: "2026-11-10", passportExpiry: "2028-01-01", healthExpiry: "2026-12-01" };
    const next = { iqamaExpiry: "2027-11-10", passportExpiry: "2027-12-01", healthExpiry: "2026-12-01" };
    const r = recordRenewals(prev, next, "2026-11-02T08:00:00.000Z");
    expect(r).toEqual([{ kind: "iqama", from: "2026-11-10", to: "2027-11-10", at: "2026-11-02T08:00:00.000Z" }]);
  });
  test("first date entered is not a renewal and history is kept", () => {
    const old = [{ kind: "health" as const, from: "2025-01-01", to: "2026-01-01", at: "x" }];
    expect(recordRenewals({ renewals: old }, { iqamaExpiry: "2027-01-01" }, "y")).toEqual(old);
  });
});

describe("end of service", () => {
  const base = { basicSalary: 3000, housing: 750, transport: 250, otherAllowance: 0 }; // wage 4000
  test("termination after 3 years: half a month per year", () => {
    const g = endOfServiceGratuity({ ...base, startDate: "2023-01-01" }, "2025-12-31", "termination")!;
    expect(g.wage).toBe(4000);
    expect(Math.round(g.amount)).toBe(6000);
  });
  test("termination after 8 years: 5 × half + 3 × full", () => {
    const g = endOfServiceGratuity({ ...base, startDate: "2018-01-01" }, "2026-01-01", "termination")!;
    expect(Math.round(g.full / 100) * 100).toBe(22000);
  });
  test("resignation rules", () => {
    expect(endOfServiceGratuity({ ...base, startDate: "2025-01-01" }, "2026-06-01", "resignation")!.amount).toBe(0);
    const g3 = endOfServiceGratuity({ ...base, startDate: "2023-01-01" }, "2026-01-01", "resignation")!;
    expect(g3.factor).toBeCloseTo(1 / 3);
    const g12 = endOfServiceGratuity({ ...base, startDate: "2014-01-01" }, "2026-01-01", "resignation")!;
    expect(g12.factor).toBe(1);
  });
  test("needs a start date before the end date", () => {
    expect(endOfServiceGratuity({ ...base }, "2026-01-01", "termination")).toBeNull();
    expect(endOfServiceGratuity({ ...base, startDate: "2027-01-01" }, "2026-01-01", "termination")).toBeNull();
  });
});

describe("payslip", () => {
  test("lists the components and the net", () => {
    const t = payslipText({ id: "m_w", month: "2026-10", workerId: "w", name: "أحمد", basic: 3000, allowances: 1000, additions: 200, deductions: 100, advance: 0, net: 4100, status: "paid", method: "transfer", paidAt: "2026-10-28T10:00:00Z" }, { company: "Laviviane", monthLabel: "أكتوبر 2026" });
    expect(t).toContain("أحمد");
    expect(t).toContain("الصافي: 4,100 ر.س");
    expect(t).toContain("تم الدفع بالتحويل بتاريخ 2026-10-28");
    expect(t).not.toContain("سلفة");
  });
});

import { addMonths, renewalBase } from "../../utils/hr";

describe("date pickers", () => {
  test("adds months and clamps to the month end", () => {
    expect(addMonths("2026-11-02", 12)).toBe("2027-11-02");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2026-10-15", 3)).toBe("2027-01-15");
    expect(addMonths("bad", 1)).toBe("");
  });
  test("renewals extend from the current expiry, else from today", () => {
    expect(renewalBase("2026-12-31", "2026-11-02")).toBe("2026-12-31");
    expect(renewalBase(undefined, "2026-11-02")).toBe("2026-11-02");
    expect(renewalBase("", "2026-11-02")).toBe("2026-11-02");
  });
});
