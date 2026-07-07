import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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

import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";
import { Alert } from "react-native";
import { t as t_ } from "@/constants/translations";

export type Department = "halwa" | "mawali" | "chocolate" | "cake" | "packaging";
export type OrderStatus = "pending" | "in_progress" | "done" | "cancelled";

export type OrderType = "pickup" | "delivery";
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  pickup: "استلام من المحل",
  delivery: "توصيل",
};
export const ORDER_TYPE_LABEL_KEYS: Record<OrderType, "pickup" | "delivery"> = {
  pickup: "pickup",
  delivery: "delivery",
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
export const PAYMENT_LABEL_KEYS: Record<PaymentMethod, "cash" | "paidCard" | "transfer"> = {
  cash: "cash",
  card: "paidCard",
  transfer: "transfer",
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
  referenceImages?: string[];
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
  trayReturned?: boolean;
  trayReturnedAt?: string;
  trayReturnedBy?: { name: string; employeeId: string };
  deliveryStatus?: "pending" | "delivered";
  deliveryDeliveredAt?: string;
  deliveryDriver?: { name: string; employeeId: string; assignedAt?: string };
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
  markTrayReturned: (orderId: string, employee?: { name: string; employeeId: string }) => Promise<void>;
  updateDeliveryStatus: (orderId: string, status: "pending" | "delivered") => Promise<void>;
  assignDeliveryDriver: (orderId: string, driver: { name: string; employeeId: string }) => Promise<void>;
  updateOrder: (id: string, patch: Partial<Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt">>) => Promise<void>;
  getOrdersForDepartment: (department: Department) => Order[];
  refreshOrders: () => void;
  purgeAllOrders: () => Promise<void>;
  isLoading: boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const LOCAL_COUNTER_KEY = "@order_counter_v4_fallback";
const LOCAL_ORDERS_KEY = "@orders_local_v2";

function localOrdersKey(companyId: string) {
  return `${LOCAL_ORDERS_KEY}_${companyId}`;
}

function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function readLocalOrders(companyId: string): Promise<Order[]> {
  try {
    const raw = await AsyncStorage.getItem(localOrdersKey(companyId));
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

async function writeLocalOrders(companyId: string, orders: Order[]): Promise<void> {
  try {
    await AsyncStorage.setItem(localOrdersKey(companyId), JSON.stringify(orders));
  } catch {
    // ignore storage errors
  }
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { companyId, company } = useCompany();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const firestoreAlive = useRef(false);

  const orders        = allOrders.filter(o => !o.deleted);
  const deletedOrders = allOrders.filter(o =>  o.deleted);

  const ordersCollection = useCallback(() => collection(db, "companies", companyId, "orders"), [companyId]);
  const orderDoc = useCallback((id: string) => doc(db, "companies", companyId, "orders", id), [companyId]);
  const counterDoc = useCallback(() => doc(db, "companies", companyId, "counters", "orders"), [companyId]);

  // Load local orders first, then subscribe to Firestore
  useEffect(() => {
    let mounted = true;
    firestoreAlive.current = false;
    setIsLoading(true);
    setAllOrders([]);

    // 1. Load from local storage immediately
    readLocalOrders(companyId).then((local) => {
      if (!mounted) return;
      if (local.length > 0) {
        setAllOrders(local);
      }
      setIsLoading(false);
    });

    // 2. Subscribe to Firestore in background; if it responds, use it as source of truth
    const q = query(ordersCollection(), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!mounted) return;
        firestoreAlive.current = true;
        const loaded: Order[] = snapshot.docs.map((d) => ({
          id: d.id,
          companyId,
          ...(d.data() as Omit<Order, "id">),
        }));
        setAllOrders(loaded);
        setIsLoading(false);
        // Cache Firestore data locally for offline use
        writeLocalOrders(companyId, loaded);
      },
      (err) => {
        console.warn("Firestore orders unavailable, using local data:", err.code);
        if (mounted) setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      unsub();
    };
  }, [companyId, ordersCollection, refreshTick]);

  const refreshOrders = useCallback(() => {
    setIsLoading(true);
    setRefreshTick((t) => t + 1);
  }, []);

  const getNextOrderNumber = useCallback(async (): Promise<number> => {
    try {
      const counterRef = counterDoc();
      let next = 1;
      // Timeout after 4 s so we don't block the UI
      await Promise.race([
        runTransaction(db, async (txn) => {
          const snap = await txn.get(counterRef);
          next = snap.exists() ? (snap.data().value as number) + 1 : 1;
          txn.set(counterRef, { value: next, companyId, updatedAt: new Date().toISOString() });
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("counter-timeout")), 4000)),
      ]);
      return next;
    } catch {
      const key = `${LOCAL_COUNTER_KEY}_${companyId}`;
      const stored = await AsyncStorage.getItem(key);
      const current = stored ? parseInt(stored, 10) : 0;
      const next = current + 1;
      await AsyncStorage.setItem(key, next.toString());
      return next;
    }
  }, [companyId, counterDoc]);

  const addOrder = useCallback(
    async (
      orderData: Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt" | "updatedAt" | "departmentStatuses" | "departmentReceivers">
    ): Promise<Order> => {
      const lang = "ar" as const;
      if (company.maxInvoicesPerMonth) {
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthCount = allOrders.filter((o) => !o.deleted && o.createdAt.startsWith(thisMonth)).length;
        if (monthCount >= company.maxInvoicesPerMonth) {
          const msg = t_("limitMaxInvMsg", lang).replace("{n}", String(company.maxInvoicesPerMonth));
          Alert.alert(t_("limitMaxInvTitle", lang), msg);
          throw new Error("MAX_INVOICES_EXCEEDED");
        }
      }

      const orderNumber = await getNextOrderNumber();
      const now = new Date().toISOString();

      const depts = new Set(orderData.items.map((i) => i.department));
      depts.add("packaging");
      const departmentStatuses = {} as Record<Department, OrderStatus>;
      depts.forEach((d) => { departmentStatuses[d] = "pending"; });

      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const newOrder: Order = {
        ...orderData,
        id: localId,
        companyId,
        orderNumber,
        departmentStatuses,
        departmentReceivers: {},
        createdAt: now,
        updatedAt: now,
      };

      // Save locally and update state immediately — UI unblocked
      setAllOrders((prev) => [newOrder, ...prev]);
      const localOrders = await readLocalOrders(companyId);
      await writeLocalOrders(companyId, [newOrder, ...localOrders]);

      // Attempt Firestore write in background
      const clean = removeUndefined({
        ...orderData,
        companyId,
        orderNumber,
        departmentStatuses,
        departmentReceivers: {},
        createdAt: now,
        updatedAt: now,
      });

      addDoc(ordersCollection(), clean)
        .then((ref) => {
          const withRealId: Order = { ...newOrder, id: ref.id };
          setAllOrders((prev) => prev.map((o) => o.id === localId ? withRealId : o));
          readLocalOrders(companyId).then((saved) =>
            writeLocalOrders(companyId, saved.map((o) => o.id === localId ? withRealId : o))
          );
        })
        .catch((err) => {
          console.warn("Firestore addOrder failed, order kept locally:", err?.code ?? err?.message);
        });

      return newOrder;
    },
    [companyId, ordersCollection, getNextOrderNumber]
  );

  const updateDepartmentStatus = useCallback(
    async (id: string, department: Department, status: OrderStatus, receiver?: EmployeeRef) => {
      setAllOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const newReceivers = { ...o.departmentReceivers };
          if (status === "in_progress" && receiver && !newReceivers[department]) {
            newReceivers[department] = receiver;
          }
          const updated = {
            ...o,
            departmentStatuses: { ...o.departmentStatuses, [department]: status },
            departmentReceivers: newReceivers,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        })
      );

      // Update AsyncStorage
      readLocalOrders(companyId).then((saved) => {
        const updated = saved.map((o) => {
          if (o.id !== id) return o;
          const newReceivers = { ...o.departmentReceivers };
          if (status === "in_progress" && receiver && !newReceivers[department]) {
            newReceivers[department] = receiver;
          }
          return { ...o, departmentStatuses: { ...o.departmentStatuses, [department]: status }, departmentReceivers: newReceivers, updatedAt: new Date().toISOString() };
        });
        writeLocalOrders(companyId, updated);
      });

      // Try Firestore (non-blocking)
      const order = allOrders.find((o) => o.id === id);
      if (!order || id.startsWith("local-")) return;
      const newReceivers = { ...order.departmentReceivers };
      if (status === "in_progress" && receiver && !newReceivers[department]) {
        newReceivers[department] = receiver;
      }
      updateDoc(orderDoc(id), {
        [`departmentStatuses.${department}`]: status,
        departmentReceivers: newReceivers,
        companyId,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.warn("Firestore updateStatus failed:", err?.code));
    },
    [companyId, orderDoc, allOrders]
  );

  const transferToBranch = useCallback(
    async (orderId: string, transfer: BranchTransfer) => {
      setAllOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const updatedItems = o.items.map((item) =>
            transfer.itemIds.includes(item.id) ? { ...item, department: transfer.toDept } : item
          );
          const updatedStatuses = { ...o.departmentStatuses };
          if (!updatedStatuses[transfer.toDept]) updatedStatuses[transfer.toDept] = "pending";
          return { ...o, items: updatedItems, departmentStatuses: updatedStatuses, branchTransfer: transfer, updatedAt: new Date().toISOString() };
        })
      );

      if (orderId.startsWith("local-")) return;
      const order = allOrders.find((o) => o.id === orderId);
      if (!order) return;
      const updatedItems = order.items.map((item) =>
        transfer.itemIds.includes(item.id) ? { ...item, department: transfer.toDept } : item
      );
      const updatedStatuses = { ...order.departmentStatuses };
      if (!updatedStatuses[transfer.toDept]) updatedStatuses[transfer.toDept] = "pending";
      const clean = removeUndefined({ items: updatedItems, departmentStatuses: updatedStatuses, branchTransfer: transfer, companyId, updatedAt: new Date().toISOString() });
      updateDoc(orderDoc(orderId), clean).catch((err) => console.warn("Firestore transfer failed:", err?.code));
    },
    [companyId, orderDoc, allOrders]
  );

  const deleteOrder = useCallback(async (
    id: string,
    deletedBy?: { name: string; employeeId: string }
  ) => {
    const now = new Date().toISOString();
    setAllOrders((prev) =>
      prev.map((o) => o.id === id ? { ...o, deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, updatedAt: now } : o)
    );
    readLocalOrders(companyId).then((saved) =>
      writeLocalOrders(companyId, saved.map((o) => o.id === id ? { ...o, deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, updatedAt: now } : o))
    );
    if (id.startsWith("local-")) return;
    updateDoc(orderDoc(id), { deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, companyId, updatedAt: now })
      .catch((err) => console.warn("Firestore delete failed:", err?.code));
  }, [companyId, orderDoc]);

  const restoreOrder = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setAllOrders((prev) =>
      prev.map((o) => o.id === id ? { ...o, deleted: false, deletedAt: undefined, deletedBy: null, updatedAt: now } : o)
    );
    readLocalOrders(companyId).then((saved) =>
      writeLocalOrders(companyId, saved.map((o) => o.id === id ? { ...o, deleted: false, deletedAt: undefined, deletedBy: null, updatedAt: now } : o))
    );
    if (id.startsWith("local-")) return;
    updateDoc(orderDoc(id), { deleted: false, deletedAt: null, deletedBy: null, companyId, updatedAt: now })
      .catch((err) => console.warn("Firestore restore failed:", err?.code));
  }, [companyId, orderDoc]);

  const markTrayReturned = useCallback(
    async (orderId: string, employee?: { name: string; employeeId: string }) => {
      const now = new Date().toISOString();
      setAllOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : { ...o, trayReturned: true, trayReturnedAt: now, trayReturnedBy: employee ?? undefined, updatedAt: now }
        )
      );

      // Update AsyncStorage
      readLocalOrders(companyId).then((saved) =>
        writeLocalOrders(
          companyId,
          saved.map((o) =>
            o.id !== orderId
              ? o
              : { ...o, trayReturned: true, trayReturnedAt: now, trayReturnedBy: employee ?? undefined, updatedAt: now }
          )
        )
      );

      // Try Firestore (non-blocking)
      if (orderId.startsWith("local-")) return;
      updateDoc(orderDoc(orderId), {
        trayReturned: true,
        trayReturnedAt: now,
        trayReturnedBy: employee ?? null,
        companyId,
        updatedAt: now,
      }).catch((err) => console.warn("Firestore markTrayReturned failed:", err?.code));
    },
    [companyId, orderDoc]
  );

  const updateDeliveryStatus = useCallback(
    async (orderId: string, status: "pending" | "delivered") => {
      const now = new Date().toISOString();
      const patch = { deliveryStatus: status, deliveryDeliveredAt: status === "delivered" ? now : undefined, updatedAt: now };
      setAllOrders((prev) => prev.map((o) => o.id !== orderId ? o : { ...o, ...patch }));
      readLocalOrders(companyId).then((saved) =>
        writeLocalOrders(companyId, saved.map((o) => o.id !== orderId ? o : { ...o, ...patch }))
      );
      if (orderId.startsWith("local-")) return;
      updateDoc(orderDoc(orderId), { deliveryStatus: status, deliveryDeliveredAt: status === "delivered" ? now : null, companyId, updatedAt: now })
        .catch((err) => console.warn("Firestore updateDeliveryStatus failed:", err?.code));
    },
    [companyId, orderDoc]
  );

  const assignDeliveryDriver = useCallback(
    async (orderId: string, driver: { name: string; employeeId: string }) => {
      const now = new Date().toISOString();
      const patch = { deliveryDriver: { ...driver, assignedAt: now }, updatedAt: now };
      setAllOrders((prev) => prev.map((o) => o.id !== orderId ? o : { ...o, ...patch }));
      readLocalOrders(companyId).then((saved) =>
        writeLocalOrders(companyId, saved.map((o) => o.id !== orderId ? o : { ...o, ...patch }))
      );
      if (orderId.startsWith("local-")) return;
      updateDoc(orderDoc(orderId), { deliveryDriver: { ...driver, assignedAt: now }, companyId, updatedAt: now })
        .catch((err) => console.warn("Firestore assignDeliveryDriver failed:", err?.code));
    },
    [companyId, orderDoc]
  );

  const updateOrder = useCallback(
    async (
      id: string,
      patch: Partial<Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt">>
    ) => {
      const now = new Date().toISOString();
      const fullPatch = { ...patch, updatedAt: now };
      setAllOrders((prev) =>
        prev.map((o) => (o.id !== id ? o : { ...o, ...fullPatch }))
      );
      readLocalOrders(companyId).then((saved) =>
        writeLocalOrders(
          companyId,
          saved.map((o) => (o.id !== id ? o : { ...o, ...fullPatch }))
        )
      );
      if (id.startsWith("local-")) return;
      updateDoc(orderDoc(id), removeUndefined({ ...fullPatch, companyId })).catch(
        (err) => console.warn("Firestore updateOrder failed:", err?.code)
      );
    },
    [companyId, orderDoc]
  );

  const getOrdersForDepartment = useCallback(
    (department: Department) => {
      return orders
        .filter((o) => {
          const status = o.departmentStatuses[department];
          if (!status || status === "cancelled") return false;
          if (department === "packaging") return true;
          return o.items.some((i) => i.department === department);
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [orders]
  );

  const purgeAllOrders = useCallback(async () => {
    // Permanently delete every order document from Firestore, then clear local state
    try {
      const snap = await getDocs(query(ordersCollection()));
      const BATCH_SIZE = 500;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn("Firestore purge failed:", err);
    }
    // Reset counter
    try {
      await deleteDoc(doc(db, "companies", companyId, "counters", "orders"));
    } catch (_) {}
    setAllOrders([]);
    await writeLocalOrders(companyId, []);
  }, [companyId, ordersCollection]);

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
        markTrayReturned,
        updateDeliveryStatus,
        assignDeliveryDriver,
        updateOrder,
        getOrdersForDepartment,
        refreshOrders,
        purgeAllOrders,
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
