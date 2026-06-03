import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase client-side config — these values are intentionally public.
// Security is enforced via Firestore/Storage rules, not by hiding these keys.
// Env vars override if present (local dev / CI), otherwise production values are used.
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? "AIzaSyB76Y-DdPYNjejZeZiuDZcojH_jvOzIlNI",
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "wh-cake-chocolate.firebaseapp.com",
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? "wh-cake-chocolate",
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "wh-cake-chocolate.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1003148247429",
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? "1:1003148247429:web:4b29fa44119668e2e3c4ec",
};

export const isFirebaseConfigured = true;
export const firebaseConfigDiagnostics = { missingKeys: [] as string[] };

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
