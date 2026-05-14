import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";
import { DiscountType } from "./OrdersContext";

export interface Offer {
  id: string;
  companyId?: string;
  phoneNumber: string;
  customerName?: string;
  discountType: DiscountType;
  discountValue: number;
  reason: string;
  active: boolean;
  usageCount: number;
  maxUsage: number | null;
  expiresAt: string | null;
  createdAt: string;
  notes?: string;
}

interface OffersContextType {
  offers: Offer[];
  loading: boolean;
  addOffer: (offer: Omit<Offer, "id" | "companyId" | "usageCount" | "createdAt">) => Promise<Offer>;
  updateOffer: (id: string, updates: Partial<Omit<Offer, "id">>) => Promise<void>;
  deleteOffer: (id: string) => Promise<void>;
  getOfferByPhone: (phone: string) => Offer | undefined;
  incrementUsage: (id: string) => Promise<void>;
}

const OffersContext = createContext<OffersContextType | null>(null);

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "").trim();
}

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const offersCollection = useCallback(() => collection(db, "companies", companyId, "offers"), [companyId]);
  const offerDoc = useCallback((id: string) => doc(db, "companies", companyId, "offers", id), [companyId]);

  useEffect(() => {
    setLoading(true);
    setOffers([]);
    const q = query(offersCollection(), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOffers(snap.docs.map((d) => ({ id: d.id, companyId, ...(d.data() as Omit<Offer, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore tenant offers error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [companyId, offersCollection]);

  const addOffer = useCallback(async (offer: Omit<Offer, "id" | "companyId" | "usageCount" | "createdAt">): Promise<Offer> => {
    const now = new Date().toISOString();
    const data = { ...offer, companyId, phoneNumber: normalizePhone(offer.phoneNumber), usageCount: 0, createdAt: now };
    const ref = await addDoc(offersCollection(), data);
    return { id: ref.id, ...data };
  }, [companyId, offersCollection]);

  const updateOffer = useCallback(async (id: string, updates: Partial<Omit<Offer, "id">>) => {
    const data = { ...updates, companyId };
    if (data.phoneNumber) data.phoneNumber = normalizePhone(data.phoneNumber);
    await updateDoc(offerDoc(id), data);
  }, [companyId, offerDoc]);

  const deleteOffer = useCallback(async (id: string) => {
    await deleteDoc(offerDoc(id));
  }, [offerDoc]);

  const getOfferByPhone = useCallback((phone: string): Offer | undefined => {
    const norm = normalizePhone(phone);
    if (!norm) return undefined;
    const now = new Date().toISOString();
    return offers.find((o) => {
      if (!o.active) return false;
      if (normalizePhone(o.phoneNumber) !== norm) return false;
      if (o.expiresAt && o.expiresAt < now) return false;
      if (o.maxUsage !== null && o.usageCount >= o.maxUsage) return false;
      return true;
    });
  }, [offers]);

  const incrementUsage = useCallback(async (id: string) => {
    await updateDoc(offerDoc(id), { usageCount: increment(1), companyId });
  }, [companyId, offerDoc]);

  return (
    <OffersContext.Provider value={{ offers, loading, addOffer, updateOffer, deleteOffer, getOfferByPhone, incrementUsage }}>
      {children}
    </OffersContext.Provider>
  );
}

export function useOffers() {
  const ctx = useContext(OffersContext);
  if (!ctx) throw new Error("useOffers must be used within OffersProvider");
  return ctx;
}
