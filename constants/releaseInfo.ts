export const RELEASE_INFO = {
  version: "2026.05.14-developer-dashboard-force-deploy",
  labelAr: "تفعيل لوحة المطور واشتراكات الشركات وإجبار Vercel على النشر",
  expectedRoutes: ["/(tabs)/developer", "/developer", "/dev", "/branches"],
  deploymentMarker: "force-vercel-deploy-2026-05-14",
  notesAr: [
    "إذا لم تظهر لوحة المطور فهذا يعني أن Vercel لم ينشر آخر commit أو أن المتصفح يعرض نسخة مخزنة.",
    "لوحة المطور متاحة من قائمة المزيد باسم المطور بعد نشر هذه النسخة.",
    "تمت إضافة مسار dev كاختصار مباشر للوحة المطور.",
  ],
};
