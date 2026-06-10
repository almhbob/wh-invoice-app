import { Lang } from "@/constants/translations";

export type TenantAccessTranslationKey =
  | "checking"
  | "companyLoginTitle"
  | "companyLoginSubtitle"
  | "companyCodePlaceholder"
  | "loginByCode"
  | "createTrialCompany"
  | "openDemoCompany"
  | "requiredTitle"
  | "companyCodeRequired"
  | "trialReadyTitle"
  | "trialReadyMessage"
  | "changeCompany"
  | "employeeLoginTitle"
  | "currentCompany"
  | "usersCount"
  | "noUsers"
  | "loadingCompanyUsers"
  | "firestoreTimeout"
  | "employeeLoginPlaceholder"
  | "pinPlaceholder"
  | "employeeLoginButton"
  | "employeeLoginHint"
  | "invalidCredentialsTitle"
  | "invalidCredentialsMessage"
  | "requiredCredentialsMessage"
  | "createOwnerTitle"
  | "ownerNamePlaceholder"
  | "ownerIdPlaceholder"
  | "ownerCreateButton"
  | "creating"
  | "ownerNameRequired"
  | "ownerCredentialsRequired"
  | "temporaryLoginTitle"
  | "temporaryLoginMessage"
  | "deviceConflictTitle"
  | "deviceConflictMessage"
  | "deviceConflictCancel"
  | "deviceConflictForce"
  | "laviQrScanLabel"
  | "laviQrScanAnotherLabel"
  | "laviEnterBtn"
  | "laviOrCodeDivider";

