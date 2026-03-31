import React, { createContext, useContext, useCallback } from "react";
import { useOrders, Order } from "./OrdersContext";

export interface TrayEntry {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  insuranceAmount: number;
  insurancePaymentMethod?: "cash" | "card";
  createdAt: string;
  returned: boolean;
}

interface TraysContextType {
  trays: TrayEntry[];
  totalTrays: number;
  returnedTrays: number;
  outstandingTrays: number;
}

const TraysContext = createContext<TraysContextType>({
  trays: [],
  totalTrays: 0,
  returnedTrays: 0,
  outstandingTrays: 0,
});

export function TraysProvider({ children }: { children: React.ReactNode }) {
  const { orders } = useOrders();

  const trays: TrayEntry[] = orders
    .filter((o) => o.insuranceAmount && o.insuranceAmount > 0)
    .map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      insuranceAmount: o.insuranceAmount ?? 0,
      insurancePaymentMethod: o.insurancePaymentMethod,
      createdAt: o.createdAt,
      returned: false,
    }));

  const totalTrays = trays.length;
  const returnedTrays = 0;
  const outstandingTrays = totalTrays - returnedTrays;

  return (
    <TraysContext.Provider value={{ trays, totalTrays, returnedTrays, outstandingTrays }}>
      {children}
    </TraysContext.Provider>
  );
}

export function useTrays() {
  return useContext(TraysContext);
}
