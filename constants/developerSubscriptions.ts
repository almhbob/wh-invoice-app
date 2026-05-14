export type DeveloperSubscriptionCategory =
  | "hosting"
  | "domain"
  | "database"
  | "storage"
  | "email"
  | "sms"
  | "payments"
  | "monitoring"
  | "source_control"
  | "app_stores"
  | "support";

export type DeveloperSubscriptionPriority = "critical" | "high" | "medium" | "low";
export type DeveloperSubscriptionStatus = "active" | "due_soon" | "needs_review" | "unknown";

export interface DeveloperSubscriptionLink {
  id: string;
  titleAr: string;
  provider: string;
  category: DeveloperSubscriptionCategory;
  priority: DeveloperSubscriptionPriority;
  status: DeveloperSubscriptionStatus;
  url: string;
  billingUrl?: string;
  dashboardUrl?: string;
  notesAr: string;
  renewalHintAr?: string;
}

export const SUBSCRIPTION_CATEGORY_LABELS_AR: Record<DeveloperSubscriptionCategory, string> = {
  hosting: "الخوادم والاستضافة",
  domain: "الدومينات و DNS",
  database: "قواعد البيانات",
  storage: "التخزين والملفات",
  email: "البريد الإلكتروني",
  sms: "الرسائل والتنبيهات",
  payments: "المدفوعات والفوترة",
  monitoring: "المراقبة والتنبيهات",
  source_control: "الكود والنشر",
  app_stores: "متاجر التطبيقات",
  support: "الدعم والتذاكر",
};

export const SUBSCRIPTION_CATEGORY_ICONS: Record<DeveloperSubscriptionCategory, string> = {
  hosting: "server",
  domain: "globe",
  database: "database",
  storage: "hard-drive",
  email: "mail",
  sms: "message-circle",
  payments: "credit-card",
  monitoring: "activity",
  source_control: "github",
  app_stores: "shopping-bag",
  support: "life-buoy",
};

