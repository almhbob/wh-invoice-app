import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export type PriceChangeStatus = "pending" | "approved" | "rejected";

export interface PriceChangeRequest {
  id: string;
  productId: string;
  productName: string;
  currentPrice: number;
  newPrice: number;
  reason: string;
  requestedBy: { name: string; employeeId: string };
  status: PriceChangeStatus;
  createdAt: string;
  resolvedAt?: string;
}

interface PriceChangeContextType {
  requests: PriceChangeRequest[];
  pendingCount: number;
  submitRequest: (req: Omit<PriceChangeRequest, "id" | "status" | "createdAt">) => Promise<void>;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  isLoading: boolean;
}

const PriceChangeContext = createContext<PriceChangeContextType>({
  requests: [],
  pendingCount: 0,
  submitRequest: async () => {},
  approveRequest: async () => {},
  rejectRequest: async () => {},
  isLoading: true,
});

export function PriceChangeProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<PriceChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "priceChangeRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceChangeRequest)));
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, []);

  const submitRequest = async (req: Omit<PriceChangeRequest, "id" | "status" | "createdAt">) => {
    await addDoc(collection(db, "priceChangeRequests"), {
      ...req,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  };

  const approveRequest = async (id: string) => {
    await updateDoc(doc(db, "priceChangeRequests", id), {
      status: "approved",
      resolvedAt: new Date().toISOString(),
    });
  };

  const rejectRequest = async (id: string) => {
    await updateDoc(doc(db, "priceChangeRequests", id), {
      status: "rejected",
      resolvedAt: new Date().toISOString(),
    });
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <PriceChangeContext.Provider value={{ requests, pendingCount, submitRequest, approveRequest, rejectRequest, isLoading }}>
      {children}
    </PriceChangeContext.Provider>
  );
}

export function usePriceChange() {
  return useContext(PriceChangeContext);
}
