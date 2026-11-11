import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type FirestoreSettings,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase client config is public; authorization is enforced by server-issued
// claims and Firebase rules. A staging host must never inherit production config.
const firebaseEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() ?? "",
};

const productionFirebaseConfig = {
  apiKey: "AIzaSyB76Y-DdPYNjejZeZiuDZcojH_jvOzIlNI",
  authDomain: "wh-cake-chocolate.firebaseapp.com",
  projectId: "wh-cake-chocolate",
  storageBucket: "wh-cake-chocolate.firebasestorage.app",
  messagingSenderId: "1003148247429",
  appId: "1:1003148247429:web:4b29fa44119668e2e3c4ec",
};

function isStagingRuntime() {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (appEnv) return appEnv === "staging";
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    return host === "fotra-staging.pages.dev" || host.endsWith(".fotra-staging.pages.dev");
  }
  return false;
}

const stagingRuntime = isStagingRuntime();
const missingKeys = Object.entries(firebaseEnv)
  .filter(([, value]) => !value || value === "replace_me")
  .map(([key]) => `EXPO_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);
const copiedProductionKeys = Object.entries(firebaseEnv)
  .filter(([key, value]) => value !== "" && value === productionFirebaseConfig[key as keyof typeof productionFirebaseConfig])
  .map(([key]) => key);
const invalidStagingKeys = [
  ...missingKeys,
  ...copiedProductionKeys.map((key) => `EXPO_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()} (must belong to staging)`),
];
const validStagingConfig = invalidStagingKeys.length === 0;

const firebaseConfig = stagingRuntime
  ? validStagingConfig ? firebaseEnv : {
      apiKey: "staging-not-configured",
      authDomain: "staging-not-configured.invalid",
      projectId: "fawtara-staging-not-configured",
      storageBucket: "staging-not-configured.invalid",
      messagingSenderId: "staging-not-configured",
      appId: "staging-not-configured",
    }
  : {
      apiKey: firebaseEnv.apiKey || productionFirebaseConfig.apiKey,
      authDomain: firebaseEnv.authDomain || productionFirebaseConfig.authDomain,
      projectId: firebaseEnv.projectId || productionFirebaseConfig.projectId,
      storageBucket: firebaseEnv.storageBucket || productionFirebaseConfig.storageBucket,
      messagingSenderId: firebaseEnv.messagingSenderId || productionFirebaseConfig.messagingSenderId,
      appId: firebaseEnv.appId || productionFirebaseConfig.appId,
    };

export const isFirebaseConfigured = !stagingRuntime || validStagingConfig;
export const firebaseConfigDiagnostics = { missingKeys: stagingRuntime ? invalidStagingKeys : [] as string[] };

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
// ignoreUndefinedProperties: optional fields (price, note, …) left undefined in
// nested objects otherwise make addDoc/updateDoc throw synchronously and the
// write never reaches Firestore.
//
// On the web the cache lives in IndexedDB: data already seen opens without a
// connection, and writes made offline (department status changes, window
// orders, settings…) survive a reload or a closed tab and are sent when the
// connection returns. Several tabs of the app share one cache. Browsers
// without IndexedDB (some private modes) fall back to the in-memory cache.
function webCanPersist() {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.indexedDB !== "undefined" && window.indexedDB !== null;
  } catch {
    return false;
  }
}

function createDb() {
  const base: FirestoreSettings = { ignoreUndefinedProperties: true };
  try {
    if (webCanPersist()) {
      try {
        return initializeFirestore(app, {
          ...base,
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
      } catch (err) {
        // Only an "already initialized" error should reach the outer catch.
        if ((err as { code?: string })?.code !== "failed-precondition") {
          return initializeFirestore(app, { ...base, localCache: memoryLocalCache() });
        }
        throw err;
      }
    }
    return initializeFirestore(app, base);
  } catch {
    // Already initialized (e.g. fast refresh) — reuse the existing instance.
    return getFirestore(app);
  }
}
export const db = createDb();
export const storage = getStorage(app);