const tenantAccessTranslations: Record<TenantAccessTranslationKey, Record<Lang, string>> = {
  checking: { ar: "جاري التحقق...", en: "Checking...", ur: "تصدیق جاری ہے...", hi: "जांच हो रही है...", bn: "যাচাই চলছে..." },
  companyLoginTitle: { ar: "دخول الشركة", en: "Company Login", ur: "کمپنی لاگ اِن", hi: "कंपनी लॉगिन", bn: "কোম্পানি লগইন" },
  companyLoginSubtitle: { ar: "يجب اختيار الشركة قبل فتح النظام حتى لا تختلط بيانات الشركات.", en: "Choose the company before opening the system to keep company data separated.", ur: "سسٹم کھولنے سے پہلے کمپنی منتخب کریں تاکہ ڈیٹا الگ رہے۔", hi: "डेटा अलग रखने के लिए सिस्टम खोलने से पहले कंपनी चुनें।", bn: "কোম্পানির তথ্য আলাদা রাখতে সিস্টেম খোলার আগে কোম্পানি নির্বাচন করুন।" },
  companyCodePlaceholder: { ar: "كود الشركة", en: "Company code", ur: "کمپنی کوڈ", hi: "कंपनी कोड", bn: "কোম্পানি কোড" },
  loginByCode: { ar: "دخول بالكود", en: "Login by code", ur: "کوڈ سے لاگ اِن", hi: "कोड से लॉगिन", bn: "কোড দিয়ে লগইন" },
  createTrialCompany: { ar: "إنشاء شركة جديدة تجريبية", en: "Create new trial company", ur: "نئی آزمائشی کمپنی بنائیں", hi: "नई ट्रायल कंपनी बनाएं", bn: "নতুন ট্রায়াল কোম্পানি তৈরি করুন" },
  openDemoCompany: { ar: "دخول الشركة الحالية / التجريبية", en: "Open current/demo company", ur: "موجودہ/ڈیمو کمپنی کھولیں", hi: "वर्तमान/डेमो कंपनी खोलें", bn: "বর্তমান/ডেমো কোম্পানি খুলুন" },
  requiredTitle: { ar: "مطلوب", en: "Required", ur: "ضروری", hi: "आवश्यक", bn: "প্রয়োজনীয়" },
  companyCodeRequired: { ar: "أدخل كود الشركة أو اختر الشركة التجريبية.", en: "Enter the company code or choose the trial company.", ur: "کمپنی کوڈ درج کریں یا آزمائشی کمپنی منتخب کریں۔", hi: "कंपनी कोड दर्ज करें या ट्रायल कंपनी चुनें।", bn: "কোম্পানি কোড দিন অথবা ট্রায়াল কোম্পানি নির্বাচন করুন।" },
  trialReadyTitle: { ar: "تم تجهيز الشركة التجريبية", en: "Trial company is ready", ur: "آزمائشی کمپنی تیار ہے", hi: "ट्रायल कंपनी तैयार है", bn: "ট্রায়াল কোম্পানি প্রস্তুত" },
  trialReadyMessage: { ar: "استخدم اليوزر trial ورمز الدخول 1234 للدخول كتجربة للشركة الجديدة.", en: "Use username trial and PIN 1234 to enter the new trial company.", ur: "نئی آزمائشی کمپنی کے لیے یوزر trial اور PIN 1234 استعمال کریں۔", hi: "नई ट्रायल कंपनी के लिए यूज़र trial और PIN 1234 इस्तेमाल करें।", bn: "নতুন ট্রায়াল কোম্পানিতে ঢুকতে username trial এবং PIN 1234 ব্যবহার করুন।" },
  changeCompany: { ar: "تغيير الشركة", en: "Change company", ur: "کمپنی تبدیل کریں", hi: "कंपनी बदलें", bn: "কোম্পানি পরিবর্তন" },
  employeeLoginTitle: { ar: "دخول المستخدم", en: "User Login", ur: "صارف لاگ اِن", hi: "यूज़र लॉगिन", bn: "ব্যবহারকারী লগইন" },
  currentCompany: { ar: "الشركة الحالية", en: "Current company", ur: "موجودہ کمپنی", hi: "वर्तमान कंपनी", bn: "বর্তমান কোম্পানি" },
  usersCount: { ar: "مستخدم", en: "user(s)", ur: "صارف", hi: "यूज़र", bn: "ব্যবহারকারী" },
  noUsers: { ar: "لا يوجد مستخدمون", en: "No users", ur: "کوئی صارف نہیں", hi: "कोई यूज़र नहीं", bn: "কোনো ব্যবহারকারী নেই" },
  loadingCompanyUsers: { ar: "جاري تحميل مستخدمي الشركة...", en: "Loading company users...", ur: "کمپنی صارفین لوڈ ہو رہے ہیں...", hi: "कंपनी यूज़र लोड हो रहे हैं...", bn: "কোম্পানি ব্যবহারকারী লোড হচ্ছে..." },
  firestoreTimeout: { ar: "لم يكتمل تحميل Firestore، يمكنك الدخول بمستخدم محلي إن وجد أو تغيير الشركة.", en: "Firestore did not finish loading. You can use a local user if available or change company.", ur: "Firestore مکمل لوڈ نہیں ہوا۔ مقامی صارف استعمال کریں یا کمپنی بدلیں۔", hi: "Firestore लोड पूरा नहीं हुआ। उपलब्ध हो तो लोकल यूज़र से प्रवेश करें या कंपनी बदलें।", bn: "Firestore লোড শেষ হয়নি। লোকাল ব্যবহারকারী থাকলে ব্যবহার করুন অথবা কোম্পানি বদলান।" },
  employeeLoginPlaceholder: { ar: "اليوزر أو الرقم الوظيفي", en: "Username or employee ID", ur: "یوزر یا ملازم نمبر", hi: "यूज़रनेम या कर्मचारी ID", bn: "ইউজারনেম বা কর্মচারী ID" },
  pinPlaceholder: { ar: "رمز الدخول", en: "PIN", ur: "PIN", hi: "PIN", bn: "PIN" },
  employeeLoginButton: { ar: "دخول المستخدم", en: "Login user", ur: "صارف داخل کریں", hi: "यूज़र लॉगिन", bn: "ব্যবহারকারী লগইন" },
  employeeLoginHint: { ar: "لكل موظف يوزر مستقل داخل شركته. افتراضيًا للموظفين القدامى يمكن استخدام الرقم الوظيفي ورمز 1234 حتى يتم تغييره.", en: "Each employee has a separate username inside the company. Older employees can use employee ID and PIN 1234 until changed.", ur: "ہر ملازم کا الگ یوزر ہے۔ پرانے ملازم نمبر اور PIN 1234 استعمال کر سکتے ہیں جب تک تبدیل نہ ہو۔", hi: "हर कर्मचारी का अलग यूज़र है। पुराने कर्मचारी ID और PIN 1234 इस्तेमाल कर सकते हैं जब तक बदला न जाए।", bn: "প্রতিটি কর্মচারীর আলাদা ইউজার আছে। পুরনো কর্মচারীরা পরিবর্তন না হওয়া পর্যন্ত ID ও PIN 1234 ব্যবহার করতে পারবেন।" },
  invalidCredentialsTitle: { ar: "بيانات غير صحيحة", en: "Invalid credentials", ur: "غلط معلومات", hi: "गलत जानकारी", bn: "ভুল তথ্য" },
  invalidCredentialsMessage: { ar: "لم يتم العثور على مستخدم مطابق داخل هذه الشركة، أو رمز الدخول غير صحيح.", en: "No matching user was found in this company, or the PIN is incorrect.", ur: "اس کمپنی میں صارف نہیں ملا یا PIN غلط ہے۔", hi: "इस कंपनी में यूज़र नहीं मिला या PIN गलत है।", bn: "এই কোম্পানিতে ব্যবহারকারী পাওয়া যায়নি, অথবা PIN ভুল।" },
  requiredCredentialsMessage: { ar: "أدخل اليوزر أو الرقم الوظيفي ورمز الدخول.", en: "Enter username or employee ID and PIN.", ur: "یوزر یا ملازم نمبر اور PIN درج کریں۔", hi: "यूज़रनेम या कर्मचारी ID और PIN दर्ज करें।", bn: "ইউজারনেম বা কর্মচারী ID এবং PIN দিন।" },
  createOwnerTitle: { ar: "لا يوجد مستخدمون لهذه الشركة. أنشئ أول مسؤول بيوزر ورمز دخول.", en: "No users exist for this company. Create the first admin with username and PIN.", ur: "اس کمپنی کے صارف نہیں ہیں۔ پہلا ایڈمن یوزر اور PIN سے بنائیں۔", hi: "इस कंपनी में यूज़र नहीं हैं। पहला एडमिन यूज़रनेम और PIN से बनाएं।", bn: "এই কোম্পানিতে ব্যবহারকারী নেই। ইউজারনেম ও PIN দিয়ে প্রথম অ্যাডমিন তৈরি করুন।" },
  ownerNamePlaceholder: { ar: "اسم المسؤول", en: "Admin name", ur: "ایڈمن نام", hi: "एडमिन नाम", bn: "অ্যাডমিন নাম" },
  ownerIdPlaceholder: { ar: "يوزر / الرقم الوظيفي", en: "Username / employee ID", ur: "یوزر / ملازم نمبر", hi: "यूज़रनेम / कर्मचारी ID", bn: "ইউজারনেম / কর্মচারী ID" },
  ownerCreateButton: { ar: "إنشاء المسؤول والدخول", en: "Create admin and login", ur: "ایڈمن بنا کر داخل ہوں", hi: "एडमिन बनाकर लॉगिन", bn: "অ্যাডমিন তৈরি করে লগইন" },
  creating: { ar: "جاري الإنشاء...", en: "Creating...", ur: "بن رہا ہے...", hi: "बन रहा है...", bn: "তৈরি হচ্ছে..." },
  ownerNameRequired: { ar: "أدخل اسم المسؤول.", en: "Enter the admin name.", ur: "ایڈمن نام درج کریں۔", hi: "एडमिन नाम दर्ज करें।", bn: "অ্যাডমিন নাম দিন।" },
  ownerCredentialsRequired: { ar: "أدخل اليوزر/الرقم الوظيفي ورمز الدخول.", en: "Enter username/employee ID and PIN.", ur: "یوزر/ملازم نمبر اور PIN درج کریں۔", hi: "यूज़रनेम/कर्मचारी ID और PIN दर्ज करें।", bn: "ইউজারনেম/কর্মচারী ID এবং PIN দিন।" },
  temporaryLoginTitle: { ar: "تم الدخول مؤقتًا", en: "Temporary login enabled", ur: "عارضی لاگ اِن ہو گیا", hi: "अस्थायी लॉगिन हो गया", bn: "অস্থায়ী লগইন হয়েছে" },
  temporaryLoginMessage: { ar: "تم إنشاء مسؤول محلي مؤقت لأن Firebase غير مكتملة. اربط Firebase لاحقًا لحفظ المستخدم في قاعدة البيانات بشكل دائم.", en: "A temporary local admin was created because Firebase is incomplete. Connect Firebase later to save users permanently.", ur: "Firebase مکمل نہیں، اس لیے عارضی مقامی ایڈمن بنایا گیا۔ مستقل محفوظ کرنے کے لیے Firebase جوڑیں۔", hi: "Firebase अधूरा है, इसलिए अस्थायी लोकल एडमिन बनाया गया। स्थायी सेव के लिए Firebase जोड़ें।", bn: "Firebase অসম্পূর্ণ, তাই অস্থায়ী লোকাল অ্যাডমিন তৈরি হয়েছে। স্থায়ীভাবে সংরক্ষণের জন্য Firebase যুক্ত করুন।" },
  deviceConflictTitle:   { ar: "مسجل دخول من جهاز آخر",                               en: "Signed in on another device",                           ur: "دوسرے آلے پر لاگ اِن ہے",              hi: "दूसरे डिवाइस पर साइन इन",             bn: "অন্য ডিভাইসে সাইন ইন আছেন" },
  deviceConflictMessage: { ar: "مسجل الدخول حالياً على جهاز آخر. هل تريد تسجيل الدخول وإزالة الجهاز الآخر؟", en: "Currently signed in on another device. Sign in here and remove the other device?", ur: "ابھی دوسرے آلے پر لاگ اِن ہے۔ یہاں لاگ اِن کریں اور دوسرا آلہ ہٹائیں؟", hi: "अभी दूसरे डिवाइस पर साइन इन है। यहाँ साइन इन करें और दूसरा डिवाइस हटाएँ?", bn: "এখন অন্য ডিভাইসে সাইন ইন আছেন। এখানে সাইন ইন করে অন্য ডিভাইস সরাবেন?" },
  deviceConflictCancel:  { ar: "إلغاء",                                                en: "Cancel",                                                ur: "منسوخ",                                hi: "रद्द करें",                           bn: "বাতিল" },
  deviceConflictForce:   { ar: "تسجيل الدخول وإزالة الجهاز الآخر",                   en: "Sign in and remove other device",                       ur: "لاگ اِن کریں اور دوسرا آلہ ہٹائیں",    hi: "साइन इन करें और दूसरा डिवाइस हटाएँ",  bn: "সাইন ইন করুন ও অন্য ডিভাইস সরান" },
  laviQrScanLabel:       { ar: "امسح للدخول على أي جهاز",                             en: "Scan to sign in on any device",                         ur: "کسی بھی آلے پر سائن ان کے لیے اسکین کریں", hi: "किसी भी डिवाइस पर साइन इन के लिए स्कैन करें", bn: "যেকোনো ডিভাইসে সাইন ইনের জন্য স্ক্যান করুন" },
  laviQrScanAnotherLabel:{ ar: "امسح للدخول على أي جهاز آخر",                         en: "Scan to sign in on another device",                     ur: "دوسرے آلے پر سائن ان کے لیے اسکین کریں",  hi: "दूसरे डिवाइस पर साइन इन के लिए स्कैन करें", bn: "অন্য ডিভাইসে সাইন ইনের জন্য স্ক্যান করুন" },
  laviEnterBtn:          { ar: "دخول لاففيان",                                         en: "Enter Laviviane",                                       ur: "لاففیان میں داخل ہوں",                 hi: "Laviviane में प्रवेश करें",             bn: "Laviviane-এ প্রবেশ করুন" },
  laviOrCodeDivider:     { ar: "أو أدخل كود الشركة",                                  en: "Or enter company code",                                 ur: "یا کمپنی کوڈ درج کریں",               hi: "या कंपनी कोड दर्ज करें",              bn: "অথবা কোম্পানি কোড দিন" },
};

export function tenantAccessText(key: TenantAccessTranslationKey, lang: Lang) {
  return tenantAccessTranslations[key]?.[lang] ?? tenantAccessTranslations[key]?.ar ?? key;
}
