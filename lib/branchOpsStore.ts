import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

export type BranchOpsCollection = "branchProductionRequests" | "branchInventoryAudits";
export type BranchOpsSyncStatus = "local" | "synced" | "sync_failed";

export interface BranchOpsBaseRecord {
  id: string;
  companyId: string;
  createdAt?: string;
  syncedAt?: string;
  syncStatus?: BranchOpsSyncStatus;
}

function localStorageKey(prefix: string, companyId: string) {
  return `${prefix}_${companyId}`;
}

function collectionRef(companyId: string, collectionName: BranchOpsCollection) {
  return collection(db, "companies", companyId, collectionName);
}

export async function loadLocalBranchOps<T extends BranchOpsBaseRecord>(prefix: string, companyId: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(localStorageKey(prefix, companyId));
  return raw ? JSON.parse(raw) : [];
}

export async function saveLocalBranchOps<T extends BranchOpsBaseRecord>(prefix: string, companyId: string, records: T[]) {
  await AsyncStorage.setItem(localStorageKey(prefix, companyId), JSON.stringify(records));
}

export async function saveBranchOpsRecord<T extends BranchOpsBaseRecord>(params: {
  prefix: string;
  collectionName: BranchOpsCollection;
  companyId: string;
  record: T;
  existingRecords: T[];
  limit?: number;
}) {
  const { prefix, collectionName, companyId, record, existingRecords, limit = 60 } = params;
  const localRecord = { ...record, syncStatus: "local" as const } as T;
  const localRecords = [localRecord, ...existingRecords].slice(0, limit) as T[];
  await saveLocalBranchOps(prefix, companyId, localRecords);

  try {
    const ref = await addDoc(collectionRef(companyId, collectionName), {
      ...record,
      companyId,
      syncStatus: "synced",
      syncedAt: new Date().toISOString(),
    });
    const syncedRecord = { ...record, id: ref.id, syncStatus: "synced" as const, syncedAt: new Date().toISOString() } as T;
    const syncedRecords = [syncedRecord, ...existingRecords].slice(0, limit) as T[];
    await saveLocalBranchOps(prefix, companyId, syncedRecords);
    return { record: syncedRecord, records: syncedRecords, synced: true };
  } catch (error) {
    console.warn(`Branch ops sync failed for ${collectionName}`, error);
    const failedRecord = { ...record, syncStatus: "sync_failed" as const } as T;
    const failedRecords = [failedRecord, ...existingRecords].slice(0, limit) as T[];
    await saveLocalBranchOps(prefix, companyId, failedRecords);
    return { record: failedRecord, records: failedRecords, synced: false };
  }
}

export async function updateBranchOpsRecordStatus<T extends BranchOpsBaseRecord>(params: {
  prefix: string;
  collectionName: BranchOpsCollection;
  companyId: string;
  records: T[];
  id: string;
  patch: Partial<T>;
}) {
  const { prefix, collectionName, companyId, records, id, patch } = params;
  const next = records.map((record) => record.id === id ? { ...record, ...patch } : record) as T[];
  await saveLocalBranchOps(prefix, companyId, next);

  try {
    await updateDoc(doc(db, "companies", companyId, collectionName, id), {
      ...patch,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(`Branch ops update sync failed for ${collectionName}`, error);
  }

  return next;
}
