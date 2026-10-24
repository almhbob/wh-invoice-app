import { useEffect, useState } from "react";

import { DEFAULT_LOYALTY, LoyaltySettings, loyaltyKey } from "@/constants/loyalty";
import { useCompany } from "@/context/CompanyContext";
import { LoyaltyAccount, subscribeAccount, subscribeAccounts, subscribeLoyaltySettings } from "@/lib/loyalty";

export function useLoyaltySettings() {
  const { companyId } = useCompany();
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => subscribeLoyaltySettings(companyId, (s) => { setSettings(s); setLoaded(true); }), [companyId]);
  return { settings, loaded };
}

/** Live balance for the phone being typed at the counter (debounced). */
export function useLoyaltyAccount(phone: string) {
  const { companyId } = useCompany();
  const [key, setKey] = useState("");
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setKey(loyaltyKey(phone)), 350);
    return () => clearTimeout(t);
  }, [phone]);

  useEffect(() => {
    setAccount(null);
    if (!key) { setLoading(false); return; }
    setLoading(true);
    return subscribeAccount(companyId, key, (a) => { setAccount(a); setLoading(false); });
  }, [companyId, key]);

  return { key, account, loading };
}

export function useLoyaltyAccounts(enabled = true) {
  const { companyId } = useCompany();
  const [list, setList] = useState<LoyaltyAccount[]>([]);
  useEffect(() => (enabled ? subscribeAccounts(companyId, setList) : undefined), [companyId, enabled]);
  return list;
}
