import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
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
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
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
  temporaryOrderNumber?: boolean;
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
  syncStatus?: "pending" | "synced";
}

export function formatOrderNumber(
  order: Pick<Order, "orderNumber" | "temporaryOrderNumber">,
  temporaryLabel = "مؤقت"
): string {
  if (!order.temporaryOrderNumber) return String(order.orderNumber);
  const suffix = String(Math.abs(order.orderNumber)).slice(-6);
  return `${temporaryLabel} ${suffix}`;
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
  pendingSyncCount: number;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const LOCAL_ORDERS_KEY = "@orders_local_v2";
const ORDER_OUTBOX_KEY = "@orders_outbox_v1";

interface PendingOrderSync {
  queueId: string;
  orderId: string;
  kind: "create" | "patch";
  data: Record<string, unknown>;
  updatedAt: string;
}

const outboxWriteChains = new Map<string, Promise<void>>();
const localOrderWriteChains = new Map<string, Promise<Order[]>>();

function localOrdersKey(companyId: string) {
  return `${LOCAL_ORDERS_KEY}_${companyId}`;
}

function orderOutboxKey(companyId: string) {
  return `${ORDER_OUTBOX_KEY}_${companyId}`;
}

async function readOrderOutbox(companyId: string): Promise<PendingOrderSync[]> {
  try {
    const raw = await AsyncStorage.getItem(orderOutboxKey(companyId));
    return raw ? (JSON.parse(raw) as PendingOrderSync[]) : [];
  } catch {
    return [];
  }
}

function mutateOrderOutbox(
  companyId: string,
  mutate: (queue: PendingOrderSync[]) => PendingOrderSync[]
): Promise<void> {
  const previous = outboxWriteChains.get(companyId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const current = await readOrderOutbox(companyId);
    await AsyncStorage.setItem(orderOutboxKey(companyId), JSON.stringify(mutate(current)));
  });
  outboxWriteChains.set(companyId, next);
  return next.finally(() => {
    if (outboxWriteChains.get(companyId) === next) outboxWriteChains.delete(companyId);
  });
}

function serializeOrder(order: Order): Record<string, unknown> {
  const { id: _id, syncStatus: _syncStatus, ...data } = order;
  return removeUndefined(data as unknown as Record<string, unknown>);
}

async function enqueueOrderCreate(companyId: string, order: Order): Promise<void> {
  const entry: PendingOrderSync = {
    queueId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    orderId: order.id,
    kind: "create",
    data: serializeOrder(order),
    updatedAt: order.updatedAt,
  };
  await mutateOrderOutbox(companyId, (queue) => [
    ...queue.filter((item) => item.orderId !== order.id),
    entry,
  ]);
}

async function enqueueOrderPatch(
  companyId: string,
  order: Order,
  patch: Record<string, unknown>
): Promise<void> {
  const queueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await mutateOrderOutbox(companyId, (queue) => {
    const pendingCreate = queue.find((item) => item.orderId === order.id && item.kind === "create");
    if (pendingCreate) {
      return queue
        .filter((item) => item.orderId !== order.id || item.kind === "create")
        .map((item) => item.queueId === pendingCreate.queueId
          ? {
              ...item,
              queueId,
              data: serializeOrder(order),
              updatedAt: order.updatedAt,
            }
          : item);
    }
    const orderPatches = queue.filter((item) => item.orderId === order.id && item.kind === "patch");
    if (orderPatches.length > 0) {
      const firstPatchIndex = queue.findIndex((item) => item.orderId === order.id && item.kind === "patch");
      const previousData = orderPatches.reduce<Record<string, unknown>>(
        (merged, item) => ({ ...merged, ...item.data }),
        {}
      );
      const mergedData = { ...previousData, ...removeUndefined(patch) };
      const mergedEntry: PendingOrderSync = {
        ...orderPatches[0],
        queueId,
        data: mergedData,
        updatedAt: order.updatedAt,
      };
      const next: PendingOrderSync[] = [];
      let inserted = false;
      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        if (item.orderId === order.id && item.kind === "patch") {
          if (!inserted && index === firstPatchIndex) {
            next.push(mergedEntry);
            inserted = true;
          }
        } else {
          next.push(item);
        }
      }
      return next;
    }
    return [
      ...queue,
      {
        queueId,
        orderId: order.id,
        kind: "patch",
        data: removeUndefined(patch),
        updatedAt: order.updatedAt,
      },
    ];
  });
}

async function removeOrderOutboxEntry(companyId: string, queueId: string): Promise<void> {
  await mutateOrderOutbox(companyId, (queue) => queue.filter((item) => item.queueId !== queueId));
}

