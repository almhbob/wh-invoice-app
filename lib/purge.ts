import { collection, deleteDoc, doc, Firestore, getCountFromServer, getDocs, limit, query, setDoc, writeBatch } from "firebase/firestore";

/**
 * Company data reset (admin only, from the Admin → Backup tab).
 * No app imports, so the emulator tests run it as-is.
 */

export interface PurgeOptions {
  /** Orders created at the counter (always included). */
  orders: true;
  /** Requests from the public online-order link. */
  onlineOrders: boolean;
  /** Start invoice numbers again from 1. */
  resetNumbering: boolean;
  /** Loyalty balances and their history. */
  loyalty: boolean;
}

export type PurgeCounts = Record<"orders" | "onlineOrders" | "loyaltyAccounts" | "loyaltyTxns", number>;

const COLLECTIONS = (o: PurgeOptions) =>
  [
    "orders",
    ...(o.onlineOrders ? ["onlineOrders"] : []),
    ...(o.loyalty ? ["loyaltyAccounts", "loyaltyTxns"] : []),
  ] as (keyof PurgeCounts)[];

export async function countCompanyData(db: Firestore, companyId: string): Promise<PurgeCounts> {
  const n = async (name: string) => {
    try { return (await getCountFromServer(collection(db, "companies", companyId, name))).data().count; } catch { return 0; }
  };
  const [orders, onlineOrders, loyaltyAccounts, loyaltyTxns] = await Promise.all([n("orders"), n("onlineOrders"), n("loyaltyAccounts"), n("loyaltyTxns")]);
  return { orders, onlineOrders, loyaltyAccounts, loyaltyTxns };
}

/** Full raw copy of everything the purge will remove (for the mandatory backup file). */
export async function exportCompanyData(db: Firestore, companyId: string, opts: PurgeOptions) {
  const out: Record<string, { id: string; data: unknown }[]> = {};
  for (const name of COLLECTIONS(opts)) {
    const snap = await getDocs(collection(db, "companies", companyId, name));
    out[name] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }
  return { companyId, exportedAt: new Date().toISOString(), options: opts, collections: out };
}

/** Deletes in pages of 400 until each collection is empty; reports progress. */
export async function purgeCompanyData(
  db: Firestore,
  companyId: string,
  opts: PurgeOptions,
  by: { name: string; employeeId: string },
  onProgress?: (collectionName: string, deleted: number) => void
): Promise<PurgeCounts> {
  const deleted: PurgeCounts = { orders: 0, onlineOrders: 0, loyaltyAccounts: 0, loyaltyTxns: 0 };
  for (const name of COLLECTIONS(opts)) {
    for (;;) {
      const snap = await getDocs(query(collection(db, "companies", companyId, name), limit(400)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted[name] += snap.size;
      onProgress?.(name, deleted[name]);
    }
  }
  if (opts.resetNumbering) {
    await deleteDoc(doc(db, "companies", companyId, "counters", "orders")).catch(() => undefined);
  }
  await setDoc(doc(collection(db, "companies", companyId, "maintenanceLog")), {
    action: "purge_orders",
    options: opts,
    deleted,
    by,
    at: new Date().toISOString(),
  });
  return deleted;
}
