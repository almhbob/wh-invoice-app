const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const PORT = Number(process.env.PORT || 3000);
const APP_NAME = "Fawtara";
const RELEASE_FILE = path.resolve(__dirname, "..", "constants", "releaseInfo.ts");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
};

const REQUIRED_PUBLIC_ENV = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

function readReleaseVersion() {
  try {
    const source = fs.readFileSync(RELEASE_FILE, "utf8");
    const version = source.match(/version:\s*["']([^"']+)["']/)?.[1];
    const marker = source.match(/deploymentMarker:\s*["']([^"']+)["']/)?.[1];
    return { version: version || "unknown", marker: marker || "unknown" };
  } catch {
    return { version: "unknown", marker: "unknown" };
  }
}

function environmentDiagnostics() {
  const missingPublicEnv = REQUIRED_PUBLIC_ENV.filter((key) => !process.env[key]);
  return {
    nodeEnv: process.env.NODE_ENV || "unknown",
    hasPort: Boolean(process.env.PORT),
    railway: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID),
    missingPublicEnv,
    firebaseReady: missingPublicEnv.length === 0,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, securityHeaders({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  }));
  res.end(html);
}

function securityHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    ...extra,
  };
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, normalized);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function diagnosticsPayload() {
  return {
    status: "ok",
    service: APP_NAME,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    release: readReleaseVersion(),
    staticBuild: {
      exists: fs.existsSync(STATIC_ROOT),
      indexExists: fs.existsSync(path.join(STATIC_ROOT, "index.html")),
    },
    environment: environmentDiagnostics(),
  };
}

function diagnosticsHtml() {
  const data = diagnosticsPayload();
  const missing = data.environment.missingPublicEnv.length;
  const statusLabel = data.staticBuild.indexExists && missing === 0 ? "جاهز" : "يحتاج ضبط";
  const badgeColor = data.staticBuild.indexExists && missing === 0 ? "#16a34a" : "#ca8a04";
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>فوتره - فحص الإنتاج</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{width:min(760px,100%);background:white;border:1px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(15,23,42,.08)}
    h1{margin:0 0 8px;font-size:28px}.muted{color:#64748b;line-height:1.8}.badge{display:inline-flex;align-items:center;border-radius:999px;padding:8px 14px;color:white;background:${badgeColor};font-weight:800;margin:12px 0}
    .grid{display:grid;gap:12px;margin-top:18px}.row{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px}.k{font-weight:900}.v{color:#475569;margin-top:4px;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-word}
    a{color:#1d4ed8;font-weight:800;text-decoration:none}
  </style>
</head>
<body>
  <main class="card">
    <h1>فحص تشغيل فوتره</h1>
    <p class="muted">هذه الصفحة تؤكد أن الخادم يعمل وتكشف مشاكل النشر الأساسية بدون الحاجة إلى فتح التطبيق.</p>
    <div class="badge">${statusLabel}</div>
    <section class="grid">
      <div class="row"><div class="k">الإصدار</div><div class="v">${data.release.version}\n${data.release.marker}</div></div>
      <div class="row"><div class="k">ملف الواجهة</div><div class="v">static-build: ${data.staticBuild.exists}\nindex.html: ${data.staticBuild.indexExists}</div></div>
      <div class="row"><div class="k">Firebase</div><div class="v">جاهز: ${data.environment.firebaseReady}\nالمتغيرات الناقصة: ${data.environment.missingPublicEnv.join("\n") || "لا يوجد"}</div></div>
      <div class="row"><div class="k">روابط الفحص</div><div class="v"><a href="/healthz">/healthz</a> · <a href="/api/diagnostics">/api/diagnostics</a> · <a href="/">فتح التطبيق</a></div></div>
    </section>
  </main>
</body>
</html>`;
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const immutable = /\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf)$/i.test(filePath);
  res.writeHead(200, securityHeaders({
    "content-type": contentType,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  }));
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res) {
  if (!fs.existsSync(STATIC_ROOT)) {
    return sendJson(res, 503, {
      status: "error",
      message: "static-build directory is missing. Run pnpm run build first.",
      diagnostics: diagnosticsPayload(),
    });
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const requestedPath = safeJoin(STATIC_ROOT, pathname);
  if (!requestedPath) {
    res.writeHead(403, securityHeaders());
    res.end("Forbidden");
    return;
  }
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) return serveFile(requestedPath, res);
  const indexPath = path.join(STATIC_ROOT, "index.html");
  if (fs.existsSync(indexPath)) return serveFile(indexPath, res);
  sendJson(res, 404, { status: "error", message: "Not found", diagnostics: diagnosticsPayload() });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, securityHeaders({ allow: "GET, HEAD" }));
    res.end("Method Not Allowed");
    return;
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/healthz" || url.pathname === "/healthz") return sendJson(res, 200, diagnosticsPayload());
  if (url.pathname === "/api/diagnostics") return sendJson(res, 200, diagnosticsPayload());
  if (url.pathname === "/diagnostics") return sendHtml(res, 200, diagnosticsHtml());
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`${APP_NAME} server listening on port ${PORT}`);
});
