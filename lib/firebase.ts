import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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
export const db = getFirestore(app);
export const storage = getStorage(app);
