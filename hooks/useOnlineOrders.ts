import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCompany } from "@/context/CompanyContext";
import type { CakeWriting, Department, OrderType } from "@/context/OrdersContext";
import { db } from "@/lib/firebase";

export interface OnlineItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  department: Department;
  writing?: CakeWriting;
}

export type OnlineStatus = "new" | "accepted" | "rejected";

export interface OnlineOrder {
  id: string;
  status: OnlineStatus;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  deliveryAddress?: string;
  locationUrl?: string;
  deliveryTime: string;
  notes?: string;
  items: OnlineItem[];
  subtotal: number;
  trackingCode: string;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: { name: string; employeeId: string };
  rejectReason?: string;
  changeNote?: string;
  modified?: boolean;
  orderId?: string;
  orderNumber?: number;
}

/** Live inbox of orders customers placed through the public link. */
export function useOnlineOrders() {
  const { companyId } = useCompany();
  const [list, setList] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "companies", companyId, "onlineOrders"), orderBy("createdAt", "desc"), limit(150));
    return onSnapshot(
      q,
      (snap) => {
        setList(snap.docs.map((d) => ({ ...(d.data() as Omit<OnlineOrder, "id">), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [companyId]);

  const pending = useMemo(() => list.filter((o) => o.status === "new").sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [list]);
  const decidedToday = useMemo(
    () => list.filter((o) => o.status !== "new" && new Date(o.decidedAt ?? o.updatedAt).toDateString() === new Date().toDateString()),
    [list]
  );

  const decide = useCallback(
    (id: string, patch: Partial<OnlineOrder>) =>
      updateDoc(doc(db, "companies", companyId, "onlineOrders", id), Object.fromEntries(Object.entries({ ...patch, updatedAt: new Date().toISOString() }).filter(([, v]) => v !== undefined))),
    [companyId]
  );

  return { list, pending, decidedToday, loading, decide };
}
