import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_TENANT } from "@/constants/platform";

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
  id: DEFAULT_TENANT.id,
  name: DEFAULT_TENANT.name,
  slug: DEFAULT_TENANT.slug,
  status: "active",
  plan: "business",
  maxUsers: 25,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const COMPANY_STORAGE_KEY = "@fawtara_current_tenant_v1";
const LEGACY_COMPANY_STORAGE_KEY = "@wh_current_company_v1";
const INVALID_TENANT_IDS = new Set(["default-company"]);
const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

function sanitizeCompanyTenant(company?: Partial<CompanyTenant> | null): CompanyTenant {
  if (!company?.id || INVALID_TENANT_IDS.has(company.id)) {
    return DEFAULT_COMPANY;
  }

  return {
    ...DEFAULT_COMPANY,
    ...company,
    id: company.id,
    slug: company.slug || company.id,
    name: company.name || company.id,
  };
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompanyState] = useState<CompanyTenant>(DEFAULT_COMPANY);

  useEffect(() => {
    let mounted = true;

    async function loadCompany() {
      try {
        const raw =
          (await AsyncStorage.getItem(COMPANY_STORAGE_KEY)) ||
          (await AsyncStorage.getItem(LEGACY_COMPANY_STORAGE_KEY));

        if (!mounted || !raw) return;

        const parsed = JSON.parse(raw) as CompanyTenant;
        const safeCompany = sanitizeCompanyTenant(parsed);
        setCompanyState(safeCompany);
        await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(safeCompany));
      } catch {}
    }

    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  const setCompany = useCallback(async (nextCompany: CompanyTenant) => {
    const safeCompany = sanitizeCompanyTenant(nextCompany);
    setCompanyState(safeCompany);
    await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(safeCompany));
  }, []);

  const switchCompanyById = useCallback(async (companyId: string) => {
    const tenantId = companyId.trim();
    const nextCompany: CompanyTenant = sanitizeCompanyTenant({
      ...DEFAULT_COMPANY,
      id: tenantId || DEFAULT_COMPANY.id,
      slug: tenantId || DEFAULT_COMPANY.slug,
      name: tenantId || DEFAULT_COMPANY.name,
    });
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
  const safeCompanyId = INVALID_TENANT_IDS.has(companyId) ? DEFAULT_COMPANY.id : companyId;
  return `companies/${safeCompanyId}/${collectionName}`;
}
