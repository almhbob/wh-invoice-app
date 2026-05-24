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
    setIsLoading(true);
    setProducts([]);
    const q = query(productsCollection(), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Product[] = snapshot.docs.map((d) => ({
          id: d.id,
          companyId,
          ...(d.data() as Omit<Product, "id">),
        }));
        setProducts(sortProducts(loaded));
        setIsLoading(false);
      },
      (err) => {
        console.error("Firestore tenant products error:", err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [companyId, productsCollection]);

  const addProduct = useCallback(
    async (data: Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">): Promise<Product> => {
      const now = new Date().toISOString();
      const payload = { ...data, companyId, createdAt: now, updatedAt: now };
      const ref = await addDoc(productsCollection(), clean(payload));
      return { id: ref.id, ...payload };
    },
    [companyId, productsCollection]
  );

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      await updateDoc(productDoc(id), clean({ ...data, companyId, updatedAt: new Date().toISOString() }));
    },
    [companyId, productDoc]
  );

  const deleteProduct = useCallback(async (id: string) => {
    await deleteDoc(productDoc(id));
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
