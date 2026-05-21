export const RELEASE_INFO = {
  version: "2026.05.16-clean-ready",
  labelAr: "إصدار مستقر بعد تنظيف المستودع",
  expectedRoutes: ["/", "/developer", "/dev", "/branches", "/diagnostics"],
  deploymentMarker: "clean-ready-2026-05-16",
  latestRequiredCommitHint: "أعد النشر بعد هذا التحديث ثم اختبر الدخول واستقرار الجلسة.",
  notesAr: [
    "تم تثبيت جلسة الموظف حتى لا يخرج النظام إلا بتسجيل خروج.",
    "تم حذف أداة غير مستخدمة لتقليل الملفات الزائدة.",
    "تم الإبقاء على ملفات Railway والتشخيص لأنها لازمة للتشغيل.",
    "صفحة التشخيص متاحة عبر /diagnostics.",
  ],
};
