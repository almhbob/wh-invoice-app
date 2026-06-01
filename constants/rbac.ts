import { EmployeeRole } from "@/context/EmployeeContext";

// What each role can do
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

export function canDo(role: EmployeeRole | undefined, permission: Set<EmployeeRole>): boolean {
  if (!role) return false;
  return permission.has(role);
}
