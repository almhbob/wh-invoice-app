import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

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

const KNOWN_TRIAL_COMPANIES: Record<string, CompanyTenant> = {
  "laviviane-trial": {
    id: "laviviane-trial",
    name: "Laviviane Maison de Patisserie",
    slug: "laviviane",
    status: "trial",
    plan: "business",
    maxUsers: 25,
    maxInvoicesPerMonth: 3000,
    expiresAt: "2026-06-21T23:59:59.000Z",
    createdAt: "2026-05-22T00:00:00.000Z",
  },
  "new-trial-company": {
    id: "new-trial-company",
    name: "الشركة التجريبية",
    slug: "trial",
    status: "trial",
    plan: "business",
    maxUsers: 10,
    maxInvoicesPerMonth: 500,
    createdAt: "2026-05-01T00:00:00.000Z",
  },
};

const COMPANY_STORAGE_KEY = "@fawtara_current_tenant_v1";
const LEGACY_COMPANY_STORAGE_KEY = "@wh_current_company_v1";
const INVALID_TENANT_IDS = new Set(["default-company", "select-company"]);
const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

function companyFromId(companyId: string): CompanyTenant {
  const tenantId = companyId.trim();
  if (!tenantId || INVALID_TENANT_IDS.has(tenantId)) return DEFAULT_COMPANY;
  return KNOWN_TRIAL_COMPANIES[tenantId] ?? sanitizeCompanyTenant({
    ...DEFAULT_COMPANY,
    id: tenantId,
    slug: tenantId,
    name: tenantId,
  });
}

function companyIdFromUrl(): string | null {
  if (Platform.OS !== "web") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("company") || params.get("tenant") || params.get("companyId");
  } catch {
    return null;
  }
}

function sanitizeCompanyTenant(company?: Partial<CompanyTenant> | null): CompanyTenant {
  if (!company?.id || INVALID_TENANT_IDS.has(company.id)) {
    return DEFAULT_COMPANY;
  }

  const known = KNOWN_TRIAL_COMPANIES[company.id];
  if (known) return { ...known, ...company, id: known.id, slug: company.slug || known.slug, name: company.name || known.name };

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
        const urlCompanyId = companyIdFromUrl();
        if (urlCompanyId) {
          const fromUrl = companyFromId(urlCompanyId);
          if (!mounted) return;
          setCompanyState(fromUrl);
          await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(fromUrl));
          await AsyncStorage.removeItem(LEGACY_COMPANY_STORAGE_KEY);
          return;
        }

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
    await setCompany(companyFromId(companyId));
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
