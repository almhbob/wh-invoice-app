export const RELEASE_INFO = {
  version: "2026.05.16-branch-ops-ready",
  labelAr: "إصدار طلبيات الفروع والجرد اليومي",
  expectedRoutes: ["/", "/developer", "/dev", "/branches", "/diagnostics"],
  deploymentMarker: "branch-ops-ready-2026-05-16",
  latestRequiredCommitHint: "أعد النشر ثم اختبر المزيد → الفروع: طلبية الفرع اليومية ولوحة الجرد.",
  notesAr: [
    "تمت إضافة طلبية الفرع اليومية للمنتجات من المصنع.",
    "تمت إضافة لوحة جرد الفرع لحساب المتوفر والخلصان والبيع والمرتجع والإكسباير والتالف والفرق.",
    "تم تجهيز قواعد Firestore لمجموعات branchProductionRequests و branchInventoryAudits.",
    "تمت إضافة خدمة branchOpsStore للانتقال من الحفظ المحلي إلى المزامنة المركزية.",
    "قسم المطور مغلق بالرمز ولا يبقى مفتوحًا بعد تحديث الصفحة.",
  ],
};
