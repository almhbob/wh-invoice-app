export const RELEASE_INFO = {
  version: "2026.05.16-employee-fallback-ready",
  labelAr: "إصدار معالجة دخول المستخدم عند تعطل تحميل البيانات",
  expectedRoutes: ["/", "/developer", "/dev", "/branches", "/diagnostics"],
  deploymentMarker: "employee-fallback-ready-2026-05-16",
  latestRequiredCommitHint: "بعد نشر هذا الإصدار يجب أن يظهر مستخدم احتياطي عند تعطل تحميل البيانات وأن تعمل صفحة التشخيص.",
  notesAr: [
    "تم منع بقاء شاشة دخول المستخدم بلا بيانات عند تأخر تحميل Firestore.",
    "تم دعم يوزر trial للشركة التجريبية ويوزر admin للشركات الأخرى عند الحاجة.",
    "تمت إضافة lastLoginAt وحقول username و pinCode و status إلى نموذج الموظف.",
    "صفحة /diagnostics تكشف حالة البناء ومتغيرات التشغيل.",
    "التشغيل التجريبي جاهز، والإنتاج النهائي يتطلب استكمال إعدادات Firebase من Railway و Firebase Console.",
  ],
};
