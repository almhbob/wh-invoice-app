import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";

export type Department = "halwa" | "mawali" | "chocolate" | "cake" | "packaging";
export type OrderStatus = "pending" | "in_progress" | "done" | "cancelled";

export type OrderType = "pickup" | "delivery";
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  pickup: "استلام من المحل",
  delivery: "توصيل",
};

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  department: Department;
  note?: string;
  details?: string;
}

export type PaymentMethod = "cash" | "card" | "transfer";
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "نقداً",
  card: "بطاقة",
  transfer: "تحويل",
};

export type DiscountType = "percentage" | "fixed";
export interface Discount {
  type: DiscountType;
  value: number;
  reason: string;
}

export const DISCOUNT_REASON_PRESETS = [
  "زبون دائم",
  "عرض مناسبة",
  "خصم جهة",
  "عرض خاص",
  "موظف",
];

export interface EmployeeRef {
  name: string;
  employeeId: string;
  timestamp: string;
}

export const TRANSFER_REASON_PRESETS = [
  "نفدت الكمية",
  "الخامة غير متوفرة",
  "عطل في القسم",
  "طلب الزبون",
  "نقصان مكوّن",
  "أخرى",
];

export interface BranchTransfer {
  fromDept: Department;
  toDept: Department;
  itemIds: string[];
  reason: string;
  note?: string;
  transferredBy?: { name: string; employeeId: string };
  transferredAt: string;
}

export interface Order {
  id: string;
  companyId?: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  receivedAt: string;
  deliveryTime?: string;
  insuranceAmount?: number;
  items: OrderItem[];
  totalAmount?: number;
  paymentMethod?: PaymentMethod;
  discount?: Discount;
  imageUri?: string;
  notes?: string;
  cashierEmployee?: EmployeeRef;
  departmentStatuses: Record<Department, OrderStatus>;
  departmentReceivers: Partial<Record<Department, EmployeeRef>>;
  orderType?: OrderType;
  deliveryAddress?: string;
  amountPaid?: number;
  insurancePaymentMethod?: "cash" | "card";
  branchTransfer?: BranchTransfer;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: { name: string; employeeId: string } | null;
}

interface OrdersContextType {
  orders: Order[];
  deletedOrders: Order[];
  addOrder: (
    order: Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt" | "updatedAt" | "departmentStatuses" | "departmentReceivers">
  ) => Promise<Order>;
  updateDepartmentStatus: (
    id: string,
    department: Department,
    status: OrderStatus,
    receiver?: EmployeeRef
  ) => Promise<void>;
  transferToBranch: (
    orderId: string,
    transfer: BranchTransfer
  ) => Promise<void>;
  deleteOrder: (id: string, deletedBy?: { name: string; employeeId: string }) => Promise<void>;
  restoreOrder: (id: string) => Promise<void>;
  getOrdersForDepartment: (department: Department) => Order[];
  isLoading: boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Local counter fallback key (used if Firestore is unreachable)
const LOCAL_COUNTER_KEY = "@order_counter_v4_fallback";

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const orders        = allOrders.filter(o => !o.deleted);
  const deletedOrders = allOrders.filter(o =>  o.deleted);

  const ordersCollection = useCallback(() => collection(db, "companies", companyId, "orders"), [companyId]);
  const orderDoc = useCallback((id: string) => doc(db, "companies", companyId, "orders", id), [companyId]);
  const counterDoc = useCallback(() => doc(db, "companies", companyId, "counters", "orders"), [companyId]);

