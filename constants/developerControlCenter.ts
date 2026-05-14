export type DeveloperControlStatus = "ready" | "needs_action" | "planned" | "blocked";
export type DeveloperControlPriority = "critical" | "high" | "medium" | "low";

export interface DeveloperControlItem {
  id: string;
  titleAr: string;
  descriptionAr: string;
  status: DeveloperControlStatus;
  priority: DeveloperControlPriority;
  ownerAr: string;
  actionAr: string;
}

export interface DeveloperControlSection {
  id: string;
  titleAr: string;
  descriptionAr: string;
  items: DeveloperControlItem[];
}

export const DEVELOPER_CONTROL_SECTIONS: DeveloperControlSection[] = [
  {
    id: "release_deployment",
    titleAr: "النشر والإصدارات",
    descriptionAr: "مراقبة آخر إصدار، حالة Vercel، الكاش، الروابط المباشرة، وملاحظات الإصدار.",
    items: [
      {
        id: "vercel_current_commit",
        titleAr: "مطابقة Production مع آخر Commit",
        descriptionAr: "يجب أن يكون آخر نشر Production Current مطابقًا لآخر commit في GitHub قبل اعتماد أي ميزة.",
        status: "needs_action",
        priority: "critical",
        ownerAr: "المطور",
        actionAr: "راجع Vercel Deployments واجعل آخر نشر Ready هو Current.",
      },
      {
        id: "release_marker",
        titleAr: "علامة الإصدار داخل التطبيق",
        descriptionAr: "إظهار رقم الإصدار الحالي داخل لوحة المطور لتأكيد أن المستخدم يرى آخر نسخة.",
        status: "planned",
        priority: "high",
        ownerAr: "النظام",
        actionAr: "ربط RELEASE_INFO داخل الواجهة.",
      },
      {
        id: "build_logs",
        titleAr: "سجل أخطاء البناء",
        descriptionAr: "قسم سريع لتوثيق آخر خطأ Build وطريقة إصلاحه.",
        status: "planned",
        priority: "medium",
        ownerAr: "المطور",
        actionAr: "إضافة حقل آخر خطأ وآخر إصلاح يدويًا أو من API لاحقًا.",
      },
    ],
  },
  {
    id: "tenant_isolation",
    titleAr: "عزل الشركات والمستخدمين",
    descriptionAr: "ضمان أن كل شركة وموظف يرى بياناته فقط ولا يمكن الدخول المباشر للكاشير.",
    items: [
      {
        id: "tenant_gate",
        titleAr: "بوابة دخول الشركة",
        descriptionAr: "لا يتم فتح النظام إلا بعد اختيار الشركة ثم دخول المستخدم.",
        status: "ready",
        priority: "critical",
        ownerAr: "النظام",
        actionAr: "اختبر فتح الموقع بعد النشر وتأكد أنه لا يفتح الكاشير مباشرة.",
      },
      {
        id: "employee_credentials",
        titleAr: "يوزر مستقل لكل موظف",
        descriptionAr: "كل موظف يدخل برقم وظيفي/يوزر ورمز دخول داخل شركته.",
        status: "ready",
        priority: "critical",
        ownerAr: "مشرف الشركة",
        actionAr: "أضف شاشة تغيير رمز الدخول وإعادة تعيينه.",
      },
      {
        id: "firestore_rules",
        titleAr: "قواعد Firestore للعزل",
        descriptionAr: "القواعد الحالية تعتمد على claims عند وجود Auth حقيقي. تحتاج لاحقًا ربط Firebase Auth/Custom Claims.",
        status: "needs_action",
        priority: "critical",
        ownerAr: "المطور",
        actionAr: "تفعيل Auth أو قواعد مؤقتة آمنة للتجربة حسب بيئة التشغيل.",
      },
    ],
  },
  {
    id: "tenant_subscriptions",
    titleAr: "اشتراكات الشركات والعقود",
    descriptionAr: "إدارة الباقات، المميزات، العقود، السداد، الطلبات، وتفعيل/تعليق الشركات.",
    items: [
      {
        id: "plans_features",
        titleAr: "الباقات والمميزات",
        descriptionAr: "توجد باقات أساسية وأعمال ومتقدمة مع إظهار/إخفاء المميزات.",
        status: "ready",
        priority: "high",
        ownerAr: "المطور",
        actionAr: "ربطها بقاعدة بيانات الشركات بدل البيانات التجريبية.",
      },
      {
        id: "contract_upload",
        titleAr: "رفع وتحميل العقود",
        descriptionAr: "تم تجهيز رفع العقود إلى Firebase Storage مع رابط تحميل.",
        status: "needs_action",
        priority: "high",
        ownerAr: "المطور",
        actionAr: "تأكد من Storage Rules ومتغير EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET.",
      },
      {
        id: "billing_status",
        titleAr: "حالة السداد والتنبيهات",
        descriptionAr: "ينقص إدارة حالة السداد والفاتورة القادمة والتنبيه قبل انتهاء الاشتراك.",
        status: "planned",
        priority: "high",
        ownerAr: "النظام",
        actionAr: "إضافة نموذج مدفوعات وتنبيهات انتهاء الاشتراك.",
      },
    ],
  },
  {
    id: "security_privacy",
    titleAr: "الأمان والخصوصية",
    descriptionAr: "حماية لوحة المطور والبيانات الحساسة ومنع ظهورها للشركات المستأجرة.",
    items: [
      {
        id: "developer_panel_visibility",
        titleAr: "إخفاء لوحة المطور عن الشركات",
        descriptionAr: "لوحة المطور يجب ألا تظهر إلا لمالك النظام أو دور developer/super_admin.",
        status: "needs_action",
        priority: "critical",
        ownerAr: "المطور",
        actionAr: "إضافة شرط صلاحية قبل عرض تبويب المطور.",
      },
      {
        id: "sensitive_data_policy",
        titleAr: "سياسة البيانات الحساسة",
        descriptionAr: "لا يتم عرض رقم هوية أو بيانات شخصية حساسة في الواجهة العامة.",
        status: "ready",
        priority: "high",
        ownerAr: "النظام",
        actionAr: "استمر بعرض الملخص المهني فقط.",
      },
      {
        id: "audit_log",
        titleAr: "سجل تدقيق العمليات",
        descriptionAr: "ينقص سجل تدقيق لتغييرات الباقات والصلاحيات والعقود وحذف الموظفين.",
        status: "planned",
        priority: "high",
        ownerAr: "النظام",
        actionAr: "إنشاء auditLogs لكل شركة ولكل عملية مطور.",
      },
    ],
  },
  {
    id: "data_backup",
    titleAr: "النسخ الاحتياطي واستمرارية العمل",
    descriptionAr: "حماية النظام من فقدان البيانات وتسهيل الاستعادة عند الخطأ.",
    items: [
      {
        id: "backup_policy",
        titleAr: "سياسة النسخ الاحتياطي",
        descriptionAr: "ينقص تحديد نسخ يومية للبيانات الحرجة والعقود والصور.",
        status: "planned",
        priority: "critical",
        ownerAr: "المطور",
        actionAr: "إضافة لوحة حالة النسخ الاحتياطي وآخر نسخة ناجحة.",
      },
      {
        id: "export_company_data",
        titleAr: "تصدير بيانات الشركة",
        descriptionAr: "كل شركة تحتاج تصدير فواتيرها وموظفيها ومنتجاتها عند الطلب.",
        status: "planned",
        priority: "medium",
        ownerAr: "الشركة",
        actionAr: "إضافة زر تصدير CSV/PDF لاحقًا.",
      },
    ],
  },
  {
    id: "support_operations",
    titleAr: "الدعم والتشغيل",
    descriptionAr: "متابعة طلبات الدعم والأعطال والاقتراحات للشركات المستأجرة.",
    items: [
      {
        id: "support_tickets",
        titleAr: "تذاكر الدعم",
        descriptionAr: "ينقص استقبال تذاكر دعم من الشركات مع حالة التذكرة والأولوية.",
        status: "planned",
        priority: "medium",
        ownerAr: "الدعم",
        actionAr: "إضافة نموذج تذكرة دعم داخل لوحة الشركة ولوحة المطور.",
      },
      {
        id: "incident_status",
        titleAr: "حالة الأعطال",
        descriptionAr: "ينقص سجل أعطال يوضح آخر توقف وسبب المشكلة والحل.",
        status: "planned",
        priority: "medium",
        ownerAr: "المطور",
        actionAr: "ربطها مستقبلًا بمراقبة Uptime.",
      },
    ],
  },
];

export function developerControlSummary() {
  const items = DEVELOPER_CONTROL_SECTIONS.flatMap((section) => section.items);
  return {
    total: items.length,
    ready: items.filter((item) => item.status === "ready").length,
    needsAction: items.filter((item) => item.status === "needs_action").length,
    planned: items.filter((item) => item.status === "planned").length,
    blocked: items.filter((item) => item.status === "blocked").length,
    critical: items.filter((item) => item.priority === "critical").length,
  };
}
