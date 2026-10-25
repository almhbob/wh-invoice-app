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
  /** Printed barcode (EAN-13/UPC/Code128…) for scanning at the counter. */
  barcode?: string;
  /** The shop's own item number, typed by hand when there is no barcode. */
  sku?: string;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
