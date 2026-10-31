import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";
import { normalizeTaxProfile, TaxProfile } from "@/utils/zatca";

/** The company's VAT registration (companies/{id}/taxProfile/current). Admin-only writes. */
export function useTaxProfile() {
  const { companyId } = useCompany();
  const [profile, setProfile] = useState<TaxProfile>(normalizeTaxProfile(null));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return onSnapshot(
      doc(db, "companies", companyId, "taxProfile", "current"),
      (snap) => { setProfile(normalizeTaxProfile(snap.exists() ? (snap.data() as Partial<TaxProfile>) : null)); setLoaded(true); },
      () => setLoaded(true)
    );
  }, [companyId]);

  const save = useCallback(async (next: TaxProfile, updatedBy?: string) => {
    const clean = normalizeTaxProfile(next);
    const data: Record<string, unknown> = { ...clean, updatedAt: new Date().toISOString() };
    if (updatedBy) data.updatedBy = updatedBy;
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    await setDoc(doc(db, "companies", companyId, "taxProfile", "current"), data);
  }, [companyId]);

  return { profile, loaded, save };
}
