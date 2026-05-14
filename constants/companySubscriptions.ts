export type CompanyPlanKey = "starter" | "business" | "enterprise";
export type CompanySubscriptionStatus = "trial" | "active" | "due_soon" | "overdue" | "suspended" | "cancelled";
export type CompanyApplicationStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "contract_pending" | "active";

export type SystemFeatureKey =
  | "visual_pos"
  | "multi_branch"
  | "branch_supervisor"
  | "inventory"
  | "recipes_costing"
  | "loyalty"
  | "online_catalog"
  | "delivery"
  | "returns_damage"
  | "advanced_reports"
  | "developer_support"
  | "custom_domain"
  | "contract_upload";

export interface SystemFeatureToggle {
  key: SystemFeatureKey;
  titleAr: string;
  descriptionAr: string;
  enabledByDefault: boolean;
  visibleToCompany: boolean;
}

export interface CompanySubscriptionPlan {
  key: CompanyPlanKey;
  titleAr: string;
  monthlyPriceSar: number;
  yearlyPriceSar: number;
  maxUsers: number;
  maxBranches: number;
  maxInvoicesPerMonth: number;
  trialDays: number;
  recommendedForAr: string;
  features: SystemFeatureKey[];
}

export interface CompanySubscriptionRecord {
  id: string;
  companyId: string;
  companyNameAr: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  planKey: CompanyPlanKey;
  status: CompanySubscriptionStatus;
  applicationStatus: CompanyApplicationStatus;
  startsAt?: string;
  expiresAt?: string;
  lastPaymentAt?: string;
  nextPaymentDueAt?: string;
  contractUrl?: string;
  contractFileName?: string;
  enabledFeatures: SystemFeatureKey[];
  hiddenFeatures: SystemFeatureKey[];
  notesAr?: string;
}

export interface CompanyServiceApplication {
  id: string;
  companyNameAr: string;
  businessTypeAr: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  cityAr?: string;
  branchesCount: number;
  employeesCount: number;
  expectedInvoicesMonthly: number;
  selectedPlanKey: CompanyPlanKey;
  requestedFeatures: SystemFeatureKey[];
  notesAr?: string;
  status: CompanyApplicationStatus;
  submittedAt: string;
}

export const SYSTEM_FEATURES: SystemFeatureToggle[] = [
  { key: "visual_pos", titleAr: "كاشير مرئي بالصور", descriptionAr: "بيع سريع بالصور والأسعار والكميات.", enabledByDefault: true, visibleToCompany: true },
  { key: "multi_branch", titleAr: "إدارة الفروع", descriptionAr: "فروع متعددة مع مقارنة الأداء والعزل.", enabledByDefault: false, visibleToCompany: true },
  { key: "branch_supervisor", titleAr: "مشرف الفرع", descriptionAr: "إدارة موظفي الفرع وتوزيع المهام.", enabledByDefault: true, visibleToCompany: true },
  { key: "inventory", titleAr: "المخزون", descriptionAr: "تنبيهات نقص وحركات مخزون وتحويل بين الفروع.", enabledByDefault: false, visibleToCompany: true },
  { key: "recipes_costing", titleAr: "الوصفات والتكلفة", descriptionAr: "تكلفة المنتجات والمكونات وهامش الربح.", enabledByDefault: false, visibleToCompany: true },
  { key: "loyalty", titleAr: "العملاء والولاء", descriptionAr: "نقاط وشرائح عملاء وتذكير بالمناسبات.", enabledByDefault: false, visibleToCompany: true },
  { key: "online_catalog", titleAr: "كتالوج وطلبات أونلاين", descriptionAr: "عرض المنتجات واستقبال طلبات مسبقة.", enabledByDefault: false, visibleToCompany: true },
  { key: "delivery", titleAr: "التوصيل", descriptionAr: "إدارة طلبات ومندوبي التوصيل.", enabledByDefault: true, visibleToCompany: true },
  { key: "returns_damage", titleAr: "الإرجاع والتلف", descriptionAr: "إكسباير وإرجاع وتلف بصورة وملاحظة.", enabledByDefault: true, visibleToCompany: true },
  { key: "advanced_reports", titleAr: "تقارير متقدمة", descriptionAr: "تقارير فروع وموظفين ومنتجات ومبيعات.", enabledByDefault: false, visibleToCompany: true },
  { key: "developer_support", titleAr: "دعم مطور متقدم", descriptionAr: "متابعة تقنية وتهيئة خاصة للشركة.", enabledByDefault: false, visibleToCompany: false },
  { key: "custom_domain", titleAr: "دومين مخصص", descriptionAr: "رابط خاص للشركة أو الفرع.", enabledByDefault: false, visibleToCompany: true },
  { key: "contract_upload", titleAr: "العقود والمرفقات", descriptionAr: "رفع وتحميل عقد الشركة من النظام.", enabledByDefault: true, visibleToCompany: true },
];

