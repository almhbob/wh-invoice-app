import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { LAVIVIANE_COMPANY_ID, buildLavivianeProducts } from "@/constants/lavivianeProducts";
import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";

export type ProductDept = "halwa" | "mawali" | "chocolate" | "cake";

export interface Product {
  id: string;
  companyId?: string;
  name: string;
  nameEn?: string;
  price: number;
  department: ProductDept;
  category: string;
  description?: string;
  imageUri?: string;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductsContextType {
  products: Product[];
  addProduct: (data: Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">) => Promise<Product>;
  updateProduct: (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  isLoading: boolean;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

const DEPARTMENT_ORDER: ProductDept[] = ["cake", "halwa", "mawali", "chocolate"];
const CATEGORY_ORDER = [
  "New Cake Collection",
  "Laviviane Cakes",
  "Celebration Bites",
  "Mousse Cake",
  "Laviviane Bites",
  "Sandwich",
  "Luxury Chocolate",
  "Occasion Chocolate",
  "Distributions and Gifts",
];

function orderIndex(list: readonly string[], value?: string) {
  const index = list.indexOf(value ?? "");
  return index === -1 ? 999 : index;
}

function normalizeName(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function clean(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function fallbackProducts(companyId: string) {
  if (companyId === LAVIVIANE_COMPANY_ID) return buildLavivianeProducts();
  return [];
}

function sortProducts(items: Product[]) {
  return [...items].sort((a, b) => {
    const deptDiff = orderIndex(DEPARTMENT_ORDER, a.department) - orderIndex(DEPARTMENT_ORDER, b.department);
    if (deptDiff !== 0) return deptDiff;

    const categoryDiff = orderIndex(CATEGORY_ORDER, a.category) - orderIndex(CATEGORY_ORDER, b.category);
    if (categoryDiff !== 0) return categoryDiff;

    const sortDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (sortDiff !== 0) return sortDiff;

    return normalizeName(a.name).localeCompare(normalizeName(b.name));
  });
}

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const productsCollection = useCallback(() => collection(db, "companies", companyId, "products"), [companyId]);
  const productDoc = useCallback((id: string) => doc(db, "companies", companyId, "products", id), [companyId]);

  useEffect(() => {
    let mounted = true;
    let resolved = false;
    setIsLoading(true);
    setProducts([]);

    // Fallback timer: if Firestore doesn't respond in 4 s (e.g. anonymous auth
    // is disabled or network is slow) load hardcoded products immediately.
    const timer = setTimeout(() => {
      if (!mounted || resolved) return;
      resolved = true;
      setProducts(sortProducts(fallbackProducts(companyId)));
      setIsLoading(false);
    }, 4000);

    const q = query(productsCollection(), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!mounted) return;
        resolved = true;
        clearTimeout(timer);
        const loaded: Product[] = snapshot.docs.map((d) => ({
          id: d.id,
          companyId,
          ...(d.data() as Omit<Product, "id">),
        }));
        const visibleProducts = loaded.length ? loaded : fallbackProducts(companyId);
        setProducts(sortProducts(visibleProducts));
        setIsLoading(false);
      },
      (err) => {
        if (!mounted) return;
        resolved = true;
        clearTimeout(timer);
        console.error("Firestore tenant products error:", err);
        setProducts(sortProducts(fallbackProducts(companyId)));
        setIsLoading(false);
      }
    );
    return () => { mounted = false; clearTimeout(timer); unsub(); };
  }, [companyId, productsCollection]);

  const addProduct = useCallback(
    async (data: Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">): Promise<Product> => {
      const now = new Date().toISOString();
      const payload = { ...data, companyId, createdAt: now, updatedAt: now };
      try {
        const ref = await addDoc(productsCollection(), clean(payload));
        return { id: ref.id, ...payload };
      } catch (err) {
        console.error("Firestore addProduct failed:", err);
        throw err;
      }
    },
    [companyId, productsCollection]
  );

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      try {
        await updateDoc(productDoc(id), clean({ ...data, companyId, updatedAt: new Date().toISOString() }));
      } catch (err) {
        console.error("Firestore updateProduct failed:", err);
        throw err;
      }
    },
    [companyId, productDoc]
  );

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await deleteDoc(productDoc(id));
    } catch (err) {
      console.error("Firestore deleteProduct failed:", err);
      throw err;
    }
  }, [productDoc]);

  return (
    <ProductsContext.Provider value={{ products, addProduct, updateProduct, deleteProduct, isLoading }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used inside ProductsProvider");
  return ctx;
}