export const DEVELOPER_SUBSCRIPTION_LINKS: DeveloperSubscriptionLink[] = [
  {
    id: "vercel-hosting",
    titleAr: "استضافة ونشر Vercel",
    provider: "Vercel",
    category: "hosting",
    priority: "critical",
    status: "needs_review",
    url: "https://vercel.com/dashboard",
    billingUrl: "https://vercel.com/account/billing",
    dashboardUrl: "https://vercel.com/dashboard",
    notesAr: "مهم لاستقرار رابط النظام والنشر التلقائي بعد تحديث GitHub.",
    renewalHintAr: "راجع الخطة والدفع وحدود الاستخدام شهريًا.",
  },
  {
    id: "domain-dns",
    titleAr: "الدومين و DNS",
    provider: "Domain Provider / DNS",
    category: "domain",
    priority: "critical",
    status: "needs_review",
    url: "https://vercel.com/domains",
    billingUrl: "https://vercel.com/domains",
    dashboardUrl: "https://vercel.com/domains",
    notesAr: "مهم لاستمرار fawtara.sawihasa.digital وعدم توقف الرابط أو سجلات DNS.",
    renewalHintAr: "راجع تاريخ انتهاء الدومين وتجديده قبل 30 يومًا.",
  },
  {
    id: "firebase-console",
    titleAr: "Firebase Console",
    provider: "Firebase",
    category: "database",
    priority: "critical",
    status: "needs_review",
    url: "https://console.firebase.google.com/",
    billingUrl: "https://console.firebase.google.com/project/_/usage/details",
    dashboardUrl: "https://console.firebase.google.com/",
    notesAr: "إدارة Firestore وقواعد الأمان والتخزين وربط الشركات المستأجرة.",
    renewalHintAr: "راقب الاستهلاك والفوترة حتى لا تتوقف قاعدة البيانات.",
  },
  {
    id: "firebase-storage",
    titleAr: "Firebase Storage",
    provider: "Firebase",
    category: "storage",
    priority: "high",
    status: "needs_review",
    url: "https://console.firebase.google.com/",
    billingUrl: "https://console.firebase.google.com/project/_/usage/details",
    dashboardUrl: "https://console.firebase.google.com/",
    notesAr: "مهم لحفظ صور المنتجات وصور التلف والمرفقات.",
    renewalHintAr: "راجع حجم التخزين والتحميل شهريًا.",
  },
  {
    id: "github-repo",
    titleAr: "GitHub Repository",
    provider: "GitHub",
    category: "source_control",
    priority: "critical",
    status: "active",
    url: "https://github.com/almhbob/wh-invoice-app",
    billingUrl: "https://github.com/settings/billing",
    dashboardUrl: "https://github.com/almhbob/wh-invoice-app",
    notesAr: "مصدر الكود الرئيسي، ويجب الحفاظ على صلاحياته والنسخ الاحتياطية.",
    renewalHintAr: "راجع الصلاحيات والـ Actions والربط مع Vercel.",
  },
  {
    id: "expo-eas",
    titleAr: "Expo / EAS",
    provider: "Expo",
    category: "app_stores",
    priority: "high",
    status: "needs_review",
    url: "https://expo.dev/accounts",
    billingUrl: "https://expo.dev/accounts",
    dashboardUrl: "https://expo.dev/accounts",
    notesAr: "مهم لبناء تطبيقات الجوال والتحديثات الهوائية إن تم تفعيلها.",
    renewalHintAr: "راجع خطة EAS قبل نشر تطبيقات المتاجر.",
  },
  {
    id: "apple-developer",
    titleAr: "Apple Developer",
    provider: "Apple",
    category: "app_stores",
    priority: "high",
    status: "unknown",
    url: "https://developer.apple.com/account",
    billingUrl: "https://developer.apple.com/account",
    dashboardUrl: "https://appstoreconnect.apple.com/",
    notesAr: "ضروري عند نشر تطبيق iOS أو تحديثه.",
    renewalHintAr: "تأكد من التجديد السنوي حتى لا تتوقف التطبيقات.",
  },
  {
    id: "google-play-console",
    titleAr: "Google Play Console",
    provider: "Google Play",
    category: "app_stores",
    priority: "high",
    status: "unknown",
    url: "https://play.google.com/console",
    billingUrl: "https://payments.google.com/",
    dashboardUrl: "https://play.google.com/console",
    notesAr: "ضروري عند نشر تطبيق Android أو تحديثه.",
    renewalHintAr: "راجع حالة الحساب وسياسات المتجر.",
  },
  {
    id: "email-provider",
    titleAr: "البريد الإلكتروني للنظام",
    provider: "Email Provider",
    category: "email",
    priority: "medium",
    status: "unknown",
    url: "https://workspace.google.com/",
    billingUrl: "https://admin.google.com/ac/billing",
    dashboardUrl: "https://admin.google.com/",
    notesAr: "لإرسال التنبيهات والفواتير ورسائل النظام الرسمية.",
    renewalHintAr: "اضبط بريد رسمي مثل support@ أو billing@.",
  },
  {
    id: "sms-whatsapp-provider",
    titleAr: "الرسائل SMS / WhatsApp",
    provider: "Messaging Provider",
    category: "sms",
    priority: "medium",
    status: "unknown",
    url: "https://www.twilio.com/console",
    billingUrl: "https://www.twilio.com/console/billing",
    dashboardUrl: "https://www.twilio.com/console",
    notesAr: "لإرسال أكواد، تنبيهات تجهيز الطلب، وتذكير العملاء.",
    renewalHintAr: "راجع رصيد الرسائل وحدود الإرسال.",
  },
  {
    id: "monitoring-uptime",
    titleAr: "مراقبة التوقف والتنبيهات",
    provider: "Uptime Monitoring",
    category: "monitoring",
    priority: "high",
    status: "unknown",
    url: "https://uptimerobot.com/dashboard",
    billingUrl: "https://uptimerobot.com/billing",
    dashboardUrl: "https://uptimerobot.com/dashboard",
    notesAr: "تنبيه فوري عند توقف الموقع أو بطء الخادم.",
    renewalHintAr: "اربط الرابط الأساسي fawtara.sawihasa.digital بالتنبيه.",
  }
];

export function subscriptionPriorityScore(priority: DeveloperSubscriptionPriority) {
  switch (priority) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    default: return 1;
  }
}

export function sortedDeveloperSubscriptions() {
  return [...DEVELOPER_SUBSCRIPTION_LINKS].sort((a, b) => subscriptionPriorityScore(b.priority) - subscriptionPriorityScore(a.priority));
}
