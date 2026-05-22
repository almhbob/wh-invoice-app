const http = require('http');
const fs = require('fs');
const path = require('path');

const STATIC_ROOT = path.resolve(__dirname, '..', 'static-build');
const PORT = Number(process.env.PORT || 3000);
const APP_NAME = 'Fawtara';
const RELEASE_FILE = path.resolve(__dirname, '..', 'constants', 'releaseInfo.ts');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
};

function releaseInfo() {
  try {
    const source = fs.readFileSync(RELEASE_FILE, 'utf8');
    return {
      version: source.match(/version:\s*['\"]([^'\"]+)['\"]/)?.[1] || 'unknown',
      marker: source.match(/deploymentMarker:\s*['\"]([^'\"]+)['\"]/)?.[1] || 'unknown',
    };
  } catch {
    return { version: 'unknown', marker: 'unknown' };
  }
}

function headers(extra = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    pragma: 'no-cache',
    expires: '0',
    'surrogate-control': 'no-store',
    ...extra,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, headers({ 'content-type': 'application/json; charset=utf-8' }));
  res.end(JSON.stringify(payload, null, 2));
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(root, normalized);
  return filePath.startsWith(root) ? filePath : null;
}

function diagnostics() {
  return {
    status: 'ok',
    service: APP_NAME,
    timestamp: new Date().toISOString(),
    release: releaseInfo(),
    cachePolicy: 'no-store',
    staticBuild: {
      exists: fs.existsSync(STATIC_ROOT),
      indexExists: fs.existsSync(path.join(STATIC_ROOT, 'index.html')),
    },
  };
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, headers({ 'content-type': MIME_TYPES[ext] || 'application/octet-stream' }));
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res) {
  if (!fs.existsSync(STATIC_ROOT)) {
    return sendJson(res, 503, { status: 'error', message: 'static-build missing', diagnostics: diagnostics() });
  }
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const requestedPath = safeJoin(STATIC_ROOT, pathname);
  if (!requestedPath) return sendJson(res, 403, { status: 'error', message: 'Forbidden' });
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) return serveFile(requestedPath, res);
  const indexPath = path.join(STATIC_ROOT, 'index.html');
  if (fs.existsSync(indexPath)) return serveFile(indexPath, res);
  return sendJson(res, 404, { status: 'error', message: 'Not found', diagnostics: diagnostics() });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz' || url.pathname === '/api/healthz' || url.pathname === '/api/diagnostics') {
    return sendJson(res, 200, diagnostics());
  }
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`${APP_NAME} no-cache server listening on port ${PORT}`);
});
