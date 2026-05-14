export const RELEASE_INFO = {
  version: "2026.05.14-guarded-platform-release",
  labelAr: "بوابة شركة ومستخدم، حماية لوحة المطور، وتجهيز رفع العقود والصور",
  expectedRoutes: ["/", "/developer", "/dev", "/branches"],
  deploymentMarker: "guarded-platform-release-2026-05-14",
  latestRequiredCommitHint: "انشر آخر commit من GitHub واجعله Production Current في Vercel.",
  notesAr: [
    "النظام يجب أن يبدأ بدخول الشركة ثم دخول المستخدم، ولا يفتح الكاشير مباشرة.",
    "لوحة المطور محمية من الداخل ولا تعرض محتواها إلا للمستخدم المصرح.",
    "رفع العقود والصور يحتاج Firebase Storage Bucket وقواعد Storage منشورة.",
    "إذا ظهرت نسخة قديمة فهذا يعني أن Vercel لم يجعل آخر Deployment هو Current.",
  ],
};
