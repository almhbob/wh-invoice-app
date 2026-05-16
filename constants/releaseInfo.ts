export const RELEASE_INFO = {
  version: "2026.05.16-production-redeploy-check",
  labelAr: "إجبار النشر بعد بوابة الشركة والمستخدم وطلبات تفعيل الاشتراك",
  expectedRoutes: ["/", "/developer", "/dev", "/branches"],
  deploymentMarker: "force-production-redeploy-2026-05-16",
  latestRequiredCommitHint: "يجب أن يكون هذا الإصدار هو Production Current في Vercel حتى تفتح الروابط وتظهر آخر التعديلات.",
  notesAr: [
    "النظام يبدأ بدخول الشركة ثم دخول المستخدم ولا يفتح الكاشير مباشرة.",
    "الشركة الجديدة التجريبية متاحة من بوابة الدخول بيوزر trial ورمز 1234.",
    "تم تجهيز خدمة طلب تفعيل الاشتراك وحفظ الطلبات محليًا ومع Firestore عند توفر الصلاحيات.",
    "لوحة المطور محمية من الداخل وتعرض حالة الإصدار وفحص جاهزية الإنتاج.",
    "إذا لم يفتح الرابط بعد هذا الإصدار فالمشكلة من Vercel Production Current أو DNS للدومين.",
  ],
};
