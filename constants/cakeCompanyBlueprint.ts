export type TenantBusinessType = "cake_chocolate" | "bakery" | "sweets";
export type TenantSubscriptionStatus = "trial" | "active" | "suspended" | "expired";

export interface TenantDepartmentConfig {
  key: "cashier" | "cake" | "chocolate" | "halwa" | "mawali" | "packaging" | "delivery";
  nameAr: string;
  enabled: boolean;
  requiresReceiver: boolean;
  canChangePrice: boolean;
  canMarkDone: boolean;
}

export interface TenantRoleConfig {
  key: string;
  nameAr: string;
  descriptionAr: string;
  permissions: string[];
}

export interface TenantCompanySettingsBlueprint {
  businessType: TenantBusinessType;
  subscription: {
    status: TenantSubscriptionStatus;
    plan: "starter" | "business" | "enterprise";
    maxUsers: number;
    maxBranches: number;
    maxInvoicesPerMonth: number;
    trialDays: number;
  };
  departments: TenantDepartmentConfig[];
  roles: TenantRoleConfig[];
  invoice: {
    requireCustomerPhone: boolean;
    requireDeliveryTime: boolean;
    enableInsurance: boolean;
    enableDiscounts: boolean;
    enableImageAttachment: boolean;
    enableBranchTransfer: boolean;
  };
  products: {
    categories: string[];
    allowUnavailableProducts: boolean;
    requirePriceApproval: boolean;
  };
  reports: {
    dailySales: boolean;
    cashierPerformance: boolean;
    departmentPerformance: boolean;
    discountsReport: boolean;
    traysReport: boolean;
  };
}

export const CAKE_CHOCOLATE_COMPANY_BLUEPRINT: TenantCompanySettingsBlueprint = {
  businessType: "cake_chocolate",
  subscription: {
    status: "trial",
    plan: "business",
    maxUsers: 25,
    maxBranches: 1,
    maxInvoicesPerMonth: 3000,
    trialDays: 14,
  },
  departments: [
    { key: "cashier", nameAr: "الكاشير", enabled: true, requiresReceiver: false, canChangePrice: false, canMarkDone: false },
    { key: "cake", nameAr: "قسم الكيك", enabled: true, requiresReceiver: true, canChangePrice: true, canMarkDone: true },
    { key: "chocolate", nameAr: "قسم الشوكولاتة", enabled: true, requiresReceiver: true, canChangePrice: true, canMarkDone: true },
    { key: "halwa", nameAr: "قسم الحلا والضيافة", enabled: true, requiresReceiver: true, canChangePrice: true, canMarkDone: true },
    { key: "mawali", nameAr: "قسم الموالح والمعجنات", enabled: false, requiresReceiver: true, canChangePrice: true, canMarkDone: true },
    { key: "packaging", nameAr: "قسم التغليف", enabled: true, requiresReceiver: true, canChangePrice: false, canMarkDone: true },
    { key: "delivery", nameAr: "التوصيل", enabled: true, requiresReceiver: true, canChangePrice: false, canMarkDone: true },
  ],
  roles: [
    { key: "tenant_owner", nameAr: "مالك الشركة", descriptionAr: "صلاحية كاملة داخل شركته فقط", permissions: ["company.manage", "users.manage", "billing.view", "reports.view", "settings.manage"] },
    { key: "branch_manager", nameAr: "مدير الفرع", descriptionAr: "إدارة العمليات اليومية والموظفين والتقارير", permissions: ["orders.manage", "users.manage", "products.manage", "reports.view"] },
    { key: "cashier", nameAr: "كاشير", descriptionAr: "إنشاء الفواتير واستلام العربون وتعديل بيانات العميل", permissions: ["orders.create", "orders.view", "customers.manage"] },
    { key: "department_staff", nameAr: "موظف قسم", descriptionAr: "استلام الطلبات وتحديث حالة التنفيذ", permissions: ["department.orders.view", "department.orders.update"] },
    { key: "delivery_staff", nameAr: "مندوب توصيل", descriptionAr: "استلام طلبات التوصيل وتحديث حالتها", permissions: ["delivery.view", "delivery.update"] },
  ],
  invoice: {
    requireCustomerPhone: true,
    requireDeliveryTime: true,
    enableInsurance: true,
    enableDiscounts: true,
    enableImageAttachment: true,
    enableBranchTransfer: true,
  },
  products: {
    categories: ["كيك", "شوكولاتة", "حلا ضيافة", "توزيعات", "صواني", "إضافات"],
    allowUnavailableProducts: true,
    requirePriceApproval: true,
  },
  reports: {
    dailySales: true,
    cashierPerformance: true,
    departmentPerformance: true,
    discountsReport: true,
    traysReport: true,
  },
};
