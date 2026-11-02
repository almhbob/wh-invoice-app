import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle?: string;
  active: boolean;
  createdAt: string;
}

/** Company drivers registry: companies/{companyId}/drivers. Drivers don't need an app account. */
export function useDrivers() {
  const { companyId } = useCompany();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "companies", companyId, "drivers"), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setDrivers(snap.docs.map((d) => ({ ...(d.data() as Omit<Driver, "id">), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [companyId]);

  const addDriver = useCallback(
    async (data: { name: string; phone: string; vehicle?: string }) => {
      const payload = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        ...(data.vehicle?.trim() ? { vehicle: data.vehicle.trim() } : {}),
        active: true,
        companyId,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "companies", companyId, "drivers"), payload);
      return { id: ref.id, ...payload } as Driver;
    },
    [companyId]
  );

  const updateDriver = useCallback(
    (id: string, patch: Partial<Pick<Driver, "name" | "phone" | "vehicle" | "active">>) =>
      updateDoc(doc(db, "companies", companyId, "drivers", id), { ...patch, updatedAt: new Date().toISOString() }),
    [companyId]
  );

  const removeDriver = useCallback(
    (id: string) => deleteDoc(doc(db, "companies", companyId, "drivers", id)),
    [companyId]
  );

  return { drivers, activeDrivers: drivers.filter((d) => d.active), loading, addDriver, updateDriver, removeDriver };
}
