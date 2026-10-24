# تفعيل الدخول الآمن (Server-verified login)

## ماذا يحل هذا؟
- قواعد Firestore القديمة تسمح لأي جلسة مجهولة (يحصل عليها أي شخص) بقراءة وتعديل بيانات **كل الشركات**: الطلبات، العملاء، الموظفين ورموزهم.
- التحقق من رمز الدخول كان داخل المتصفح فقط، وتوجد حسابات برموز ثابتة داخل الكود (`LAVI001 / 1234` …).

بعد التفعيل:
- الرمز يُتحقق منه على الخادم (Cloudflare Pages Functions) ويُخزَّن مشفّراً (PBKDF2) في مجموعة لا يقرؤها أي عميل.
- كل جلسة تحمل هوية موقّعة (الشركة + الدور + الموظف) وقواعد Firestore تفرضها.
- قفل تلقائي بعد محاولات خاطئة متكررة.
- أي رمز ضعيف (1234، 0000 …) يُجبر صاحبه على تغييره عند أول دخول.
- الرموز القديمة تُنقل تلقائياً عند أول دخول لكل موظف — لا حاجة لإعادة إنشاء الحسابات.
- صلاحية لوحة المطور لا تؤخذ من دور الموظف القابل للتعديل؛ يصدرها الخادم فقط من marker مُدار بصلاحيات Firebase Admin.

## خطوات التفعيل (بالترتيب)

### 1) مفتاح حساب الخدمة من Firebase
Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key** → يُحمَّل ملف JSON.
> هذا الملف سرّي: لا ترفعه إلى GitHub ولا ترسله لأحد.

### 2) إضافة المفتاح إلى Cloudflare
Cloudflare Dashboard → Workers & Pages → مشروع **fotra** → Settings → **Variables and Secrets** → Add:
- Type: **Secret**
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: محتوى ملف JSON كاملاً
- Environment: **Production**

ثم أعد النشر (GitHub → Actions → Deploy to Cloudflare Pages → Run workflow).

**تحقق:** افتح `https://fotra-dv1.pages.dev/api/auth/status` — يجب أن يظهر `"configured": true`.
سيظهر في شاشة الدخول: «🔒 دخول آمن مُفعّل».

**اختبر الآن:** ادخل بحساب المسؤول الحقيقي (المسجّل في Firestore). سيُطلب منك اختيار رمز جديد إن كان رمزك ضعيفاً.
> الحسابات المكتوبة في الكود فقط (غير الموجودة في Firestore) لن تعمل في الوضع الآمن.
> **مهم:** لا تحذف `FIREBASE_SERVICE_ACCOUNT` كتراجع؛ في الإصدار الإنتاجي يؤدي غياب المصادقة الآمنة إلى إيقاف الدخول المحلي حمايةً للبيانات. استخدم خدمة Firebase منفصلة لبيئة staging، ولا تنسخ مفتاح حساب الخدمة الإنتاجي إليها. خيار legacy متاح للتطوير المحلي فقط عبر `EXPO_PUBLIC_ALLOW_LEGACY_AUTH=true` مع `NODE_ENV` غير إنتاجي.

### 3) قفل قواعد قاعدة البيانات (بعد نجاح الخطوة 2)
- Firebase Console → Firestore Database → **Rules** → الصق محتوى `firestore.rules` → **Publish**.
- Firebase Console → Storage → **Rules** → الصق محتوى `storage.rules` → **Publish**.

**تراجع:** الصق `firestore.legacy.rules` و `storage.legacy.rules`.

### 4) تهيئة Firebase staging بشكل مستقل
- أنشئ مشروع Firebase منفصلًا لبيئة staging، مع Firestore وStorage وقواعد اختبارية فارغة؛ لا تنسخ بيانات الإنتاج أو ملف `FIREBASE_SERVICE_ACCOUNT` الإنتاجي.
- اضبط متغيرات `EXPO_PUBLIC_FIREBASE_*` الخاصة بمشروع staging في إعدادات بيئة staging في Cloudflare Pages. نطاق `fotra-staging.pages.dev` لا يعود تلقائيًا إلى إعدادات Firebase الإنتاجية إذا كانت متغيرات staging ناقصة.
- أضف `FIREBASE_SERVICE_ACCOUNT` من حساب خدمة مشروع staging فقط إلى بيئة staging في Cloudflare Pages، ثم تحقق من `/api/auth/status` على نطاق staging قبل اختبار الدخول.
- في بيئة التطوير المحلية، استخدم `EXPO_PUBLIC_APP_ENV=staging` لإجبار استخدام إعداد staging. اتركه غير مضبوط للإنتاج المحلي المعتاد.

### 5) منح صلاحية مالك المنصة
- أنشئ عبر Firebase Admin SDK فقط مستندًا في `platformOwners` بمعرّف `<companyId>__<employeeDocumentId>` وحقول `active: true` و`platformRole: "owner"` أو `"developer"` أو `"super_admin"`.
- لا تنشئ هذا المستند من التطبيق؛ قواعد Firestore تمنع العملاء من قراءته أو تغييره أو حذف حساب الموظف المرتبط به.
- بعد نشر القواعد، سجّل خروج المستخدم ثم دخوله من جديد ليحصل على المطالبة الموقّعة. لا تكشف الـservice account JSON أو تضفه إلى GitHub.

## بعد التفعيل
- إضافة موظف: من لوحة المشرف مع رمز دخول مؤقت؛ يغيّره الموظف عند أول دخول.
- نسي موظف رمزه: المشرف → الموظف → «تعيين رمز الدخول».
- التبديل بين الموظفين يتطلب رمز الموظف الآخر.

## الاختبارات
- `bun test server/auth` — منطق الخادم (التحقق، التشفير، القفل، الصلاحيات).
- `tests/rules/firestore.rules.test.mjs` — قواعد Firestore على المحاكي (تعمل تلقائياً في GitHub Actions).
