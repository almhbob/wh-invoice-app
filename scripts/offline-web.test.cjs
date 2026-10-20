const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createOfflineSupport } = require("./offline-web.cjs");

function makeFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laviviane-offline-"));
  const appIcon = path.join(directory, "source-icon.svg");
  const build = path.join(directory, "build");

  fs.mkdirSync(path.join(build, "assets"), { recursive: true });
  fs.mkdirSync(path.join(build, "_expo", "static", "js"), { recursive: true });
  fs.mkdirSync(path.join(build, "laviviane-cards"), { recursive: true });
  fs.mkdirSync(path.join(build, "api"), { recursive: true });
  fs.writeFileSync(path.join(build, "index.html"), "<html><body>App</body></html>");
  fs.writeFileSync(path.join(build, "assets", "font.ttf"), "font-bytes");
  fs.writeFileSync(path.join(build, "_expo", "static", "js", "entry.js"), "app-bundle");
  fs.writeFileSync(path.join(build, "_expo", "static", "js", "entry.js.map"), "source-map");
  fs.writeFileSync(path.join(build, "laviviane-cards", "page.png"), "private-catalog-asset");
  fs.writeFileSync(path.join(build, "api", "orders.json"), "customer-order-data");
  fs.writeFileSync(appIcon, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

  return { directory, build, appIcon };
}

function generateFixtureWorker(fixture) {
  createOfflineSupport(fixture.build, { iconSource: fixture.appIcon });
  return fs.readFileSync(path.join(fixture.build, "service-worker.js"), "utf8");
}

function createWorkerHarness(source, networkFetch = async () => new Response("network")) {
  const listeners = new Map();
  const currentCacheName = source.match(/const CACHE_NAME = ("[^"]+");/)[1].slice(1, -1);
  const cacheEntries = new Map([
    ["/index.html", new Response("cached:/index.html")],
  ]);
  const cache = {
    addAll: async (paths) => {
      for (const item of paths) cacheEntries.set(String(item), new Response(`cached:${item}`));
    },
    match: async (request) => {
      const pathname = typeof request === "string" ? request : new URL(request.url).pathname;
      return cacheEntries.get(pathname) || null;
    },
  };
  const cacheStorage = {
    keys: async () => [currentCacheName],
    open: async () => cache,
    delete: async () => true,
  };
  const workerScope = {
    location: { origin: "https://shop.example" },
    clients: { claim: async () => undefined },
    addEventListener: (type, callback) => listeners.set(type, callback),
    skipWaiting: async () => undefined,
  };

  new Function("self", "caches", "URL", "fetch", "Response", source)(
    workerScope,
    cacheStorage,
    URL,
    networkFetch,
    Response
  );

  return { listeners, cacheEntries, currentCacheName };
}

test("the offline shell precaches only the app shell and built UI assets", (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));

  const worker = generateFixtureWorker(fixture);
  const precachePaths = JSON.parse(worker.match(/const STATIC_PATHS = new Set\((\[[^\n]+\])\);/)[1]);

  assert.deepEqual(precachePaths, ["/_expo/static/js/entry.js", "/assets/font.ttf"]);
  assert.doesNotMatch(precachePaths.join("\n"), /\/api\/|laviviane-cards|\.map$/);
  assert.ok(fs.existsSync(path.join(fixture.build, "manifest.webmanifest")));
  assert.ok(fs.existsSync(path.join(fixture.build, "offline-register.js")));
});

test("the app-shell cache version changes whenever an app bundle changes", (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));

  const firstVersion = generateFixtureWorker(fixture).match(/const CACHE_NAME = "([^"]+)";/)[1];
  fs.writeFileSync(path.join(fixture.build, "_expo", "static", "js", "entry.js"), "updated-bundle");
  const secondVersion = generateFixtureWorker(fixture).match(/const CACHE_NAME = "([^"]+)";/)[1];

  assert.notEqual(firstVersion, secondVersion);
});

test("non-GET and backend requests never enter the service-worker cache", (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));
  const harness = createWorkerHarness(generateFixtureWorker(fixture));
  const handler = harness.listeners.get("fetch");

  for (const request of [
    { method: "POST", mode: "cors", url: "https://shop.example/assets/entry.js" },
    { method: "GET", mode: "cors", url: "https://shop.example/api/orders" },
    { method: "GET", mode: "cors", url: "https://firestore.googleapis.com/v1/orders" },
  ]) {
    let intercepted = false;
    handler({ request, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});

test("navigations use the network first and the built app shell when offline", async (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));
  const source = generateFixtureWorker(fixture);
  const shell = await fs.promises.readFile(path.join(fixture.build, "index.html"), "utf8");
  const harness = createWorkerHarness(source, async () => { throw new TypeError("offline"); });
  const handler = harness.listeners.get("fetch");
  let navigationResponse;

  handler({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://shop.example/cashier",
      headers: new Headers({ accept: "text/html" }),
    },
    respondWith: (response) => { navigationResponse = response; },
  });

  const result = await navigationResponse;
  assert.equal(await result.text(), `cached:/index.html`);
  assert.match(shell, /App/);
});

test("server errors on app routes also fall back to the offline shell", async (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));
  const harness = createWorkerHarness(
    generateFixtureWorker(fixture),
    async () => new Response("service unavailable", { status: 503 })
  );
  const handler = harness.listeners.get("fetch");
  let navigationResponse;

  handler({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://shop.example/cashier",
      headers: new Headers({ accept: "text/html" }),
    },
    respondWith: (response) => { navigationResponse = response; },
  });

  const result = await navigationResponse;
  assert.equal(result.status, 200);
  assert.equal(await result.text(), "cached:/index.html");
});

test("emitted worker and registration scripts parse as JavaScript", (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));

  generateFixtureWorker(fixture);
  for (const file of ["service-worker.js", "offline-register.js"]) {
    const source = fs.readFileSync(path.join(fixture.build, file), "utf8");
    assert.doesNotThrow(() => new Function(source), file);
  }
});

test("service worker installs the app shell before promoting itself", async (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));
  const source = generateFixtureWorker(fixture);
  const harness = createWorkerHarness(source);
  const added = [];
  const currentCache = {
    addAll: async (paths) => added.push(...paths),
    match: async () => null,
  };
  const workerScope = {
    location: { origin: "https://shop.example" },
    clients: { claim: async () => undefined },
    addEventListener: (type, callback) => harness.listeners.set(type, callback),
    skipWaiting: async () => undefined,
  };
  let skipWaitingCalled = false;
  workerScope.skipWaiting = async () => { skipWaitingCalled = true; };
  const cacheStorage = {
    keys: async () => [harness.currentCacheName],
    open: async () => currentCache,
    delete: async () => true,
  };

  new Function("self", "caches", "URL", "fetch", "Response", source)(
    workerScope,
    cacheStorage,
    URL,
    async () => new Response("network"),
    Response
  );
  let installPromise;
  harness.listeners.get("install")({ waitUntil: (promise) => { installPromise = promise; } });
  await installPromise;

  assert.deepEqual(added.slice(0, 3), ["/index.html", "/manifest.webmanifest", "/app-icon.svg"]);
  assert.ok(added.includes("/_expo/static/js/entry.js"));
  assert.ok(added.includes("/assets/font.ttf"));
  assert.equal(skipWaitingCalled, true);
});
