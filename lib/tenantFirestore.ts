import { collection, doc, Firestore } from "firebase/firestore";

export const TENANT_COLLECTIONS = {
  orders: "orders",
  products: "products",
  employees: "employees",
  offers: "offers",
  trays: "trays",
  counters: "counters",
  settings: "settings",
  auditLogs: "auditLogs",
} as const;

export type TenantCollectionName = keyof typeof TENANT_COLLECTIONS;

export function tenantCollection(db: Firestore, companyId: string, name: TenantCollectionName) {
  return collection(db, "companies", companyId, TENANT_COLLECTIONS[name]);
}

export function tenantDoc(db: Firestore, companyId: string, name: TenantCollectionName, id: string) {
  return doc(db, "companies", companyId, TENANT_COLLECTIONS[name], id);
}

export function tenantCounterDoc(db: Firestore, companyId: string, id: string) {
  return doc(db, "companies", companyId, "counters", id);
}

export function withTenant<T extends Record<string, unknown>>(companyId: string, data: T) {
  return { ...data, companyId };
}

export function cleanFirestoreData<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}
