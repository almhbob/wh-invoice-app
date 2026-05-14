import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CompanyStatus = "trial" | "active" | "suspended" | "expired";
export type CompanyPlan = "starter" | "business" | "enterprise";

export interface CompanyTenant {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  plan: CompanyPlan;
  maxUsers: number;
  maxInvoicesPerMonth?: number;
  expiresAt?: string;
  createdAt: string;
}

interface CompanyContextType {
  company: CompanyTenant;
  companyId: string;
  setCompany: (company: CompanyTenant) => Promise<void>;
  switchCompanyById: (companyId: string) => Promise<void>;
  isCompanyActive: boolean;
}

const DEFAULT_COMPANY: CompanyTenant = {
  id: "default-company",
  name: "W&H Cake & Chocolate",
  slug: "wh-cake-chocolate",
  status: "active",
  plan: "business",
  maxUsers: 25,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const COMPANY_STORAGE_KEY = "@wh_current_company_v1";
const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompanyState] = useState<CompanyTenant>(DEFAULT_COMPANY);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(COMPANY_STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as CompanyTenant;
        if (parsed?.id) setCompanyState(parsed);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setCompany = useCallback(async (nextCompany: CompanyTenant) => {
    setCompanyState(nextCompany);
    await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(nextCompany));
  }, []);

  const switchCompanyById = useCallback(async (companyId: string) => {
    const nextCompany: CompanyTenant = {
      ...DEFAULT_COMPANY,
      id: companyId.trim() || DEFAULT_COMPANY.id,
      slug: companyId.trim() || DEFAULT_COMPANY.slug,
      name: companyId.trim() || DEFAULT_COMPANY.name,
    };
    await setCompany(nextCompany);
  }, [setCompany]);

  const isCompanyActive = useMemo(() => {
    if (company.status === "suspended" || company.status === "expired") return false;
    if (!company.expiresAt) return true;
    return new Date(company.expiresAt).getTime() >= Date.now();
  }, [company]);

  const value = useMemo<CompanyContextType>(() => ({
    company,
    companyId: company.id,
    setCompany,
    switchCompanyById,
    isCompanyActive,
  }), [company, isCompanyActive, setCompany, switchCompanyById]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
}

export function companyCollectionPath(companyId: string, collectionName: string) {
  return `companies/${companyId}/${collectionName}`;
}
