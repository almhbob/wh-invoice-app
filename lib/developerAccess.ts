export interface DeveloperAccessEmployee {
  role?: string;
  employeeId?: string;
  permissions?: string[];
  username?: string;
}

const DEVELOPER_EMPLOYEE_IDS = new Set([
  "ALMHB0B",
  "ALMHB0B.III",
  "ALMHB0B-III",
  "ASIM",
  "OWNER001",
  "000001",
]);

const DEVELOPER_USERNAMES = new Set([
  "almhbob",
  "almhbob.iii",
  "asim",
  "owner",
  "developer",
]);

export function canAccessDeveloperDashboard(employee: DeveloperAccessEmployee | null | undefined) {
  if (!employee) return false;
  const role = employee.role ?? "";
  const employeeId = String(employee.employeeId ?? "").trim().toUpperCase();
  const username = String(employee.username ?? "").trim().toLowerCase();
  const permissions = employee.permissions ?? [];

  return (
    role === "admin" ||
    role === "developer" ||
    role === "super_admin" ||
    permissions.includes("developer:access") ||
    permissions.includes("*") ||
    DEVELOPER_EMPLOYEE_IDS.has(employeeId) ||
    DEVELOPER_USERNAMES.has(username)
  );
}
