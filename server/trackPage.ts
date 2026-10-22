// Public order-tracking page, served by functions/track.ts (functions take precedence over the SPA fallback).
export const TRACK_PAGE_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#2B211B" />
<meta name="robots" content="noindex" />
<title>تتبع الطلب</title>
<style>
  :root { --esp:#2B211B; --esp2:#1C1511; --gold:#B8955A; --gold2:#D9C08F; --ivory:#F6F2EC; --ink:#231B16; --muted:#8C7F72; --line:#E7DFD3; --ok:#4F8A68; --info:#4F6D8F; --bad:#B5544A; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ivory); color:var(--ink); font-family: -apple-system, "Segoe UI", Tahoma, "Noto Kufi Arabic", sans-serif; }
  .hero { background:linear-gradient(160deg,var(--esp),var(--esp2)); color:#fff; padding:28px 20px 64px; text-align:center; }
  .brand { letter-spacing:.18em; font-size:13px; color:var(--gold2); font-weight:700; text-transform:uppercase; }
  .hello { margin:14px 0 4px; font-size:15px; color:rgba(255,255,255,.7); }
  .num { font-size:15px; color:rgba(255,255,255,.75); }
  .stage { margin-top:10px; font-size:26px; font-weight:800; }
  .sub { margin-top:6px; font-size:14px; color:var(--gold2); }
  .wrap { max-width:520px; margin:-44px auto 0; padding:0 16px 40px; display:grid; gap:12px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:20px; padding:18px; }
  .steps { display:flex; align-items:flex-start; }
  .step { flex:0 0 64px; text-align:center; font-size:11px; color:var(--muted); font-weight:600; }
  .dot { width:30px; height:30px; margin:0 auto 6px; border-radius:50%; border:2px solid var(--line); display:grid; place-items:center; background:#fff; font-size:13px; }
  .step.done .dot { background:var(--ok); border-color:var(--ok); color:#fff; }
  .step.now .dot { border-color:var(--gold); background:#B8955A1A; color:var(--esp); }
  .step.done, .step.now { color:var(--ink); font-weight:800; }
  .bar { flex:1; height:2px; background:var(--line); margin-top:15px; }
  .bar.on { background:var(--ok); }
  h3 { margin:0 0 10px; font-size:13px; color:var(--muted); }
  .item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--line); font-size:14px; }
  .item:last-child { border:0; }
  .ev { display:flex; gap:10px; padding:6px 0; font-size:13px; }
  .ev b { flex:1; font-weight:700; }
  .ev span { color:var(--muted); font-size:12px; }
  .note { text-align:center; color:var(--muted); font-size:12px; }
  .state { text-align:center; padding:40px 10px; color:var(--muted); }
  .pill { display:inline-block; margin-top:12px; background:rgba(217,192,143,.15); color:var(--gold2); border-radius:999px; padding:6px 14px; font-size:13px; font-weight:700; }
</style>
</head>
<body>
<div class="hero">
  <div class="brand" id="brand">&nbsp;</div>
  <div class="hello" id="hello"></div>
  <div class="num" id="num"></div>
  <div class="stage" id="stage">جارٍ التحميل…</div>
  <div class="sub" id="sub"></div>
  <div id="driver"></div>
</div>
<div class="wrap" id="wrap"></div>
<script>
(function () {
  var q = new URLSearchParams(location.search), c = q.get("c"), t = q.get("t");
  var STAGE = {
    received: ["تم استلام طلبك", "الطلب وصل للمطبخ وسيبدأ التحضير قريباً"],
    in_production: ["طلبك قيد التحضير", "فريقنا يعمل على طلبك الآن"],
    ready: ["طلبك جاهز", null],
    out_for_delivery: ["طلبك في الطريق إليك", "السائق خرج للتوصيل"],
    delivered: ["تم التسليم", "نتمنى أن ينال إعجابك 🌸"],
    picked_up: ["تم الاستلام", "شكراً لزيارتك 🌸"],
    delivery_failed: ["تعذّر التسليم", "سنتواصل معك لترتيب موعد جديد"],
    cancelled: ["أُلغي الطلب", "للاستفسار تواصل مع الفرع"],
    awaiting_confirmation: ["وصلنا طلبك ✨", "بانتظار تأكيد الفرع — سنرسل لك التأكيد قريباً"],
    rejected: ["نعتذر، لم نتمكن من قبول الطلب", null]
  };
  var LABEL = { received: "استلام", in_production: "تحضير", ready: "جاهز", out_for_delivery: "مع السائق", delivered: "تسليم", picked_up: "استلام العميل" };
  var EV = { online_received: "وصل طلبك الأونلاين", created: "استُلم الطلب", dept_started: "بدأ التحضير", ready: "اكتمل التحضير", dispatched: "خرج للتوصيل", delivered: "تم التسليم", picked_up: "استلمه العميل", delivery_failed: "تعذّر التسليم" };
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function fmt(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("ar-SA", { weekday: "short", hour: "2-digit", minute: "2-digit" }); }
  function fail(msg) { el("stage").textContent = msg; el("wrap").innerHTML = ""; }
  if (!c || !t) return fail("رابط التتبع غير صحيح");

  function render(d) {
    document.title = "تتبع الطلب" + (d.orderNumber ? " #" + d.orderNumber : "") + (d.brand ? " · " + d.brand : "");
    el("brand").textContent = d.brand || "";
    el("hello").textContent = d.customerFirstName ? "أهلاً " + d.customerFirstName : "";
    el("num").textContent = d.orderNumber ? "طلب رقم #" + d.orderNumber : "طلب أونلاين";
    var s = STAGE[d.stage] || [d.stage, ""];
    el("stage").textContent = s[0];
    var sub = s[1];
    if (d.stage === "ready") sub = d.orderType === "delivery" ? "سيخرج للتوصيل قريباً" : "بانتظارك في الفرع";
    if (d.stage === "rejected") sub = d.rejectReason ? "السبب: " + d.rejectReason : "للاستفسار تواصل مع الفرع";
    el("sub").textContent = (sub || "") + (d.scheduledFor && ["delivered", "picked_up", "cancelled"].indexOf(d.stage) < 0 ? " · الموعد: " + d.scheduledFor : "");
    el("driver").innerHTML = d.stage === "out_for_delivery" && d.driverName ? '<span class="pill">🚚 السائق: ' + esc(d.driverName) + "</span>" : "";

    var steps = d.orderType === "delivery" ? ["received", "in_production", "ready", "out_for_delivery", "delivered"] : ["received", "in_production", "ready", "picked_up"];
    var cur = d.stage === "awaiting_confirmation" ? -1 : d.stage === "rejected" ? -2 : steps.indexOf(d.stage === "delivery_failed" ? "ready" : d.stage);
    var finished = d.stage === "delivered" || d.stage === "picked_up";
    var html = cur === -2 ? "" : '<div class="card"><div class="steps">';
    if (cur === -2) { steps = []; }
    steps.forEach(function (k, i) {
      if (i) html += '<div class="bar' + (i <= cur ? " on" : "") + '"></div>';
      var cls = i < cur || (finished && i === cur) ? "done" : i === cur ? "now" : "";
      html += '<div class="step ' + cls + '"><div class="dot">' + (cls === "done" ? "✓" : i + 1) + "</div>" + LABEL[k] + "</div>";
    });
    if (cur !== -2) html += "</div></div>";
    if (d.items && d.items.length) {
      html += '<div class="card"><h3>محتويات الطلب</h3>' + d.items.map(function (i) { return '<div class="item"><span>' + esc(i.name) + "</span><b>× " + esc(i.quantity) + "</b></div>"; }).join("") + "</div>";
    }
    var evs = (d.events || []).filter(function (e, i, a) { return e.type !== "dept_started" || a.findIndex(function (x) { return x.type === "dept_started"; }) === i; });
    if (evs.length) {
      html += '<div class="card"><h3>سجل الطلب</h3>' + evs.map(function (e) { return '<div class="ev"><b>' + esc(EV[e.type] || e.type) + "</b><span>" + esc(fmt(e.at)) + "</span></div>"; }).join("") + "</div>";
    }
    html += '<div class="note">تُحدَّث الصفحة تلقائياً · آخر تحديث ' + new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) + "</div>";
    el("wrap").innerHTML = html;
  }

  function load() {
    fetch("/api/track?c=" + encodeURIComponent(c) + "&t=" + encodeURIComponent(t), { cache: "no-store" })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.ok) return render(r.body);
        if (r.status === 404) return fail("لم نجد هذا الطلب");
        if (r.status === 503) return fail("خدمة التتبع قيد التفعيل");
        fail("تعذّر تحميل حالة الطلب");
      })
      .catch(function () { fail("تحقق من اتصالك بالإنترنت"); });
  }
  load();
  setInterval(load, 30000);
})();
</script>
</body>
</html>
`;
