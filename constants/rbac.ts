import { EmployeeRole } from "@/context/EmployeeContext";

export const ROLE_CAN_ACCESS_ADMIN = new Set<EmployeeRole>([
  "admin", "branch_supervisor",
]);

export const ROLE_CAN_DELETE_ORDERS = new Set<EmployeeRole>([
  "admin",
]);

export const ROLE_CAN_EDIT_ORDERS = new Set<EmployeeRole>([
  "admin", "cashier",
]);

export const ROLE_CAN_MANAGE_EMPLOYEES = new Set<EmployeeRole>([
  "admin",
]);

export const ROLE_CAN_VIEW_FINANCIAL = new Set<EmployeeRole>([
  "admin", "branch_supervisor",
]);

export const ROLE_CAN_CLOSE_SHIFT = new Set<EmployeeRole>([
  "admin", "cashier", "branch_supervisor",
]);

export const ROLE_CAN_VIEW_CASHIER = new Set<EmployeeRole>([
  "admin", "branch_supervisor", "cashier",
]);

export const ROLE_CAN_VIEW_ARCHIVE = new Set<EmployeeRole>([
  "admin", "branch_supervisor", "cashier", "dept_supervisor",
]);

export const ROLE_CAN_VIEW_REPORTS = new Set<EmployeeRole>([
  "admin", "branch_supervisor",
]);

export const ROLE_CAN_VIEW_BRANCH_FEATURES = new Set<EmployeeRole>([
  "admin", "branch_supervisor",
]);

export const ROLE_CAN_VIEW_CUSTOMERS = new Set<EmployeeRole>([
  "admin", "branch_supervisor", "cashier",
]);

export const ROLE_CAN_VIEW_DELIVERY = new Set<EmployeeRole>([
  "admin", "branch_supervisor", "cashier",
]);

export const ROLE_CAN_VIEW_TRAYS = new Set<EmployeeRole>([
  "admin", "branch_supervisor", "cashier",
]);

// Which roles can access each department screen
export const DEPT_ROLE_ACCESS: Record<string, Set<EmployeeRole>> = {
  halwa:     new Set(["admin", "branch_supervisor", "dept_supervisor", "halwa"]),
  mawali:    new Set(["admin", "branch_supervisor", "dept_supervisor", "mawali"]),
  chocolate: new Set(["admin", "branch_supervisor", "dept_supervisor", "chocolate"]),
  cake:      new Set(["admin", "branch_supervisor", "dept_supervisor", "cake"]),
  packaging: new Set(["admin", "branch_supervisor", "dept_supervisor", "packaging"]),
};

export function canDo(role: EmployeeRole | undefined, permission: Set<EmployeeRole>): boolean {
  if (!role) return false;
  return permission.has(role);
}

export function canAccessDept(role: EmployeeRole | undefined, dept: string): boolean {
  if (!role) return false;
  return DEPT_ROLE_ACCESS[dept]?.has(role) ?? false;
}
