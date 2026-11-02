import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { normalizeStoreSettings, OnlineStoreSettings } from "@/constants/onlineStore";
import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";

/** Live online-store rules for the current company (defaults until saved). */
export function useStoreSettings() {
  const { companyId } = useCompany();
  const [settings, setSettings] = useState<OnlineStoreSettings>(normalizeStoreSettings(null));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return onSnapshot(
      doc(db, "companies", companyId, "settings", "onlineStore"),
      (snap) => {
        setSettings(normalizeStoreSettings(snap.exists() ? snap.data() : null));
        setSaved(snap.exists());
      },
      () => undefined
    );
  }, [companyId]);

  const save = useCallback(
    (next: OnlineStoreSettings) =>
      setDoc(doc(db, "companies", companyId, "settings", "onlineStore"), { ...normalizeStoreSettings(next), companyId, updatedAt: new Date().toISOString() }),
    [companyId]
  );

  return { settings, saved, save };
}
