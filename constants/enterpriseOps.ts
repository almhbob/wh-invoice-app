export type CashierShiftStatus = "open" | "closed" | "audited";
export type InventoryMovementType = "purchase" | "sale" | "waste" | "return" | "adjustment" | "transfer";
export type LoyaltyTier = "new" | "silver" | "gold" | "vip";

export interface CashierShiftSummary {
  id: string;
  branchId: string;
  cashierEmployeeId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  status: CashierShiftStatus;
  invoicesCount: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  note?: string;
}

export interface InventoryItem {
  id: string;
  branchId: string;
  nameAr: string;
  unit: "piece" | "kg" | "gram" | "liter" | "box";
  quantity: number;
  minQuantity: number;
  cost: number;
  category: "product" | "ingredient" | "packaging" | "tray";
  imageUri?: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  branchId: string;
  type: InventoryMovementType;
  quantity: number;
  note?: string;
  imageUri?: string;
  createdAt: string;
  createdBy?: string;
}

export interface LoyaltyCustomerProfile {
  id: string;
  name: string;
  phone: string;
  tier: LoyaltyTier;
  points: number;
  totalSpent: number;
  visits: number;
  lastVisitAt?: string;
  occasionDate?: string;
}

export const DEMO_SHIFT_SUMMARIES: CashierShiftSummary[] = [
  { id: "s1", branchId: "main", cashierEmployeeId: "DEMO-CASHIER", cashierName: "كاشير تجريبي", openedAt: new Date().toISOString(), status: "open", invoicesCount: 18, cashTotal: 1250, cardTotal: 2420, transferTotal: 600, expectedCash: 1250 },
  { id: "s2", branchId: "north", cashierEmployeeId: "EMP-002", cashierName: "كاشير الشمال", openedAt: new Date().toISOString(), closedAt: new Date().toISOString(), status: "closed", invoicesCount: 23, cashTotal: 1780, cardTotal: 3140, transferTotal: 450, expectedCash: 1780, countedCash: 1760, difference: -20, note: "فرق بسيط يحتاج مراجعة" },
];

export const DEMO_INVENTORY_ITEMS: InventoryItem[] = [
  { id: "i1", branchId: "main", nameAr: "كيك شوكولاتة", unit: "piece", quantity: 14, minQuantity: 5, cost: 42, category: "product" },
  { id: "i2", branchId: "main", nameAr: "كاكاو خام", unit: "kg", quantity: 8, minQuantity: 10, cost: 38, category: "ingredient" },
  { id: "i3", branchId: "north", nameAr: "علب تغليف ذهبية", unit: "box", quantity: 35, minQuantity: 20, cost: 4.5, category: "packaging" },
  { id: "i4", branchId: "south", nameAr: "صواني تأمين", unit: "piece", quantity: 9, minQuantity: 12, cost: 30, category: "tray" },
];

export const DEMO_LOYALTY_CUSTOMERS: LoyaltyCustomerProfile[] = [
  { id: "c1", name: "عميل VIP", phone: "0500000100", tier: "vip", points: 1220, totalSpent: 8300, visits: 27, lastVisitAt: new Date().toISOString() },
  { id: "c2", name: "عميل ذهبي", phone: "0500000200", tier: "gold", points: 740, totalSpent: 4200, visits: 16, lastVisitAt: new Date().toISOString() },
  { id: "c3", name: "عميل جديد", phone: "0500000300", tier: "new", points: 80, totalSpent: 350, visits: 2 },
];

export function inventoryAlerts(items: InventoryItem[]) {
  return items.filter((item) => item.quantity <= item.minQuantity);
}

export function shiftTotal(shift: CashierShiftSummary) {
  return shift.cashTotal + shift.cardTotal + shift.transferTotal;
}

export function loyaltyTierLabel(tier: LoyaltyTier) {
  switch (tier) {
    case "vip": return "VIP";
    case "gold": return "ذهبي";
    case "silver": return "فضي";
    default: return "جديد";
  }
}
