import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";

export interface ShiftSummary {
  orderCount: number;
  totalAmount: number;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  deliveryCount: number;
  pickupCount: number;
  insuranceTotal: number;
  discountTotal: number;
}

export interface ClosedShift {
  id: string;
  companyId: string;
  closedAt: string;
  closedBy: { name: string; employeeId: string };
  periodStart: string;
  notes?: string;
  summary: ShiftSummary;
}

interface ShiftContextType {
  closedShifts: ClosedShift[];
  closeShift: (
    employee: { name: string; employeeId: string },
    summary: ShiftSummary,
    periodStart: string,
    notes?: string
  ) => Promise<ClosedShift>;
  lastClosed: ClosedShift | null;
  isLoading: boolean;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be inside ShiftProvider");
  return ctx;
}

function shiftKey(companyId: string) {
  return `@shifts_v1_${companyId}`;
}

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const [closedShifts, setClosedShifts] = useState<ClosedShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    AsyncStorage.getItem(shiftKey(companyId))
      .then((raw) => {
        if (raw) setClosedShifts(JSON.parse(raw) as ClosedShift[]);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [companyId]);

  const closeShift = useCallback(
    async (
      employee: { name: string; employeeId: string },
      summary: ShiftSummary,
      periodStart: string,
      notes?: string
    ): Promise<ClosedShift> => {
      const shift: ClosedShift = {
        id: `shift-${Date.now()}`,
        companyId,
        closedAt: new Date().toISOString(),
        closedBy: employee,
        periodStart,
        notes,
        summary,
      };
      const updated = [shift, ...closedShifts].slice(0, 90); // keep last 90 shifts
      setClosedShifts(updated);
      await AsyncStorage.setItem(shiftKey(companyId), JSON.stringify(updated));
      return shift;
    },
    [companyId, closedShifts]
  );

  const lastClosed = closedShifts.length > 0 ? closedShifts[0] : null;

  return (
    <ShiftContext.Provider value={{ closedShifts, closeShift, lastClosed, isLoading }}>
      {children}
    </ShiftContext.Provider>
  );
}