  useEffect(() => {
    setIsLoading(true);
    setAllOrders([]);
    const q = query(ordersCollection(), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Order[] = snapshot.docs.map((d) => ({
          id: d.id,
          companyId,
          ...(d.data() as Omit<Order, "id">),
        }));
        setAllOrders(loaded);
        setIsLoading(false);
      },
      (err) => {
        console.error("Firestore tenant orders error:", err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [companyId, ordersCollection]);

  const getNextOrderNumber = async (): Promise<number> => {
    try {
      const counterRef = counterDoc();
      let next = 1;
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(counterRef);
        next = snap.exists() ? (snap.data().value as number) + 1 : 1;
        txn.set(counterRef, { value: next, companyId, updatedAt: new Date().toISOString() });
      });
      return next;
    } catch {
      // Fallback to local counter
      const key = `${LOCAL_COUNTER_KEY}_${companyId}`;
      const stored = await AsyncStorage.getItem(key);
      const current = stored ? parseInt(stored, 10) : 0;
      const next = current + 1;
      await AsyncStorage.setItem(key, next.toString());
      return next;
    }
  };

  const addOrder = useCallback(
    async (
      orderData: Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt" | "updatedAt" | "departmentStatuses" | "departmentReceivers">
    ): Promise<Order> => {
      const orderNumber = await getNextOrderNumber();
      const now = new Date().toISOString();

      const depts = new Set(orderData.items.map((i) => i.department));
      depts.add("packaging"); // every order always routed to packaging
      const departmentStatuses = {} as Record<Department, OrderStatus>;
      depts.forEach((d) => { departmentStatuses[d] = "pending"; });

      const firestoreData = {
        ...orderData,
        companyId,
        orderNumber,
        departmentStatuses,
        departmentReceivers: {},
        createdAt: now,
        updatedAt: now,
      };

      // Remove undefined fields (Firestore doesn't support undefined)
      const clean = Object.fromEntries(
        Object.entries(firestoreData).filter(([, v]) => v !== undefined)
      );

      const ref = await addDoc(ordersCollection(), clean);
      return { id: ref.id, ...(firestoreData as Omit<Order, "id">) };
    },
    [companyId, ordersCollection]
  );

  const updateDepartmentStatus = useCallback(
    async (id: string, department: Department, status: OrderStatus, receiver?: EmployeeRef) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return;

      const newReceivers = { ...order.departmentReceivers };
      if (status === "in_progress" && receiver && !newReceivers[department]) {
        newReceivers[department] = receiver;
      }

      await updateDoc(orderDoc(id), {
        [`departmentStatuses.${department}`]: status,
        departmentReceivers: newReceivers,
        companyId,
        updatedAt: new Date().toISOString(),
      });
    },
    [companyId, orderDoc, orders]
  );

  const transferToBranch = useCallback(
    async (orderId: string, transfer: BranchTransfer) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      // Move the selected items to the target department
      const updatedItems = order.items.map((item) =>
        transfer.itemIds.includes(item.id)
          ? { ...item, department: transfer.toDept }
          : item
      );

      // Ensure target dept has a status entry
      const updatedStatuses = { ...order.departmentStatuses };
      if (!updatedStatuses[transfer.toDept]) {
        updatedStatuses[transfer.toDept] = "pending";
      }

      const clean = Object.fromEntries(
        Object.entries({
          items: updatedItems,
          departmentStatuses: updatedStatuses,
          branchTransfer: transfer,
          companyId,
          updatedAt: new Date().toISOString(),
        }).filter(([, v]) => v !== undefined)
      );

      await updateDoc(orderDoc(orderId), clean);
    },
    [companyId, orderDoc, orders]
  );

  const deleteOrder = useCallback(async (
    id: string,
    deletedBy?: { name: string; employeeId: string }
  ) => {
    await updateDoc(orderDoc(id), {
      deleted:   true,
      deletedAt: new Date().toISOString(),
      deletedBy: deletedBy ?? null,
      companyId,
      updatedAt: new Date().toISOString(),
    });
  }, [companyId, orderDoc]);

  const restoreOrder = useCallback(async (id: string) => {
    await updateDoc(orderDoc(id), {
      deleted:   false,
      deletedAt: null,
      deletedBy: null,
      companyId,
      updatedAt: new Date().toISOString(),
    });
  }, [companyId, orderDoc]);

  const getOrdersForDepartment = useCallback(
    (department: Department) => {
      return orders
        .filter((o) => {
          const status = o.departmentStatuses[department];
          if (!status || status === "cancelled") return false;
          // packaging receives ALL orders (no item tagging required)
          if (department === "packaging") return true;
          return o.items.some((i) => i.department === department);
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [orders]
  );

  return (
    <OrdersContext.Provider
      value={{
        orders,
        deletedOrders,
        addOrder,
        updateDepartmentStatus,
        transferToBranch,
        deleteOrder,
        restoreOrder,
        getOrdersForDepartment,
        isLoading,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used inside OrdersProvider");
  return ctx;
}
