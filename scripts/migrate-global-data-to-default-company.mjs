import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore";

const requiredEnv = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const companyId = process.env.COMPANY_ID || "default-company";
const deleteAfterCopy = process.env.DELETE_AFTER_COPY === "true";

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

const collectionsToMigrate = [
  "orders",
  "products",
  "employees",
  "offers",
  "priceChangeRequests",
];

async function migrateCollection(name) {
  const source = collection(db, name);
  const snapshot = await getDocs(source);

  if (snapshot.empty) {
    console.log(`- ${name}: no legacy documents found`);
    return { name, copied: 0 };
  }

  let copied = 0;
  for (const item of snapshot.docs) {
    const targetRef = doc(db, "companies", companyId, name, item.id);
    await setDoc(targetRef, {
      ...item.data(),
      companyId,
      migratedFrom: name,
      migratedAt: new Date().toISOString(),
    }, { merge: true });

    copied += 1;

    if (deleteAfterCopy) {
      await deleteDoc(doc(db, name, item.id));
    }
  }

  console.log(`- ${name}: copied ${copied} document(s) to companies/${companyId}/${name}`);
  return { name, copied };
}

async function migrateCounters() {
  const source = doc(db, "counters", "orders");
  const snapshot = await getDocs(collection(db, "counters"));

  if (snapshot.empty) {
    console.log("- counters: no legacy counters found");
    return;
  }

  for (const item of snapshot.docs) {
    await setDoc(doc(db, "companies", companyId, "counters", item.id), {
      ...item.data(),
      companyId,
      migratedFrom: "counters",
      migratedAt: new Date().toISOString(),
    }, { merge: true });
  }

  console.log(`- counters: copied ${snapshot.size} counter document(s)`);
}

async function main() {
  console.log(`Migrating legacy global data to company: ${companyId}`);
  console.log(`Delete after copy: ${deleteAfterCopy ? "yes" : "no"}`);

  for (const name of collectionsToMigrate) {
    await migrateCollection(name);
  }

  await migrateCounters();

  console.log("Migration complete.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
