import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductDept = "halwa" | "mawali" | "chocolate" | "cake";

export interface Product {
  id: string;
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
  addProduct: (data: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<Product>;
  updateProduct: (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  isLoading: boolean;
}

// ─── Seed Data (from خدماتنا PDF) ────────────────────────────────────────────

type SeedRow = Omit<Product, "id" | "createdAt" | "updatedAt">;

const SEED_PRODUCTS: SeedRow[] = [
  // ══════════════ CAKE (مقاس 15 سم) ══════════════
  { name: "مكس بيري",           price: 115, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 1 },
  { name: "روز بيري",           price:  97, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 2 },
  { name: "رمان",               price: 115, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 3 },
  { name: "رمان بستاشيو",       price: 115, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 4 },
  { name: "رافايلو",            price:  97, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 5 },
  { name: "مانجو",              price: 115, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 6 },
  { name: "شوكلت",              price:  97, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 7 },
  { name: "دبل شوكلت",          price:  97, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 8 },
  { name: "اسبريسو",            price: 115, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 9 },
  { name: "كنافة بستاشيو",      price:  85, department: "cake", category: "مقاس 15 سم",  isAvailable: true, sortOrder: 10 },

  // ══════════════ CAKE (مقاس 25 سم) ══════════════
  { name: "مكس بيري",           price: 230, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 1 },
  { name: "روز بيري",           price: 184, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 2 },
  { name: "رمان",               price: 230, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 3 },
  { name: "رمان بستاشيو",       price: 230, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 4 },
  { name: "رفايلو",             price: 184, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 5 },
  { name: "مانجو",              price: 230, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 6 },
  { name: "شوكلت",              price: 184, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 7 },
  { name: "دبل شوكلت",          price: 184, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 8 },
  { name: "اسبريسو",            price: 230, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 9 },
  { name: "ريد فلفت",           price: 150, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 10 },
  { name: "بلو بيري",           price: 125, department: "cake", category: "مقاس 25 سم",  isAvailable: true, sortOrder: 11 },

  // ══════════════ CHOCOLATE (شوكلت) ══════════════
  { name: "شوكلت مكشوف",                    price: 200, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 1 },
  { name: "شوكلت مغلف",                     price: 185, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 2 },
  { name: "شوكلت فريش بدون لوغو",           price: 250, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 3 },
  { name: "شوكلت فريش مع لوغو",             price: 300, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 4 },
  { name: "بسكوت ويفر",                     price: 250, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 5 },
  { name: "بيكان مغلف بالشوكلت",            price: 240, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 6 },
  { name: "كوب فروتي",                      price: 250, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 7 },
  { name: "تارت فواكه",                     price: 250, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 8 },
  { name: "فراولة مغلف بالشوكلت",           price: 250, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 9 },
  { name: "بتيفور",                         price: 160, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 10 },
  { name: "تارت حالي",                      price: 160, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 11 },
  { name: "براونيز فواكه",                   price: 250, department: "chocolate", category: "شوكلت",                     isAvailable: true, sortOrder: 12 },

  // ══════════════ CHOCOLATE (حال القهوة) ══════════════
  { name: "لوغو القهوة الحبة",               price:   3, department: "chocolate", category: "حال القهوة",               isAvailable: true, sortOrder: 1 },
  { name: "شوكلت السمسم",                   price: 200, department: "chocolate", category: "حال القهوة",               isAvailable: true, sortOrder: 2 },
  { name: "ميني شوكلت",                     price: 200, department: "chocolate", category: "حال القهوة",               isAvailable: true, sortOrder: 3 },

  // ══════════════ CHOCOLATE (الحفر والطباعة) ══════════════
  { name: "لوح شوكلت",                      price:  50, department: "chocolate", category: "شوكلت الحفر والطباعة",     isAvailable: true, sortOrder: 1 },
  { name: "شوكلت مكسر",                     price: 288, department: "chocolate", category: "شوكلت الحفر والطباعة",     isAvailable: true, sortOrder: 2 },
  { name: "شوكلت طباعة",                    price: 288, department: "chocolate", category: "شوكلت الحفر والطباعة",     isAvailable: true, sortOrder: 3 },
  { name: "هرم شوكلت طباعة",                price: 358, department: "chocolate", category: "شوكلت الحفر والطباعة",     isAvailable: true, sortOrder: 4 },
  { name: "مدرج شوكلت طباعة",               price: 338, department: "chocolate", category: "شوكلت الحفر والطباعة",     isAvailable: true, sortOrder: 5 },
  { name: "خاتم شوكلت طباعة",               price: 358, department: "chocolate", category: "شوكلت الحفر والطباعة",     isAvailable: true, sortOrder: 6 },

  // ══════════════ CHOCOLATE (توزيعات) ══════════════
  { name: "شوكلت شفايف",                             price: 200, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 1 },
  { name: "شوكلت دمعة",                              price: 200, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 2 },
  { name: "ترافل شوكلت",                             price: 200, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 3 },
  { name: "توزيعات هرم (حبتين شوكلت مغلف)",          price:   9, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 4 },
  { name: "توزيعات (4 حبات شوكلت مغلف)",             price:  12, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 5 },
  { name: "توزيعات (4 حبات شوكلت مكشوف)",            price:  15, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 6 },
  { name: "توزيعات مربع (حبتين شوكلت مغلف)",         price:   9, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 7 },
  { name: "توزيعات (حبتين شوكلت مغلف)",              price:   9, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 8 },
  { name: "توزيعات (حبتين شوكلت مكشوف)",             price:   9, department: "chocolate", category: "توزيعات وشوكلت مواليد", isAvailable: true, sortOrder: 9 },

  // ══════════════ MAWALI ══════════════
  { name: "فاهيتا",                         price: 250, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 1 },
  { name: "كرات البطاطس بالدجاج",           price: 250, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 2 },
  { name: "برغر + تورتيال + تاكو",          price: 250, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 3 },
  { name: "اسكالوب دجاج + بشاميل",          price: 250, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 4 },
  { name: "جيب التاجر",                     price: 250, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 5 },
  { name: "كبة + سمبوسة + مسخن",           price: 250, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 6 },
  { name: "ورق عنب الحبة",                  price:   2, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 7 },
  { name: "موالح ايطالي",                   price: 200, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 8 },
  { name: "تارت فرنسي",                    price: 325, department: "mawali", category: "الموالح", isAvailable: true, sortOrder: 9 },

  // ══════════════ HALWA (حال الزفة) ══════════════
  { name: "حال الجوري",                     price:  15, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 1 },
  { name: "حال زفة شوكلت",                  price:  15, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 2 },
  { name: "حال الكاسات",                    price:  12, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 3 },
  { name: "براونيز وردة",                   price:  15, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 4 },
  { name: "كاسات مولتن",                    price:  25, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 5 },
  { name: "حال زفة (بوبز، ماكرون)",         price:  17, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 6 },
  { name: "ماكرون حفر كيلو",               price: 320, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 7 },
  { name: "ماكرون زفة",                     price:   9, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 8 },
  { name: "حال زفة جوز هند",               price:  20, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 9 },
  { name: "مادلين كيك مع لوغو",             price: 288, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 10 },
  { name: "مادلين كيك بدون لوغو",           price: 250, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 11 },
  { name: "هرم ماكرون",                     price: 390, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 12 },
  { name: "مدرج مادلين كيك",               price: 338, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 13 },
  { name: "هرم مادلين كيك",                price: 358, department: "halwa", category: "حال الزفة",           isAvailable: true, sortOrder: 14 },

  // ══════════════ HALWA (الضيافة) ══════════════
  { name: "معمول",                          price: 160, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 1 },
  { name: "هرم تمر محشي (كيلو ونص)",       price: 425, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 2 },
  { name: "تمر محشي",                      price: 250, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 3 },
  { name: "ايسكريم كيك",                   price: 250, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 4 },
  { name: "حلقوم",                         price: 230, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 5 },
  { name: "رهش",                           price: 230, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 6 },
  { name: "هرم شوكلت اصابع (كيلو ونص)",   price: 350, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 7 },
  { name: "هرم شوكلت اصابع (كيلو)",        price: 260, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 8 },
  { name: "بسكوت شاي مالح",               price: 185, department: "halwa", category: "الضيافة",             isAvailable: true, sortOrder: 9 },

  // ══════════════ HALWA (بوكسات وتين وحنين) ══════════════
  { name: "بوكس ورد مع شوكلت",            price: 195, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 1 },
  { name: "بوكس 400غ شوكلت مكشوف",        price:  75, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 2 },
  { name: "بوكس مشكل",                    price: 230, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 3 },
  { name: "نص كيلو شوكلت مكشوف",          price: 100, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 4 },
  { name: "كيلو شوكلت مكشوف",             price: 200, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 5 },
  { name: "بوكس شنطة (600 غرام)",          price: 155, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 6 },
  { name: "نص كيلو موالح ايطالي",          price: 100, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 7 },
  { name: "نص كيلو بتيفور",               price:  80, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 8 },
  { name: "ربع كيلو شوكلت مكشوف",         price:  50, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 9 },
  { name: "بوكس كرانشي كراميل",           price: 100, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 10 },
  { name: "بوكس مجموعة الكراميل",          price: 100, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 11 },
  { name: "كيلو VIP مشكل",               price: 200, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 12 },
  { name: "نص كيلو VIP مشكل",            price: 100, department: "halwa", category: "بوكسات وتين وحنين",   isAvailable: true, sortOrder: 13 },
];

// ─── Context ──────────────────────────────────────────────────────────────────

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

async function seedIfEmpty() {
  const snap = await getDocs(collection(db, "products"));
  if (!snap.empty) return;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  SEED_PRODUCTS.forEach((p) => {
    const ref = doc(collection(db, "products"));
    batch.set(ref, { ...p, createdAt: now, updatedAt: now });
  });
  await batch.commit();
}

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      seedIfEmpty().catch(console.error);
    }

    const q = query(collection(db, "products"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Product[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, "id">),
        }));
        // sort by dept → category → sortOrder
        loaded.sort((a, b) => {
          if (a.department !== b.department) return a.department.localeCompare(b.department);
          if ((a.category ?? "") !== (b.category ?? "")) return (a.category ?? "").localeCompare(b.category ?? "");
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        });
        setProducts(loaded);
        setIsLoading(false);
      },
      (err) => {
        console.error("Firestore products error:", err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const addProduct = useCallback(
    async (data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> => {
      const now = new Date().toISOString();
      const clean = Object.fromEntries(
        Object.entries({ ...data, createdAt: now, updatedAt: now }).filter(([, v]) => v !== undefined)
      );
      const ref = await addDoc(collection(db, "products"), clean);
      return { id: ref.id, ...data, createdAt: now, updatedAt: now };
    },
    []
  );

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      const clean = Object.fromEntries(
        Object.entries({ ...data, updatedAt: new Date().toISOString() }).filter(([, v]) => v !== undefined)
      );
      await updateDoc(doc(db, "products", id), clean);
    },
    []
  );

  const deleteProduct = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "products", id));
  }, []);

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
