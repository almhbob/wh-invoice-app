const localLegacyOptIn = typeof __DEV__ !== "undefined"
  && __DEV__
  && process.env.EXPO_PUBLIC_ALLOW_LEGACY_AUTH === "true";

export const bootstrapPolicy = {
  allowLocalBootstrap: localLegacyOptIn,
  productionRequiredActionAr: "اترك Bootstrap المحلي معطلًا في الإنتاج واستخدم مصادقة الخادم ومطالبات Firebase الموقّعة.",
  reasonAr: localLegacyOptIn
    ? "تم تفعيل مسار Legacy محليًا عبر خيار تطوير صريح؛ لا تستخدم هذا الإعداد في أي نشر عام."
    : "Bootstrap المحلي معطل؛ لا يعمل إلا في Expo development مع خيار EXPO_PUBLIC_ALLOW_LEGACY_AUTH الصريح.",
};

export function localBootstrapWarningAr() {
  return `${bootstrapPolicy.reasonAr} ${bootstrapPolicy.productionRequiredActionAr}`;
}
