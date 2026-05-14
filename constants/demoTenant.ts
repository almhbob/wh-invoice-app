import { CAKE_CHOCOLATE_COMPANY_BLUEPRINT } from "@/constants/cakeCompanyBlueprint";

export const DEMO_TENANT_COMPANY = {
  id: "demo-cake-chocolate-company",
  nameAr: "شركة تجريبية للكيك والشوكولاتة",
  nameEn: "Demo Cake & Chocolate Company",
  slug: "demo-cake-chocolate",
  businessType: "cake_chocolate",
  status: "trial",
  plan: "business",
  maxUsers: CAKE_CHOCOLATE_COMPANY_BLUEPRINT.subscription.maxUsers,
  maxBranches: CAKE_CHOCOLATE_COMPANY_BLUEPRINT.subscription.maxBranches,
  maxInvoicesPerMonth: CAKE_CHOCOLATE_COMPANY_BLUEPRINT.subscription.maxInvoicesPerMonth,
  trialDays: CAKE_CHOCOLATE_COMPANY_BLUEPRINT.subscription.trialDays,
  createdFor: "sales_demo",
};

export const DEMO_TENANT_USERS = [
  {
    name: "مدير تجريبي",
    employeeId: "DEMO-OWNER",
    role: "admin",
    demoRole: "tenant_owner",
    note: "يعرض كامل إمكانيات الشركة المستأجرة بدون صلاحيات مالك منصة فوترة.",
  },
  {
    name: "كاشير تجريبي",
    employeeId: "DEMO-CASHIER",
    role: "cashier",
    demoRole: "cashier",
    note: "مخصص لتجربة إنشاء الفواتير واستقبال الطلبات.",
  },
  {
    name: "موظف كيك تجريبي",
    employeeId: "DEMO-CAKE",
    role: "cake",
    demoRole: "department_staff",
    note: "مخصص لتجربة مهام قسم الكيك.",
  },
  {
    name: "موظف شوكولاتة تجريبي",
    employeeId: "DEMO-CHOC",
    role: "chocolate",
    demoRole: "department_staff",
    note: "مخصص لتجربة مهام قسم الشوكولاتة.",
  },
];

export const DEMO_ACCESS_NOTICE = {
  titleAr: "دخول تجريبي للشركات",
  messageAr:
    "هذا الدخول مخصص لاستعراض نظام فوترة لشركات الكيك والشوكولاتة. البيانات التجريبية معزولة ولا تمنح صلاحيات مالك المنصة.",
};
