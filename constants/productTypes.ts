// Shared product types (plain TS so server code can import them).
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
