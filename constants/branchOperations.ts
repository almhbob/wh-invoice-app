export type BranchId = "main" | "north" | "south" | "demo";

export type TrayReturnStatus = "pending" | "returned" | "expired" | "damaged";

export interface BranchProfile {
  id: BranchId;
  nameAr: string;
  nameEn: string;
  cityAr: string;
  isActive: boolean;
}

export interface TrayReturnRecord {
  id: string;
  orderId: string;
  orderNumber: number;
  branchId: BranchId;
  customerName: string;
  customerPhone: string;
  insuranceAmount: number;
  dueAt: string;
  returnedAt?: string;
  status: TrayReturnStatus;
  damage?: {
    reason: string;
    note?: string;
    imageUri?: string;
    recordedBy?: string;
    recordedAt: string;
  };
}

export const DEFAULT_BRANCHES: BranchProfile[] = [
  { id: "main", nameAr: "الفرع الرئيسي", nameEn: "Main Branch", cityAr: "الرياض", isActive: true },
  { id: "north", nameAr: "فرع الشمال", nameEn: "North Branch", cityAr: "الرياض", isActive: true },
  { id: "south", nameAr: "فرع الجنوب", nameEn: "South Branch", cityAr: "الرياض", isActive: true },
  { id: "demo", nameAr: "فرع تجريبي", nameEn: "Demo Branch", cityAr: "تجريبي", isActive: true },
];

export const DAMAGE_REASON_PRESETS = [
  "كسر في الصينية",
  "خدش واضح",
  "فقدان قطعة",
  "تلف أثناء التوصيل",
  "تلف عند العميل",
  "أخرى",
];

export function getBranchName(branchId: BranchId) {
  return DEFAULT_BRANCHES.find((b) => b.id === branchId)?.nameAr ?? "فرع غير محدد";
}

export function compareBranchReturns(records: TrayReturnRecord[]) {
  return DEFAULT_BRANCHES.map((branch) => {
    const branchRecords = records.filter((r) => r.branchId === branch.id);
    const returned = branchRecords.filter((r) => r.status === "returned").length;
    const damaged = branchRecords.filter((r) => r.status === "damaged").length;
    const expired = branchRecords.filter((r) => r.status === "expired").length;
    const pending = branchRecords.filter((r) => r.status === "pending").length;
    return {
      branch,
      total: branchRecords.length,
      returned,
      damaged,
      expired,
      pending,
      returnRate: branchRecords.length ? Math.round((returned / branchRecords.length) * 100) : 0,
      riskScore: expired * 3 + damaged * 2 + pending,
    };
  }).sort((a, b) => b.returned - a.returned || b.riskScore - a.riskScore);
}
