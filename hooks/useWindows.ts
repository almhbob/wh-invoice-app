import { useEffect, useMemo, useState } from "react";

import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { subscribeWindowOrders, subscribeWindows } from "@/lib/windowOrders";
import { SalesWindow, WindowOrder } from "@/utils/windowOrders";

/** The company's sales windows (branches), live. */
export function useWindows() {
  const { companyId } = useCompany();
  const [windows, setWindows] = useState<SalesWindow[] | null>(null);
  useEffect(() => {
    setWindows(null);
    return subscribeWindows(companyId, setWindows, () => setWindows([]));
  }, [companyId]);
  const active = useMemo(() => (windows ?? []).filter((w) => w.active), [windows]);
  return { windows: windows ?? [], active, loading: windows === null };
}

/** All windows' orders for one business day, live. */
export function useWindowOrders(date: string) {
  const { companyId } = useCompany();
  const [orders, setOrders] = useState<WindowOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setOrders(null);
    setFailed(false);
    return subscribeWindowOrders(companyId, date, (o) => { setOrders(o); setFailed(false); }, () => { setOrders([]); setFailed(true); });
  }, [companyId, date]);
  return { orders: orders ?? [], loading: orders === null, failed };
}

/** The window this employee works at (admin/supervisors may pick any). */
export function useMyWindow() {
  const { currentEmployee, employees } = useEmployee();
  const { active, windows, loading } = useWindows();
  // The live employee record carries the window link set by the admin.
  const branchId = employees.find((e) => e.id === currentEmployee?.id)?.branchId ?? currentEmployee?.branchId;
  const assigned = windows.find((w) => w.id === branchId && w.active) ?? null;
  const canPickAny = currentEmployee?.role === "admin" || currentEmployee?.role === "branch_supervisor";
  return { assigned, canPickAny, active, loading };
}
