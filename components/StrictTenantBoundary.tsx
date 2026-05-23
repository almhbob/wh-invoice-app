import React, { useEffect } from "react";

import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";

export function StrictTenantBoundary({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const { currentEmployee, setCurrentEmployee } = useEmployee();

  useEffect(() => {
    if (!currentEmployee) return;
    if (currentEmployee.companyId && currentEmployee.companyId !== companyId) {
      setCurrentEmployee(null);
    }
  }, [companyId, currentEmployee, setCurrentEmployee]);

  return <>{children}</>;
}
