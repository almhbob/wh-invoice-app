// Screenshots with FAKE data only: Firebase network is blocked, orders are seeded into the local cache.
const { chromium } = require('playwright');
const iso = (minFromNow) => new Date(Date.now() + minFromNow * 60000).toISOString();
const due = (minFromNow) => { const d = new Date(Date.now() + minFromNow * 60000); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const base = (n, extra) => ({
  id: 'demo' + n, companyId: 'laviviane-trial', orderNumber: 100 + n, customerName: ['نورة العتيبي', 'فهد القحطاني', 'ريم الدوسري', 'سلمان الشهري', 'هيا المطيري', 'عبدالله الحربي'][n % 6],
  customerPhone: '0500000' + String(100 + n), receivedAt: due(-60), createdAt: iso(-90 + n), updatedAt: iso(-5), departmentReceivers: {}, paymentMethod: 'card', trackingCode: 'demo' + n + 'abcdef',
  ...extra,
});
const orders = [
  base(1, { orderType: 'delivery', deliveryAddress: 'حي الملقا، شارع أنس بن مالك', deliveryTime: due(-15), totalAmount: 420, amountPaid: 200,
    items: [{ id: 'a', name: 'كيك بستاشيو ٢٠ شخص', quantity: 1, price: 380, department: 'cake', writing: { text: 'عيد ميلاد سعيد يا لمى 🎂', surface: 'jelly_on_sugar', color: 'ذهبي', note: 'خط ثلث في المنتصف' } }, { id: 'b', name: 'معمول تمر', quantity: 2, price: 20, department: 'halwa' }],
    departmentStatuses: { cake: 'in_progress', halwa: 'done', packaging: 'pending' }, departmentReceivers: { cake: { name: 'منى', employeeId: 'K1', timestamp: iso(-40) } }, writingStatus: 'in_progress' }),
  base(2, { orderType: 'pickup', deliveryTime: due(45), totalAmount: 160, amountPaid: 160,
    items: [{ id: 'c', name: 'بوكس شوكولاتة فاخر', quantity: 2, price: 80, department: 'chocolate' }], departmentStatuses: { chocolate: 'pending', packaging: 'pending' } }),
  base(3, { orderType: 'delivery', deliveryAddress: 'حي النرجس', deliveryTime: due(90), totalAmount: 250, amountPaid: 250,
    items: [{ id: 'd', name: 'ميني كرواسون', quantity: 24, price: 6, department: 'mawali' }, { id: 'e', name: 'تشيز كيك', quantity: 1, price: 106, department: 'cake' }],
    departmentStatuses: { mawali: 'done', cake: 'done', packaging: 'done' }, deliveryStatus: 'assigned', deliveryDriver: { name: 'مسؤول', employeeId: 'LAVI001', phone: '0555555555', assignedAt: iso(-3) }, source: 'online' }),
  base(4, { orderType: 'delivery', deliveryAddress: 'حي الياسمين', deliveryTime: due(20), totalAmount: 300, amountPaid: 0,
    items: [{ id: 'f', name: 'صينية بسبوسة', quantity: 1, price: 300, department: 'halwa' }], departmentStatuses: { halwa: 'done', packaging: 'done' }, deliveryStatus: 'out_for_delivery', dispatchedAt: iso(-10), deliveryDriver: { name: 'مسؤول', employeeId: 'LAVI001', phone: '0544444444', assignedAt: iso(-30) }, driverRequest: { type: 'transfer', reason: 'بعد المسافة', note: 'الطلب في شمال الرياض وأنا في الجنوب', at: iso(-5), by: { name: 'ماجد', employeeId: 'LAVI001' }, status: 'open' } }),
  base(5, { orderType: 'pickup', deliveryTime: due(240), totalAmount: 95,
    items: [{ id: 'g', name: 'كيك شوكولاتة صغير', quantity: 1, price: 95, department: 'cake', writing: { text: 'مبروك التخرج م. سارة', surface: 'cream' } }], departmentStatuses: { cake: 'pending', packaging: 'pending' }, writingStatus: 'pending' }),
];
const outbox = [base(6, { orderType: 'pickup', deliveryTime: due(120), totalAmount: 60, items: [{ id: 'h', name: 'كوكيز', quantity: 6, price: 10, department: 'halwa' }], departmentStatuses: { halwa: 'pending', packaging: 'pending' }, syncState: 'failed' })];

(async () => {
  const b = await chromium.launch();
  const run = async (name, vp, routes, full) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 600 ? 2 : 1, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await ctx.route(/firestore\.googleapis|firebasestorage|identitytoolkit|securetoken|firebaseinstallations/, (r) => r.abort());
    await ctx.addInitScript(([o, ob]) => {
      localStorage.setItem('@orders_local_v2_laviviane-trial', JSON.stringify(o));
      localStorage.setItem('@orders_outbox_v1_laviviane-trial', JSON.stringify(ob));
    }, [orders, outbox]);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:4000/', { waitUntil: 'load' }); await p.waitForTimeout(6000);
    await p.screenshot({ path: `shots/${name}-gate.png` });
    await p.getByText('دخول لاففيان').first().click(); await p.waitForTimeout(4000);
    await p.getByPlaceholder('اليوزر أو الرقم الوظيفي').fill('LAVI001');
    await p.getByPlaceholder('رمز الدخول').fill('1234');
    await p.getByText('دخول المستخدم', { exact: true }).last().click(); await p.waitForTimeout(4000);
    for (const r of routes) {
      await p.goto('http://localhost:4000/' + r, { waitUntil: 'load' }); await p.waitForTimeout(4500);
      await p.screenshot({ path: `shots/${name}-${r}.png`, fullPage: !!full });
    }
    if (name === 'm') {
      await p.goto('http://localhost:4000/online', { waitUntil: 'load' }); await p.waitForTimeout(3500);
      await p.getByText(/إعدادات المتجر/).first().click(); await p.waitForTimeout(1200);
      await p.screenshot({ path: 'shots/m-store-settings.png' });
      await p.mouse.wheel(0, 900); await p.waitForTimeout(500);
      await p.screenshot({ path: 'shots/m-store-settings2.png' });
      await p.goto('http://localhost:4000/tracking', { waitUntil: 'load' }); await p.waitForTimeout(4000);
      await p.getByText('#104').first().click(); await p.waitForTimeout(1500);
      await p.screenshot({ path: 'shots/m-details.png' });
      await p.mouse.wheel(0, 900); await p.waitForTimeout(600);
      await p.screenshot({ path: 'shots/m-details2.png' });
      await p.goto('http://localhost:4000/cashier', { waitUntil: 'load' }); await p.waitForTimeout(4000);
      try {
        await p.getByPlaceholder('أدخل اسم العميل').first().fill('ريم الدوسري');
        await p.getByPlaceholder('05XXXXXXXX').first().fill('0501234567');
        await p.getByPlaceholder('صنف 1').first().fill('كيك فانيلا بالتوت');
        await p.getByText('إضافة عبارة للخطاط').first().click(); await p.waitForTimeout(400);
        await p.getByPlaceholder('العبارة كما تُكتب بالضبط…').first().fill('كل عام وأنتِ بخير يا أمي');
        await p.getByText('طباعة على سكر').first().click();
        await p.screenshot({ path: 'shots/m-cashier-writing.png' });
        await p.getByText('إرسال الفاتورة').last().click().catch(async () => { await p.getByText(/إرسال/).last().click(); });
        await p.waitForTimeout(1500);
        await p.screenshot({ path: 'shots/m-review.png' });
      } catch (e) { console.log('review step failed', String(e).slice(0, 300)); await p.screenshot({ path: 'shots/m-cashier.png', fullPage: true }); }
    }
    console.log(name, 'pageerrors', errs.length, errs.slice(0, 3));
    await ctx.close();
  };
  await run('m', { width: 400, height: 860 }, ['home', 'cashier', 'halwa', 'tracking']);
  await run('d', { width: 1366, height: 820 }, ['home', 'cashier']);
  const fs = require('fs');
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, locale: 'ar-SA' });
  await p.route(/\/api\/catalog/, (r) => r.fulfill({ contentType: 'application/json', body: fs.readFileSync('scripts/ci/catalog.json', 'utf8') }));
  await p.route('http://localhost:4000/order-preview', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync('server/pages/order.html', 'utf8') }));
  await p.goto('http://localhost:4000/order-preview', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots/o-menu.png' });
  const fontOk = await p.evaluate(() => document.fonts.check('16px "Laviviane Sans"', 'مرحبا'));
  const r = await p.request.get('http://localhost:4000/brand-fonts/PlexArabic-Bold.woff');
  console.log('brand font served', r.status(), 'loaded', fontOk);
  await b.close();
})();
