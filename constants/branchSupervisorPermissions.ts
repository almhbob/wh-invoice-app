import { EmployeeRole } from "@/context/EmployeeContext";

export type BranchPermission =
  | "branch.employees.create"
  | "branch.employees.remove"
  | "branch.employees.assignRole"
  | "branch.tasks.assign"
  | "branch.tasks.reassign"
  | "branch.orders.view"
  | "branch.orders.update"
  | "branch.returns.manage"
  | "branch.damage.record"
  | "branch.reports.view"
  | "branch.products.view"
  | "branch.products.availability"
  | "company.settings.view";

export const BRANCH_SUPERVISOR_PERMISSIONS: BranchPermission[] = [
  "branch.employees.create",
  "branch.employees.remove",
  "branch.employees.assignRole",
  "branch.tasks.assign",
  "branch.tasks.reassign",
  "branch.orders.view",
  "branch.orders.update",
  "branch.returns.manage",
  "branch.damage.record",
  "branch.reports.view",
  "branch.products.view",
  "branch.products.availability",
  "company.settings.view",
];

export const BRANCH_SUPERVISOR_ALLOWED_ROLES: EmployeeRole[] = [
  "cashier",
  "halwa",
  "mawali",
  "chocolate",
  "cake",
  "packaging",
  "dept_supervisor",
  "guest",
];

export const PROTECTED_ROLES_FOR_BRANCH_SUPERVISOR: EmployeeRole[] = [
  "admin",
  "branch_supervisor",
];

export function canBranchSupervisorAssignRole(role: EmployeeRole) {
  return BRANCH_SUPERVISOR_ALLOWED_ROLES.includes(role);
}

export function canBranchSupervisorManageRole(role: EmployeeRole) {
  return !PROTECTED_ROLES_FOR_BRANCH_SUPERVISOR.includes(role);
}

export function defaultPermissionsForRole(role: EmployeeRole): string[] {
  switch (role) {
    case "cashier":
      return ["orders.create", "orders.view", "customers.manage", "payments.record"];
    case "halwa":
    case "mawali":
    case "chocolate":
    case "cake":
      return ["department.orders.view", "department.orders.update", "department.tasks.complete"];
    case "packaging":
      return ["packaging.orders.view", "packaging.orders.update", "returns.receive"];
    case "dept_supervisor":
      return ["department.team.manage", "department.orders.view", "department.orders.update", "department.reports.view"];
    case "guest":
      return ["demo.view"];
    case "branch_supervisor":
      return BRANCH_SUPERVISOR_PERMISSIONS;
    case "admin":
      return ["company.manage", "branches.manage", "users.manage", "billing.view", "reports.view", "settings.manage"];
    default:
      return [];
  }
}

export const BRANCH_SUPERVISOR_POLICY_AR = {
  title: "صلاحيات مشرف الفرع",
  summary: "مشرف الفرع مسؤول عن موظفي فرعه، تقسيم المهام، ومنح الصلاحيات التشغيلية دون الوصول لصلاحيات مالك المنصة أو المطور.",
  canDo: [
    "إضافة موظفين داخل الفرع",
    "إسناد الأدوار التشغيلية للموظفين",
    "تقسيم المهام بين الكاشير والأقسام والتغليف",
    "متابعة طلبات الفرع وتحديث حالاتها",
    "إدارة الإرجاع والإكسباير والتلف داخل الفرع",
    "عرض تقارير الفرع التشغيلية",
  ],
  cannotDo: [
    "تعيين مالك منصة أو مطور",
    "تعديل اشتراك الشركة",
    "الوصول لبيانات شركات أخرى",
    "تغيير إعدادات النظام العامة",
    "حذف أو تعطيل شركة مستأجرة",
  ],
};
