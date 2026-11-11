/* Fawtara offline shell.
 *
 * Keeps the app's own files (the page, its JS bundles, fonts and images) on
 * the device so the app still opens when the shop's internet drops. Data is
 * not handled here: Firestore keeps its own offline cache and write queue, and
 * the cashier keeps unsent invoices in its outbox.
 *
 * - Pages: network first (a new deploy is picked up as soon as it is online),
 *   falling back to the last copy when offline.
 * - Build files (hashed names) and fonts/images: cache first.
 * - API, server pages and anything cross-origin (Firebase) are never touched.
 */
const SHELL_CACHE = "fawtara-shell-v1";
const ASSET_CACHE = "fawtara-assets-v1";
const KEEP = [SHELL_CACHE, ASSET_CACHE];
const NETWORK_TIMEOUT_MS = 4000;
// Old hashed bundles pile up after each deploy; keep the newest entries only.
const MAX_ASSET_ENTRIES = 150;

async function trimAssets(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ASSET_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ASSET_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.add(new Request("/", { cache: "reload" })))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fawtara-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/order/") ||
    url.pathname.startsWith("/track") ||
    url.pathname === "/sw.js"
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_expo/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/brand-fonts/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|ico)$/i.test(url.pathname)
  );
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function handlePage(request, url) {
  // App routes all render the same SPA shell; standalone .html pages keep their own copy.
  const key = /\.html$/i.test(url.pathname) ? url.pathname : "/";
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok && response.type === "basic") cache.put(key, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(key)) || (await cache.match("/"));
    if (cached) return cached;
    throw err;
  }
}

async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone()).then(() => trimAssets(cache)).catch(() => undefined);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isBypassed(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handlePage(request, url));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleAsset(request));
  }
});
