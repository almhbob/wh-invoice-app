import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export interface AppFeatures {
  halwaEnabled: boolean;
  mawaliEnabled: boolean;
  chocolateEnabled: boolean;
  cakeEnabled: boolean;
  packagingEnabled: boolean;
  reportsEnabled: boolean;
  customersEnabled: boolean;
  deliveryEnabled: boolean;
  traysEnabled: boolean;
}

const DEFAULT_FEATURES: AppFeatures = {
  halwaEnabled: true,
  mawaliEnabled: true,
  chocolateEnabled: true,
  cakeEnabled: true,
  packagingEnabled: true,
  reportsEnabled: true,
  customersEnabled: true,
  deliveryEnabled: true,
  traysEnabled: true,
};

interface FeaturesContextType {
  features: AppFeatures;
  setFeature: (key: keyof AppFeatures, value: boolean) => Promise<void>;
  isLoading: boolean;
}

const FeaturesContext = createContext<FeaturesContextType>({
  features: DEFAULT_FEATURES,
  setFeature: async () => {},
  isLoading: true,
});

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<AppFeatures>(DEFAULT_FEATURES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "devPortalConfig", "appFeatures"),
      (snap) => {
        if (snap.exists()) {
          setFeatures({ ...DEFAULT_FEATURES, ...(snap.data() as AppFeatures) });
        }
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsub();
  }, []);

  const setFeature = async (key: keyof AppFeatures, value: boolean) => {
    const ref = doc(db, "devPortalConfig", "appFeatures");
    await setDoc(ref, { [key]: value }, { merge: true });
    setFeatures((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <FeaturesContext.Provider value={{ features, setFeature, isLoading }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