export const COMPANY_SUBSCRIPTION_PLANS: CompanySubscriptionPlan[] = [
  {
    key: "starter",
    titleAr: "الباقة الأساسية",
    monthlyPriceSar: 149,
    yearlyPriceSar: 1490,
    maxUsers: 5,
    maxBranches: 1,
    maxInvoicesPerMonth: 800,
    trialDays: 7,
    recommendedForAr: "مشروع صغير أو فرع واحد يبدأ بتنظيم الفواتير والطلبات.",
    features: ["visual_pos", "branch_supervisor", "delivery", "returns_damage", "contract_upload"],
  },
  {
    key: "business",
    titleAr: "باقة الأعمال",
    monthlyPriceSar: 349,
    yearlyPriceSar: 3490,
    maxUsers: 25,
    maxBranches: 3,
    maxInvoicesPerMonth: 3000,
    trialDays: 14,
    recommendedForAr: "شركات الكيك والشوكولاتة النشطة التي تحتاج فروع وموظفين وتقارير.",
    features: ["visual_pos", "multi_branch", "branch_supervisor", "inventory", "loyalty", "delivery", "returns_damage", "advanced_reports", "contract_upload"],
  },
  {
    key: "enterprise",
    titleAr: "الباقة المتقدمة",
    monthlyPriceSar: 799,
    yearlyPriceSar: 7990,
    maxUsers: 100,
    maxBranches: 20,
    maxInvoicesPerMonth: 20000,
    trialDays: 30,
    recommendedForAr: "سلاسل فروع وشركات تحتاج تخصيص ودومين ودعم تقني متقدم.",
    features: ["visual_pos", "multi_branch", "branch_supervisor", "inventory", "recipes_costing", "loyalty", "online_catalog", "delivery", "returns_damage", "advanced_reports", "developer_support", "custom_domain", "contract_upload"],
  },
];

export const DEMO_COMPANY_SUBSCRIPTIONS: CompanySubscriptionRecord[] = [
  {
    id: "sub-demo-cake",
    companyId: "demo-cake-chocolate-company",
    companyNameAr: "شركة تجريبية للكيك والشوكولاتة",
    contactName: "مدير تجريبي",
    contactPhone: "0500000000",
    contactEmail: "demo@example.com",
    planKey: "business",
    status: "trial",
    applicationStatus: "active",
    startsAt: new Date().toISOString(),
    nextPaymentDueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    contractUrl: "",
    contractFileName: "",
    enabledFeatures: COMPANY_SUBSCRIPTION_PLANS.find((p) => p.key === "business")?.features ?? [],
    hiddenFeatures: ["recipes_costing", "custom_domain", "developer_support"],
    notesAr: "حساب تجريبي معزول لعرض النظام للشركات.",
  },
];

export const DEMO_SERVICE_APPLICATIONS: CompanyServiceApplication[] = [
  {
    id: "app-001",
    companyNameAr: "كيك وشوكولاتة المستقبل",
    businessTypeAr: "كيك وشوكولاتة وضيافة",
    contactName: "مسؤول المبيعات",
    contactPhone: "0501111111",
    contactEmail: "sales@example.com",
    cityAr: "الرياض",
    branchesCount: 2,
    employeesCount: 14,
    expectedInvoicesMonthly: 1800,
    selectedPlanKey: "business",
    requestedFeatures: ["visual_pos", "multi_branch", "inventory", "loyalty", "returns_damage"],
    notesAr: "يرغبون بتجربة لمدة أسبوعين مع رفع عقد لاحقًا.",
    status: "submitted",
    submittedAt: new Date().toISOString(),
  },
];

export function planByKey(key: CompanyPlanKey) {
  return COMPANY_SUBSCRIPTION_PLANS.find((plan) => plan.key === key) ?? COMPANY_SUBSCRIPTION_PLANS[0];
}

export function featureByKey(key: SystemFeatureKey) {
  return SYSTEM_FEATURES.find((feature) => feature.key === key);
}

export function visibleFeaturesForCompany(record: CompanySubscriptionRecord) {
  return record.enabledFeatures.filter((key) => !record.hiddenFeatures.includes(key));
}
