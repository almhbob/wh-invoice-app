import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { getAuth, initializeAuth, Persistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Expo inlines these public client settings at build time. No production keys
// or project identifiers are embedded as source-code fallbacks.
const configured = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const names: Record<keyof typeof configured, string> = {
  apiKey: "EXPO_PUBLIC_FIREBASE_API_KEY",
  authDomain: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "EXPO_PUBLIC_FIREBASE_APP_ID",
};
const missingKeys = (Object.keys(configured) as (keyof typeof configured)[])
  .filter((key) => !configured[key]?.trim()).map((key) => names[key]);
const apiKeyValue = configured.apiKey?.trim() ?? "";
const apiKeyIsValid = /^AIza[0-9A-Za-z_-]{35}$/.test(apiKeyValue);
const invalidKeys = !apiKeyValue || apiKeyIsValid ? [] : [names.apiKey];
export const isFirebaseConfigured = missingKeys.length === 0 && invalidKeys.length === 0;
export const firebaseConfigDiagnostics = { missingKeys, invalidKeys };

// Firebase Auth validates the API-key format during initialization. Use a
// syntactically valid, nonfunctional placeholder until real build variables
// are present so the setup screen can render instead of a blank page.
const safePlaceholderApiKey = "AIzaSy" + "A".repeat(33);
const firebaseConfig = {
  apiKey: apiKeyIsValid ? apiKeyValue : safePlaceholderApiKey,
  authDomain: configured.authDomain || "configuration-required.invalid",
  projectId: configured.projectId || "configuration-required",
  storageBucket: configured.storageBucket || "configuration-required.invalid",
  messagingSenderId: configured.messagingSenderId || "configuration-required",
  appId: configured.appId || "configuration-required",
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
function persistentAuth() {
  if (Platform.OS === "web") return getAuth(app);
  // Metro's RN entry exports this helper; web declarations do not.
  const nativePersistence = (FirebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  }).getReactNativePersistence;
  try {
    return initializeAuth(app, { persistence: nativePersistence(AsyncStorage) });
  } catch (failure) {
    if ((failure as { code?: string }).code === "auth/already-initialized") return getAuth(app);
    throw failure;
  }
}
export const auth = persistentAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