async function setOutboxOrderNumber(
  companyId: string,
  orderId: string,
  orderNumber: number
): Promise<void> {
  await mutateOrderOutbox(companyId, (queue) => queue.map((item) =>
    item.orderId === orderId && item.kind === "create"
      ? {
          ...item,
          queueId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          data: { ...item.data, orderNumber, temporaryOrderNumber: false },
        }
      : item
  ));
}

async function persistOrderMutation(
  companyId: string,
  orderId: string,
  update: (order: Order) => Order,
  fallback: Order | undefined,
  patch: Record<string, unknown>
): Promise<Order | undefined> {
  let updatedOrder: Order | undefined;
  await mutateLocalOrders(companyId, (saved) => {
    const existing = saved.find((order) => order.id === orderId) ?? fallback;
    if (!existing) return saved;
    updatedOrder = { ...update(existing), syncStatus: "pending" };
    return saved.some((order) => order.id === orderId)
      ? saved.map((order) => order.id === orderId ? updatedOrder! : order)
      : [updatedOrder!, ...saved];
  });
  if (!updatedOrder) return undefined;
  await enqueueOrderPatch(companyId, updatedOrder, patch);
  return updatedOrder;
}

function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, nested]) => nested !== undefined)
          .map(([key, nested]) => [key, clean(nested)])
      );
    }
    return value;
  };
  return clean(obj) as Record<string, unknown>;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("order-sync-timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
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

function mutateLocalOrders(
  companyId: string,
  mutate: (orders: Order[]) => Order[]
): Promise<Order[]> {
  const previous = localOrderWriteChains.get(companyId) ?? Promise.resolve([]);
  const next = previous.catch(() => []).then(async () => {
    const current = await readLocalOrders(companyId);
    const updated = mutate(current);
    await writeLocalOrders(companyId, updated);
    return updated;
  });
  localOrderWriteChains.set(companyId, next);
  return next.finally(() => {
    if (localOrderWriteChains.get(companyId) === next) localOrderWriteChains.delete(companyId);
  });
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { companyId, company } = useCompany();
  const isOnline = useNetworkStatus();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const firestoreAlive = useRef(false);
  const flushingOutbox = useRef(false);

  const orders        = allOrders.filter(o => !o.deleted);
  const deletedOrders = allOrders.filter(o =>  o.deleted);

  const ordersCollection = useCallback(() => collection(db, "companies", companyId, "orders"), [companyId]);
  const counterDoc = useCallback(() => doc(db, "companies", companyId, "counters", "orders"), [companyId]);

  const refreshPendingSyncCount = useCallback(async () => {
    const queue = await readOrderOutbox(companyId);
    setPendingSyncCount(new Set(queue.map((entry) => entry.orderId)).size);
  }, [companyId]);

  // Load local orders first, then subscribe to Firestore
  useEffect(() => {
    let mounted = true;
    firestoreAlive.current = false;
    setIsLoading(true);
    setAllOrders([]);

    // 1. Load from local storage immediately
    readLocalOrders(companyId).then(async (local) => {
      if (!mounted) return;
      if (local.length > 0) {
        const recovered = local.map((order) =>
          order.id.startsWith("local-") && order.syncStatus !== "synced"
            ? { ...order, syncStatus: "pending" as const }
            : order
        );
        setAllOrders(recovered);
        const queued = await readOrderOutbox(companyId);
        const queuedIds = new Set(queued.map((entry) => entry.orderId));
        for (const order of recovered) {
          if (order.syncStatus === "pending" && !queuedIds.has(order.id)) {
            if (order.id.startsWith("local-")) {
              await enqueueOrderCreate(companyId, order);
            } else {
              await enqueueOrderPatch(companyId, order, serializeOrder(order));
            }
          }
        }
        await mutateLocalOrders(companyId, (current) => {
          const recoveredById = new Map(recovered.map((order) => [order.id, order]));
          const merged = current.map((order) => recoveredById.get(order.id) ?? order);
          const currentIds = new Set(merged.map((order) => order.id));
          return [...merged, ...recovered.filter((order) => !currentIds.has(order.id))];
        });
      }
      await refreshPendingSyncCount();
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
          syncStatus: "synced",
        }));
        mutateLocalOrders(companyId, (local) => {
          if (!mounted) return local;
          const pending = local.filter((order) => order.syncStatus === "pending");
          const pendingById = new Map(pending.map((order) => [order.id, order]));
          const remoteIds = new Set(loaded.map((order) => order.id));
          const merged = loaded.map((order) => pendingById.get(order.id) ?? order);
          merged.push(...pending.filter((order) => !remoteIds.has(order.id)));
          return merged;
        }).then(async (merged) => {
          if (!mounted) return;
          setAllOrders(merged);
          setIsLoading(false);
          await refreshPendingSyncCount();
        });
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
  }, [companyId, ordersCollection, refreshTick, refreshPendingSyncCount]);

  const refreshOrders = useCallback(() => {
    setIsLoading(true);
    setRefreshTick((t) => t + 1);
  }, []);

  const flushPendingOrders = useCallback(async () => {
    if (!isOnline || flushingOutbox.current) return;
    flushingOutbox.current = true;
    try {
      const queued = await readOrderOutbox(companyId);
      setPendingSyncCount(new Set(queued.map((entry) => entry.orderId)).size);

      for (const entry of queued) {
        try {
          const ref = doc(db, "companies", companyId, "orders", entry.orderId);
          let assignedOrderNumber: number | undefined;
          if (entry.kind === "create" && entry.data.temporaryOrderNumber === true) {
            assignedOrderNumber = await withTimeout(
              runTransaction(db, async (transaction) => {
                // A previous commit may have succeeded just before disconnect.
                // Read the stable order ID before allocating another number.
                const existing = await transaction.get(ref);
                if (existing.exists()) return existing.data().orderNumber as number;
                const counterRef = counterDoc();
                const counter = await transaction.get(counterRef);
                const next = counter.exists() ? (counter.data().value as number) + 1 : 1;
                transaction.set(counterRef, { value: next, companyId, updatedAt: new Date().toISOString() });
                transaction.set(ref, removeUndefined({
                  ...entry.data,
                  orderNumber: next,
                  temporaryOrderNumber: false,
                }));
                return next;
              }),
              12000
            );
            await setOutboxOrderNumber(companyId, entry.orderId, assignedOrderNumber);
          } else {
            await withTimeout(
              entry.kind === "create" ? setDoc(ref, entry.data) : updateDoc(ref, entry.data),
              12000
            );
          }
          await removeOrderOutboxEntry(companyId, entry.queueId);
          const remaining = await readOrderOutbox(companyId);
          const stillPending = remaining.some((item) => item.orderId === entry.orderId);
          const updatedLocal = await mutateLocalOrders(companyId, (local) => {
            const current = local.find((order) => order.id === entry.orderId);
            if (!current) return local;
            const orderWithAssignedNumber = assignedOrderNumber == null
              ? current
              : { ...current, orderNumber: assignedOrderNumber, temporaryOrderNumber: false };
            const syncStatus = current.updatedAt === entry.updatedAt && !stillPending ? "synced" : "pending";
            const updated = { ...orderWithAssignedNumber, syncStatus: syncStatus as "pending" | "synced" };
            if (assignedOrderNumber == null && updated.syncStatus === current.syncStatus) return local;
            return local.map((order) => order.id === entry.orderId ? updated : order);
          });
          const updated = updatedLocal.find((order) => order.id === entry.orderId);
          if (updated) setAllOrders((prev) => prev.map((order) => order.id === entry.orderId ? updated : order));
        } catch (error: any) {
          console.warn("Order sync deferred:", error?.code ?? error?.message);
          break;
        }
      }
    } finally {
      flushingOutbox.current = false;
      await refreshPendingSyncCount();
    }
  }, [companyId, counterDoc, isOnline, refreshPendingSyncCount]);

  useEffect(() => {
    if (!isOnline) return;
    void flushPendingOrders();
    const retry = setInterval(() => void flushPendingOrders(), 15000);
    return () => clearInterval(retry);
  }, [isOnline, flushPendingOrders]);

  const getNextOrderNumber = useCallback(async (): Promise<{ number: number; temporary: boolean }> => {
    const getLocalFallback = async () => {
      const temporary = Math.floor(Date.now() * 1000 + Math.random() * 1000);
      return { number: -temporary, temporary: true };
    };

    if (!isOnline) return getLocalFallback();

    try {
      const counterRef = counterDoc();
      const next = await withTimeout(
        runTransaction(db, async (txn) => {
          const snap = await txn.get(counterRef);
          const nextNumber = snap.exists() ? (snap.data().value as number) + 1 : 1;
          txn.set(counterRef, { value: nextNumber, companyId, updatedAt: new Date().toISOString() });
          return nextNumber;
        }),
        1500
      );
      return { number: next, temporary: false };
    } catch {
      return getLocalFallback();
    }
  }, [companyId, counterDoc, isOnline]);

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

      const { number: orderNumber, temporary: temporaryOrderNumber } = await getNextOrderNumber();
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
        temporaryOrderNumber,
        departmentStatuses,
        departmentReceivers: {},
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      };

      // Save locally and update state immediately — UI unblocked
      setAllOrders((prev) => [newOrder, ...prev]);
      await mutateLocalOrders(companyId, (localOrders) => [
        newOrder,
        ...localOrders.filter((order) => order.id !== localId),
      ]);
      await enqueueOrderCreate(companyId, newOrder);
      await refreshPendingSyncCount();
      void flushPendingOrders();

      return newOrder;
    },
    [companyId, flushPendingOrders, getNextOrderNumber, refreshPendingSyncCount]
  );

  const updateDepartmentStatus = useCallback(
    async (id: string, department: Department, status: OrderStatus, receiver?: EmployeeRef) => {
      const existing = allOrders.find((order) => order.id === id);
      if (!existing) return;
      const now = new Date().toISOString();
      setAllOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const newReceivers = { ...o.departmentReceivers };
          if (status === "in_progress" && receiver && !newReceivers[department]) {
            newReceivers[department] = receiver;
          }
          return {
            ...o,
            departmentStatuses: { ...o.departmentStatuses, [department]: status },
            departmentReceivers: newReceivers,
            updatedAt: now,
            syncStatus: "pending",
          };
        })
      );

      await persistOrderMutation(companyId, id, (order) => ({
        ...order,
        departmentStatuses: { ...order.departmentStatuses, [department]: status },
        departmentReceivers: {
          ...order.departmentReceivers,
          ...(status === "in_progress" && receiver && !order.departmentReceivers[department]
            ? { [department]: receiver }
            : {}),
        },
        updatedAt: now,
      }), existing, {
        [`departmentStatuses.${department}`]: status,
        ...(status === "in_progress" && receiver && !existing.departmentReceivers[department]
          ? { [`departmentReceivers.${department}`]: receiver }
          : {}),
        companyId,
        updatedAt: now,
      });
      await refreshPendingSyncCount();
    },
    [companyId, allOrders, refreshPendingSyncCount]
  );

  const transferToBranch = useCallback(
    async (orderId: string, transfer: BranchTransfer) => {
      const existing = allOrders.find((order) => order.id === orderId);
      if (!existing) return;
      const now = new Date().toISOString();
      setAllOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const updatedItems = o.items.map((item) =>
            transfer.itemIds.includes(item.id) ? { ...item, department: transfer.toDept } : item
          );
          const updatedStatuses = { ...o.departmentStatuses };
          if (!updatedStatuses[transfer.toDept]) updatedStatuses[transfer.toDept] = "pending";
          return {
            ...o,
            items: updatedItems,
            departmentStatuses: updatedStatuses,
            branchTransfer: transfer,
            updatedAt: now,
            syncStatus: "pending",
          };
        })
      );

      await persistOrderMutation(companyId, orderId, (order) => {
        const updatedItems = order.items.map((item) =>
          transfer.itemIds.includes(item.id) ? { ...item, department: transfer.toDept } : item
        );
        const updatedStatuses = { ...order.departmentStatuses };
        if (!updatedStatuses[transfer.toDept]) updatedStatuses[transfer.toDept] = "pending";
        return { ...order, items: updatedItems, departmentStatuses: updatedStatuses, branchTransfer: transfer, updatedAt: now };
      }, existing, {
        items: existing.items.map((item) =>
          transfer.itemIds.includes(item.id) ? { ...item, department: transfer.toDept } : item
        ),
        ...(existing.departmentStatuses[transfer.toDept]
          ? {}
          : { [`departmentStatuses.${transfer.toDept}`]: "pending" }),
        branchTransfer: transfer,
        companyId,
        updatedAt: now,
      });
      await refreshPendingSyncCount();
    },
    [companyId, allOrders, refreshPendingSyncCount]
  );

  const deleteOrder = useCallback(async (
    id: string,
    deletedBy?: { name: string; employeeId: string }
  ) => {
    const now = new Date().toISOString();
    setAllOrders((prev) =>
      prev.map((o) => o.id === id ? { ...o, deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, updatedAt: now, syncStatus: "pending" } : o)
    );
    await persistOrderMutation(companyId, id, (order) => ({
      ...order, deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, updatedAt: now,
    }), allOrders.find((order) => order.id === id), {
      deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, companyId, updatedAt: now,
    });
    await refreshPendingSyncCount();
  }, [companyId, allOrders, refreshPendingSyncCount]);

  const restoreOrder = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setAllOrders((prev) =>
      prev.map((o) => o.id === id ? { ...o, deleted: false, deletedAt: undefined, deletedBy: null, updatedAt: now, syncStatus: "pending" } : o)
    );
    await persistOrderMutation(companyId, id, (order) => ({
      ...order, deleted: false, deletedAt: undefined, deletedBy: null, updatedAt: now,
    }), allOrders.find((order) => order.id === id), {
      deleted: false, deletedAt: null, deletedBy: null, companyId, updatedAt: now,
    });
    await refreshPendingSyncCount();
  }, [companyId, allOrders, refreshPendingSyncCount]);

  const markTrayReturned = useCallback(
    async (orderId: string, employee?: { name: string; employeeId: string }) => {
      const now = new Date().toISOString();
      setAllOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : { ...o, trayReturned: true, trayReturnedAt: now, trayReturnedBy: employee ?? undefined, updatedAt: now, syncStatus: "pending" }
        )
      );

      await persistOrderMutation(companyId, orderId, (order) => ({
        ...order,
        trayReturned: true,
        trayReturnedAt: now,
        trayReturnedBy: employee ?? undefined,
        updatedAt: now,
      }), allOrders.find((order) => order.id === orderId), {
        trayReturned: true,
        trayReturnedAt: now,
        trayReturnedBy: employee ?? null,
        companyId,
        updatedAt: now,
      });
      await refreshPendingSyncCount();
    },
    [companyId, allOrders, refreshPendingSyncCount]
  );

  const updateDeliveryStatus = useCallback(
    async (orderId: string, status: "pending" | "delivered") => {
      const now = new Date().toISOString();
      const patch = { deliveryStatus: status, deliveryDeliveredAt: status === "delivered" ? now : undefined, updatedAt: now };
      const existing = allOrders.find((order) => order.id === orderId);
      setAllOrders((prev) => prev.map((o) => o.id !== orderId ? o : { ...o, ...patch, syncStatus: "pending" }));
      await persistOrderMutation(companyId, orderId, (order) => ({ ...order, ...patch }), existing, {
        deliveryStatus: status,
        deliveryDeliveredAt: status === "delivered" ? now : null,
        companyId,
        updatedAt: now,
      });
      await refreshPendingSyncCount();
    },
    [companyId, allOrders, refreshPendingSyncCount]
  );

  const assignDeliveryDriver = useCallback(
    async (orderId: string, driver: { name: string; employeeId: string }) => {
      const now = new Date().toISOString();
      const patch = { deliveryDriver: { ...driver, assignedAt: now }, updatedAt: now };
      const existing = allOrders.find((order) => order.id === orderId);
      setAllOrders((prev) => prev.map((o) => o.id !== orderId ? o : { ...o, ...patch, syncStatus: "pending" }));
      await persistOrderMutation(companyId, orderId, (order) => ({ ...order, ...patch }), existing, {
        deliveryDriver: { ...driver, assignedAt: now },
        companyId,
        updatedAt: now,
      });
      await refreshPendingSyncCount();
    },
    [companyId, allOrders, refreshPendingSyncCount]
  );

  const updateOrder = useCallback(
    async (
      id: string,
      patch: Partial<Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt">>
    ) => {
      const now = new Date().toISOString();
      const fullPatch = { ...patch, updatedAt: now };
      setAllOrders((prev) =>
        prev.map((o) => (o.id !== id ? o : { ...o, ...fullPatch, syncStatus: "pending" }))
      );
      const firestorePatch = Object.fromEntries(
        Object.entries({ ...fullPatch, companyId }).map(([key, value]) => [key, value === undefined ? null : value])
      );
      await persistOrderMutation(
        companyId,
        id,
        (order) => ({ ...order, ...fullPatch }),
        allOrders.find((order) => order.id === id),
        firestorePatch
      );
      await refreshPendingSyncCount();
    },
    [companyId, allOrders, refreshPendingSyncCount]
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
    if (!isOnline) throw new Error("PURGE_REQUIRES_CONNECTION");

    const snap = await getDocs(query(ordersCollection()));
    const BATCH_SIZE = 500;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    try {
      await deleteDoc(doc(db, "companies", companyId, "counters", "orders"));
    } catch (_) {}
    setAllOrders([]);
    await mutateLocalOrders(companyId, () => []);
    await AsyncStorage.removeItem(orderOutboxKey(companyId));
    setPendingSyncCount(0);
  }, [companyId, isOnline, ordersCollection]);

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
        pendingSyncCount,
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
