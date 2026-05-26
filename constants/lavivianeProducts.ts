import type { Product, ProductDept } from "@/context/TenantProductsContext";

export const LAVIVIANE_COMPANY_ID = "laviviane-trial";

export const LAVIVIANE_CATEGORY_ORDER = [
  "New Cake Collection",
  "Laviviane Cakes",
  "Celebration Bites",
  "Mousse Cake",
  "Laviviane Bites",
  "Sandwich",
  "Luxury Chocolate",
  "Occasion Chocolate",
  "Distributions and Gifts",
] as const;

export type LavivianeCategory = typeof LAVIVIANE_CATEGORY_ORDER[number];
export type LavivianeProductSeed = Omit<Product, "companyId" | "createdAt" | "updatedAt"> & {
  category: LavivianeCategory;
  sourceFile?: string;
  sourcePage?: number;
};

function normalizeProductKey(product: Pick<LavivianeProductSeed, "name" | "price" | "category">) {
  return `${product.category}|${product.name}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") + `|${Number(product.price).toFixed(2)}`;
}

// ── Page 2: New Cake's Collection ─────────────────────────────────────────────

const PAGE2: LavivianeProductSeed[] = [
  {
    id: "lavi-001",
    name: "بيرامود رفاهية المولود الجديد - 87 حبة",
    nameEn: "Luxury Newborn Pyramid - 87 Pcs",
    price: 475,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/01_New_Cake_s_Collection_Page_2/01_01_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_01_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1010,
  },
  {
    id: "lavi-002",
    name: "بوكس سلايدر تشيز",
    nameEn: "Slider Cheesecake Box",
    price: 170,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/01_New_Cake_s_Collection_Page_2/01_02_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_02_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1020,
  },
  {
    id: "lavi-003",
    name: "برتسلز شوكليت على صينية بيضاوية",
    nameEn: "Mix Pretzels Chocolate on Ceramic Tray",
    price: 285,
    department: "chocolate" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/01_New_Cake_s_Collection_Page_2/01_03_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_03_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1030,
  },
  {
    id: "lavi-004",
    name: "سخان الشوكليت الكرانشي",
    nameEn: "Chocolate Crunchy Heater",
    price: 325,
    department: "chocolate" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/01_New_Cake_s_Collection_Page_2/01_04_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_04_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1040,
  },
  {
    id: "lavi-005",
    name: "سخان كريمل بالتمر",
    nameEn: "Date Caramel Heater",
    price: 315,
    department: "halwa" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/01_New_Cake_s_Collection_Page_2/01_05_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_05_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1050,
  },
];

// ── Page 3: New Cake's Collection ─────────────────────────────────────────────

const PAGE3: LavivianeProductSeed[] = [
  {
    id: "lavi-006",
    name: "صينية شوكليت فاخرة",
    nameEn: "Mix Special Chocolate in Ceramic Tray",
    price: 0,
    department: "chocolate" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_01_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_01_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1060,
  },
  {
    id: "lavi-007",
    name: "كيكة الماجو كريم بورلية",
    nameEn: "Mango Cream Brulee Cake",
    price: 0,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_02_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_02_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1070,
  },
  {
    id: "lavi-008",
    name: "تشيز كيك الماجو - صغير",
    nameEn: "Mango Cheesecake - Small",
    price: 0,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_03_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_03_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1080,
  },
  {
    id: "lavi-009",
    name: "تشيز كيك التوت - صغير",
    nameEn: "Raspberry Cheesecake - Small",
    price: 0,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_04_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_04_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1090,
  },
  {
    id: "lavi-010",
    name: "بوكس مشگل حالي ومالح - كبير",
    nameEn: "Sweet & Salty Mixed Box - Large",
    price: 370,
    department: "mawali" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_05_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_05_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1100,
  },
  {
    id: "lavi-011",
    name: "بوكس مشگل حالي ومالح - صغير",
    nameEn: "Sweet & Salty Mixed Box - Small",
    price: 189,
    department: "mawali" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_05_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_05_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1110,
  },
  {
    id: "lavi-012",
    name: "بوكس أصابع مالح - كبير",
    nameEn: "Savory Sticks Box - Large",
    price: 265,
    department: "mawali" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_06_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_06_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1120,
  },
  {
    id: "lavi-013",
    name: "بوكس أصابع مالح - صغير",
    nameEn: "Savory Sticks Box - Small",
    price: 95,
    department: "mawali" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_06_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_06_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1130,
  },
  {
    id: "lavi-014",
    name: "بوكس أي - شوفان وسمسم",
    nameEn: "Mae Sesame Box",
    price: 95,
    department: "mawali" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_07_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_07_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1140,
  },
  {
    id: "lavi-015",
    name: "كيك العسل بايتس - 18 حبة",
    nameEn: "Honey Cake Box - 18 Pcs",
    price: 125,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_07_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_07_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1150,
  },
  {
    id: "lavi-016",
    name: "تارت التمر - 18 حبة",
    nameEn: "Date Tart - 18 Pcs",
    price: 79,
    department: "halwa" as ProductDept,
    category: "New Cake Collection",
    imageUri: "/laviviane-cards/02_New_Cake_s_Collection_Page_3/02_08_p3.png",
    sourceFile: "02_New_Cake_s_Collection_Page_3/02_08_p3.png",
    sourcePage: 3,
    isAvailable: true,
    sortOrder: 1160,
  },
];

// ── Page 4: Laviviane Cakes ────────────────────────────────────────────────────

const PAGE4: LavivianeProductSeed[] = [
  {
    id: "lavi-017",
    name: "كيكة الليمون - صغير",
    nameEn: "Lemon Cake - Small",
    price: 29,
    department: "cake" as ProductDept,
    category: "Laviviane Cakes",
    imageUri: "/laviviane-cards/03_Laviviane_Cake_s/03_01_p4.png",
    sourceFile: "03_Laviviane_Cake_s/03_01_p4.png",
    sourcePage: 4,
    isAvailable: true,
    sortOrder: 2010,
  },
  {
    id: "lavi-018",
    name: "كيكة ردفيلفت فولكينو - صغير",
    nameEn: "Red Velvet Cake - Small",
    price: 46,
    department: "cake" as ProductDept,
    category: "Laviviane Cakes",
    imageUri: "/laviviane-cards/03_Laviviane_Cake_s/03_02_p4.png",
    sourceFile: "03_Laviviane_Cake_s/03_02_p4.png",
    sourcePage: 4,
    isAvailable: true,
    sortOrder: 2020,
  },
  {
    id: "lavi-019",
    name: "نوتيلا كيك - صغير",
    nameEn: "Nutella Cake - Small",
    price: 39,
    department: "cake" as ProductDept,
    category: "Laviviane Cakes",
    imageUri: "/laviviane-cards/03_Laviviane_Cake_s/03_03_p4.png",
    sourceFile: "03_Laviviane_Cake_s/03_03_p4.png",
    sourcePage: 4,
    isAvailable: true,
    sortOrder: 2030,
  },
  {
    id: "lavi-020",
    name: "نوتيلا بيستاشيو كيك - صغير",
    nameEn: "Nutella Pistachio Cake - Small",
    price: 39,
    department: "cake" as ProductDept,
    category: "Laviviane Cakes",
    imageUri: "/laviviane-cards/03_Laviviane_Cake_s/03_04_p4.png",
    sourceFile: "03_Laviviane_Cake_s/03_04_p4.png",
    sourcePage: 4,
    isAvailable: true,
    sortOrder: 2040,
  },
  {
    id: "lavi-021",
    name: "سلايد بوكس كيك 4 أنواع - مع كتابه",
    nameEn: "Slider Cake Box with Writing - 4 Types",
    price: 173,
    department: "cake" as ProductDept,
    category: "Laviviane Cakes",
    imageUri: "/laviviane-cards/03_Laviviane_Cake_s/03_05_p4.png",
    sourceFile: "03_Laviviane_Cake_s/03_05_p4.png",
    sourcePage: 4,
    isAvailable: true,
    sortOrder: 2050,
  },
  {
    id: "lavi-022",
    name: "ميني إكلير كريم برولية مغطاه بالشوكولانة - كبير",
    nameEn: "Mini Eclair Cream Brulee Chocolate - Big",
    price: 140,
    department: "chocolate" as ProductDept,
    category: "Laviviane Cakes",
    imageUri: "/laviviane-cards/03_Laviviane_Cake_s/03_06_p4.png",
    sourceFile: "03_Laviviane_Cake_s/03_06_p4.png",
    sourcePage: 4,
    isAvailable: true,
    sortOrder: 2060,
  },
];

const RAW_LAVIVIANE_PRODUCTS: LavivianeProductSeed[] = [...PAGE2, ...PAGE3, ...PAGE4];

export const LAVIVIANE_PRODUCTS: LavivianeProductSeed[] = RAW_LAVIVIANE_PRODUCTS.reduce<LavivianeProductSeed[]>((acc, product) => {
  const key = normalizeProductKey(product);
  const exists = acc.some((item) => normalizeProductKey(item) === key);
  if (!exists) acc.push(product);
  return acc;
}, []).sort((a, b) => a.sortOrder - b.sortOrder);

export const LAVIVIANE_CATALOG_SUMMARY = {
  companyId: LAVIVIANE_COMPANY_ID,
  source: "Laviviane product cards (pages 2–4)",
  productCount: LAVIVIANE_PRODUCTS.length,
  categoryOrder: LAVIVIANE_CATEGORY_ORDER,
  duplicatePolicy: "Products are considered duplicates only when normalized category, name, and price are identical. Different sizes/counts remain separate products.",
} as const;

export function buildLavivianeProducts(now = new Date().toISOString()): Product[] {
  return LAVIVIANE_PRODUCTS.map((product) => ({
    ...product,
    companyId: LAVIVIANE_COMPANY_ID,
    createdAt: now,
    updatedAt: now,
  }));
}
