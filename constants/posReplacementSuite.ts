export type SuiteModuleStatus = "ready" | "partial" | "planned";

export interface PosReplacementModule {
  key: string;
  titleAr: string;
  descriptionAr: string;
  status: SuiteModuleStatus;
  priority: "critical" | "high" | "medium";
  capabilities: string[];
}

export const POS_REPLACEMENT_SUITE: PosReplacementModule[] = [
  {
    key: "visual_pos",
    titleAr: "كاشير مرئي متطور",
    descriptionAr: "بيع سريع بالصور والأسعار والكميات مناسب للكيك والشوكولاتة والضيافة.",
    status: "partial",
    priority: "critical",
    capabilities: ["منتجات بالصور", "بحث وتصنيفات", "كميات فورية", "أسعار تلقائية", "خصومات", "عربون ومدفوعات", "مشاركة الفاتورة"],
  },
  {
    key: "branch_management",
    titleAr: "إدارة الفروع",
    descriptionAr: "إدارة كل فرع بشكل مستقل مع مقارنة الأداء والإرجاع والتلف.",
    status: "partial",
    priority: "critical",
    capabilities: ["مشرف فرع", "عزل بيانات الفرع", "مقارنة الفروع", "الإرجاع والإكسباير", "التلف بالصورة والملاحظة"],
  },
  {
    key: "staff_permissions",
    titleAr: "الموظفون والصلاحيات",
    descriptionAr: "أدوار واضحة للكاشير والأقسام ومشرف الفرع ومشرف القسم.",
    status: "partial",
    priority: "critical",
    capabilities: ["إضافة موظفين", "صلاحيات حسب الدور", "منع الأدوار المحمية", "توزيع المهام", "تتبع منشئ الفاتورة"],
  },
  {
    key: "kitchen_display",
    titleAr: "شاشات الأقسام والتحضير",
    descriptionAr: "توزيع الطلبات على أقسام الكيك والشوكولاتة والحلا والتغليف.",
    status: "partial",
    priority: "high",
    capabilities: ["طلبات حسب القسم", "حالة انتظار", "قيد التنفيذ", "تم", "تنبيه تأخير", "جاهز للتغليف"],
  },
  {
    key: "inventory",
    titleAr: "المخزون والمكونات",
    descriptionAr: "إدارة المنتجات والمكونات والاستهلاك والتنبيهات.",
    status: "planned",
    priority: "critical",
    capabilities: ["مخزون منتجات", "مخزون خامات", "حد إعادة الطلب", "تنبيه نقص", "حركة مخزون", "جرد فرعي"],
  },
  {
    key: "recipes_costing",
    titleAr: "الوصفات والتكلفة",
    descriptionAr: "حساب تكلفة الكيك والشوكولاتة حسب المكونات والهدر والعمالة.",
    status: "planned",
    priority: "high",
    capabilities: ["وصفات", "مكونات", "تكلفة تلقائية", "هامش ربح", "سعر مقترح", "نسبة هدر"],
  },
  {
    key: "customers_loyalty",
    titleAr: "العملاء والولاء",
    descriptionAr: "ملف عميل، عروض، خصومات، نقاط، وسجل طلبات.",
    status: "partial",
    priority: "high",
    capabilities: ["ملف العميل", "بحث بالهاتف", "عروض تلقائية", "نقاط ولاء", "شرائح العملاء", "تذكير بالمناسبات"],
  },
  {
    key: "payments",
    titleAr: "المدفوعات والتسوية",
    descriptionAr: "كاش، شبكة، تحويل، عربون، متبقي، وتسوية يومية.",
    status: "partial",
    priority: "critical",
    capabilities: ["كاش", "شبكة", "تحويل", "عربون", "متبقي", "تقرير إغلاق الكاشير", "مطابقة يومية"],
  },
  {
    key: "reports_analytics",
    titleAr: "التقارير والتحليلات",
    descriptionAr: "تقارير مبيعات وأداء موظفين وأقسام وفروع ومنتجات.",
    status: "partial",
    priority: "critical",
    capabilities: ["مبيعات يومية", "أداء الكاشير", "أداء الفروع", "أكثر المنتجات مبيعًا", "الخصومات", "التأمينات", "الإرجاع والتلف"],
  },
  {
    key: "online_ordering",
    titleAr: "طلبات أونلاين وكتالوج",
    descriptionAr: "كتالوج منتجات للعرض والطلب المسبق والمناسبات.",
    status: "planned",
    priority: "medium",
    capabilities: ["كتالوج صور", "طلب مسبق", "موعد تسليم", "ملاحظات العميل", "رفع صورة تصميم", "رابط مشاركة"],
  },
  {
    key: "supplier_purchases",
    titleAr: "الموردون والمشتريات",
    descriptionAr: "إدارة الموردين وفواتير الشراء وربطها بالمخزون.",
    status: "planned",
    priority: "medium",
    capabilities: ["موردون", "فواتير شراء", "استلام خامات", "تكلفة شراء", "مديونيات الموردين"],
  },
  {
    key: "multi_tenant",
    titleAr: "تأجير النظام للشركات",
    descriptionAr: "عزل بيانات الشركات المستأجرة وإدارة الاشتراكات والتجارب.",
    status: "partial",
    priority: "critical",
    capabilities: ["عزل شركة", "شركة تجريبية", "خطة اشتراك", "حد مستخدمين", "حد فواتير", "تعطيل وتفعيل"],
  }
];

export function suiteCompletionPercent() {
  const weights = { ready: 1, partial: 0.5, planned: 0 } as const;
  const score = POS_REPLACEMENT_SUITE.reduce((sum, m) => sum + weights[m.status], 0);
  return Math.round((score / POS_REPLACEMENT_SUITE.length) * 100);
}

export const POS_REPLACEMENT_POSITIONING_AR = {
  title: "فوترة كنظام بديل متكامل لأنظمة نقاط البيع",
  summary: "الهدف أن يغطي فوترة احتياجات شركات الكيك والشوكولاتة من الكاشير إلى الفروع والمخزون والموظفين والتقارير والولاء، مع تخصيص أعمق من الأنظمة العامة.",
  promise: "ليس مجرد فواتير؛ بل منصة تشغيل كاملة للشركات المستأجرة مع عزل بيانات وواجهة سهلة للموظفين.",
};
