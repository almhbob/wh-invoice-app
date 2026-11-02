import { useEffect, useState } from "react";

import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { subscribePayroll, subscribeWorkers } from "@/lib/hr";
import { HrWorker, PayrollLine } from "@/utils/hr";

/** Staff files — loaded only for the company admin (the rules refuse anyone else). */
export function useHrWorkers() {
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const isAdmin = currentEmployee?.role === "admin";
  const [workers, setWorkers] = useState<HrWorker[] | null>(null);
  useEffect(() => {
    if (!isAdmin) { setWorkers([]); return; }
    setWorkers(null);
    return subscribeWorkers(companyId, setWorkers, () => setWorkers([]));
  }, [companyId, isAdmin]);
  return { workers: workers ?? [], loading: workers === null, isAdmin };
}

export function usePayroll(month: string) {
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const isAdmin = currentEmployee?.role === "admin";
  const [lines, setLines] = useState<PayrollLine[] | null>(null);
  useEffect(() => {
    if (!isAdmin) { setLines([]); return; }
    setLines(null);
    return subscribePayroll(companyId, month, setLines, () => setLines([]));
  }, [companyId, month, isAdmin]);
  return { lines: lines ?? [], loading: lines === null };
}
