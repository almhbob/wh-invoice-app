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

const RAW_LAVIVIANE_PRODUCTS: LavivianeProductSeed[] = [
  {
    id: "lavi-new-cake-001",
    name: "Luxury Newborn Pyramid - 87 pieces",
    nameEn: "Luxury Newborn Pyramid - 87 pieces",
    price: 475,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    description: "Luxury newborn celebration pyramid. First verified card from New Cake Collection.",
    imageUri: "laviviane-cards/01_New_Cake_s_Collection_Page_2/01_01_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_01_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1010,
  },
  {
    id: "lavi-new-cake-002",
    name: "Slider Cheesecake Box",
    nameEn: "Slider Cheesecake Box",
    price: 170,
    department: "cake" as ProductDept,
    category: "New Cake Collection",
    description: "Cheesecake slider box. Verified card from New Cake Collection.",
    imageUri: "laviviane-cards/01_New_Cake_s_Collection_Page_2/01_02_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_02_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1020,
  },
  {
    id: "lavi-new-cake-003",
    name: "Mix Pretzels Chocolate on Ceramic Tray",
    nameEn: "Mix Pretzels Chocolate on Ceramic Tray",
    price: 285,
    department: "chocolate" as ProductDept,
    category: "New Cake Collection",
    description: "Mixed pretzel chocolate ceramic tray. Verified card from New Cake Collection.",
    imageUri: "laviviane-cards/01_New_Cake_s_Collection_Page_2/01_03_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_03_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1030,
  },
  {
    id: "lavi-new-cake-004",
    name: "Chocolate Crunchy Heater",
    nameEn: "Chocolate Crunchy Heater",
    price: 325,
    department: "chocolate" as ProductDept,
    category: "New Cake Collection",
    description: "Chocolate crunchy heater. Verified card from New Cake Collection.",
    imageUri: "laviviane-cards/01_New_Cake_s_Collection_Page_2/01_04_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_04_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1040,
  },
  {
    id: "lavi-new-cake-005",
    name: "Date Caramel Heater",
    nameEn: "Date Caramel Heater",
    price: 315,
    department: "halwa" as ProductDept,
    category: "New Cake Collection",
    description: "Date caramel heater. Verified card from New Cake Collection.",
    imageUri: "laviviane-cards/01_New_Cake_s_Collection_Page_2/01_05_p2.png",
    sourceFile: "01_New_Cake_s_Collection_Page_2/01_05_p2.png",
    sourcePage: 2,
    isAvailable: true,
    sortOrder: 1050,
  },
];

export const LAVIVIANE_PRODUCTS: LavivianeProductSeed[] = RAW_LAVIVIANE_PRODUCTS.reduce<LavivianeProductSeed[]>((acc, product) => {
  const key = normalizeProductKey(product);
  const exists = acc.some((item) => normalizeProductKey(item) === key);
  if (!exists) acc.push(product);
  return acc;
}, []).sort((a, b) => a.sortOrder - b.sortOrder);

export const LAVIVIANE_CATALOG_SUMMARY = {
  companyId: LAVIVIANE_COMPANY_ID,
  source: "Laviviane product cards",
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
