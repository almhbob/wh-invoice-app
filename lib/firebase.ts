import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const rawFirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigDiagnostics = {
  hasApiKey: Boolean(rawFirebaseConfig.apiKey),
  hasAuthDomain: Boolean(rawFirebaseConfig.authDomain),
  hasProjectId: Boolean(rawFirebaseConfig.projectId),
  hasStorageBucket: Boolean(rawFirebaseConfig.storageBucket),
  hasMessagingSenderId: Boolean(rawFirebaseConfig.messagingSenderId),
  hasAppId: Boolean(rawFirebaseConfig.appId),
  missingKeys: Object.entries(rawFirebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key),
};

export const isFirebaseConfigured = firebaseConfigDiagnostics.missingKeys.length === 0;

const fallbackProjectId = "fawtara-bootstrap-demo";

const firebaseConfig = isFirebaseConfigured
  ? rawFirebaseConfig
  : {
      apiKey: rawFirebaseConfig.apiKey || "bootstrap-demo-key",
      authDomain: rawFirebaseConfig.authDomain || `${fallbackProjectId}.firebaseapp.com`,
      projectId: rawFirebaseConfig.projectId || fallbackProjectId,
      storageBucket: rawFirebaseConfig.storageBucket || `${fallbackProjectId}.appspot.com`,
      messagingSenderId: rawFirebaseConfig.messagingSenderId || "000000000000",
      appId: rawFirebaseConfig.appId || "1:000000000000:web:bootstrapdemo",
    };

if (!isFirebaseConfigured) {
  console.warn("Firebase config is incomplete. Running in bootstrap mode.", firebaseConfigDiagnostics.missingKeys);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
