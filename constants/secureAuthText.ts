import type { Lang } from "@/constants/translations";

const TEXT = {
  changePinTitle:      { ar: "اختر رمز دخول جديداً",            en: "Choose a new PIN" },
  changePinForced:     { ar: "لحماية حسابك يجب تغيير الرمز الحالي قبل المتابعة.", en: "To protect your account, you must change your current PIN before continuing." },
  setPinTitle:         { ar: "تعيين رمز الدخول",                en: "Set login PIN" },
  setPinFor:           { ar: "رمز مؤقت للموظف",                 en: "Temporary PIN for" },
  setPinTempNote:      { ar: "سيُطلب من الموظف تغييره عند أول دخول.", en: "The employee will be asked to change it at first login." },
  currentPin:          { ar: "الرمز الحالي",                    en: "Current PIN" },
  newPin:              { ar: "الرمز الجديد (٤–٨ أرقام)",         en: "New PIN (4–8 digits)" },
  confirmPin:          { ar: "تأكيد الرمز الجديد",              en: "Confirm new PIN" },
  save:                { ar: "حفظ",                             en: "Save" },
  cancel:              { ar: "إلغاء",                           en: "Cancel" },
  logout:              { ar: "تسجيل الخروج",                    en: "Sign out" },
  pinMismatch:         { ar: "الرمزان غير متطابقين.",            en: "PINs do not match." },
  err_pin_format:      { ar: "الرمز يجب أن يكون من ٤ إلى ٨ أرقام.", en: "PIN must be 4–8 digits." },
  err_pin_weak:        { ar: "هذا الرمز سهل التخمين. اختر رمزاً آخر.", en: "This PIN is too easy to guess. Choose another." },
  err_pin_same:        { ar: "الرمز الجديد مطابق للحالي.",       en: "The new PIN matches the current one." },
  err_invalid_current_pin: { ar: "الرمز الحالي غير صحيح.",       en: "Current PIN is incorrect." },
  err_forbidden:       { ar: "ليست لديك صلاحية لتغيير رمز هذا الموظف.", en: "You are not allowed to change this employee's PIN." },
  err_locked:          { ar: "محاولات كثيرة. حاول مجدداً بعد {m} دقيقة.", en: "Too many attempts. Try again in {m} min." },
  err_network:         { ar: "تعذر الاتصال بالخادم. تحقق من الإنترنت.", en: "Could not reach the server. Check your connection." },
  err_generic:         { ar: "حدث خطأ غير متوقع. حاول مرة أخرى.", en: "Something went wrong. Please try again." },
  secureBadge:         { ar: "دخول آمن مُفعّل",                 en: "Secure sign-in enabled" },
  authUnavailableTitle:{ ar: "تسجيل الدخول الآمن غير متاح",     en: "Secure sign-in is unavailable" },
  authUnavailableMessage: { ar: "أوقفنا الدخول المحلي لحماية البيانات. تحقّق من إعداد Pages Function /api/auth/status وسر FIREBASE_SERVICE_ACCOUNT لبيئة staging، ثم أعد تحميل التطبيق.", en: "Local sign-in is disabled to protect your data. Verify the /api/auth/status Pages Function and the staging FIREBASE_SERVICE_ACCOUNT secret, then reload the app." },
  pinRequiredForNew:   { ar: "رمز الدخول (٤–٨ أرقام)",           en: "Login PIN (4–8 digits)" },
  setPinAction:        { ar: "تعيين رمز الدخول",                en: "Set login PIN" },
  pinSaved:            { ar: "تم حفظ رمز الدخول.",               en: "PIN saved." },
  switchNeedsLogin:    { ar: "للتبديل إلى موظف آخر سجّل الخروج ثم ادخل بحسابه.", en: "To switch employee, sign out and sign in with their account." },
} as const;

export type SecureAuthTextKey = keyof typeof TEXT;

export function secureAuthText(key: SecureAuthTextKey, lang: Lang, vars: Record<string, string | number> = {}) {
  const entry = TEXT[key] as { ar: string; en: string };
  let s = lang === "ar" ? entry.ar : entry.en;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function secureAuthErrorText(code: string, lang: Lang, retryAfter?: number) {
  const key = `err_${code}` as SecureAuthTextKey;
  if (code === "locked") return secureAuthText("err_locked", lang, { m: Math.max(1, Math.ceil((retryAfter ?? 900) / 60)) });
  if (key in TEXT) return secureAuthText(key, lang);
  return secureAuthText("err_generic", lang);
}
