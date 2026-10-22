import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  arrayUnion,
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
import { Alert } from "react-native";
import { t as t_ } from "@/constants/translations";
import { uploadUriToFirebaseStorage } from "@/lib/uploadFiles";
import { isProductionDone, newTrackingCode, OrderEvent } from "@/utils/orderFlow";

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

export type WritingSurface = "cream" | "jelly" | "jelly_on_sugar" | "sugar_print" | "card" | "other";

/** Text the calligrapher writes on/with an item. */
export interface CakeWriting {
  text: string;
  surface: WritingSurface;
  /** Free description when surface is "other". */
  surfaceOther?: string;
  color?: string;
  note?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  department: Department;
  note?: string;
  details?: string;
  writing?: CakeWriting;
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
  deliveryStatus?: DeliveryStatus;
  deliveryDeliveredAt?: string;
  deliveryDriver?: { name: string; employeeId: string; phone?: string; assignedAt?: string };
  dispatchedAt?: string;
  deliveryFailedReason?: string;
  deliveredTo?: string;
  pickedUpAt?: string;
  pickedUpBy?: { name: string; employeeId: string };
  /** Random code used by the public tracking link. */
  trackingCode?: string;
  /** Lifecycle log (see utils/orderFlow). */
  events?: OrderEvent[];
  driverRequest?: DriverRequest;
  /** Where the order came from; online orders were accepted from the customer link. */
  source?: OrderSource;
  onlineOrderId?: string;
  /** Calligraphy progress for items that carry a writing request. */
  writingStatus?: OrderStatus;
  writingBy?: EmployeeRef;
  /** Client-only: not yet saved to the server. Never written to Firestore. */
  syncState?: "pending" | "failed";
}

export type DriverRequestType = "support" | "transfer";

/** A driver asking the branch for help or to hand the delivery to another driver. */
export interface DriverRequest {
  type: DriverRequestType;
  reason: string;
  note?: string;
  at: string;
  by: ActorRef;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolvedBy?: ActorRef;
  response?: string;
}

export type OrderSource = "branch" | "online";

export type DeliveryStatus = "pending" | "assigned" | "out_for_delivery" | "delivered" | "failed";
export type ActorRef = { name: string; employeeId: string };

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
  transferToBranch: (orderId: string, transfer: BranchTransfer) => Promise<void>;
  deleteOrder: (id: string, deletedBy?: ActorRef) => Promise<void>;
  restoreOrder: (id: string) => Promise<void>;
  markTrayReturned: (orderId: string, employee?: ActorRef) => Promise<void>;
  /** Back-compat: "delivered" marks delivered, "pending" re-opens. */
  updateDeliveryStatus: (orderId: string, status: "pending" | "delivered") => Promise<void>;
  assignDeliveryDriver: (orderId: string, driver: { name: string; employeeId: string; phone?: string }, by?: ActorRef) => Promise<void>;
  dispatchOrder: (orderId: string, by?: ActorRef) => Promise<void>;
  markDelivered: (orderId: string, by?: ActorRef, deliveredTo?: string) => Promise<void>;
  markDeliveryFailed: (orderId: string, reason: string, by?: ActorRef) => Promise<void>;
  markPickedUp: (orderId: string, by?: ActorRef) => Promise<void>;
  ensureTrackingCode: (orderId: string) => Promise<string | null>;
  updateWritingStatus: (orderId: string, status: OrderStatus, by?: EmployeeRef) => Promise<void>;
  raiseDriverRequest: (orderId: string, type: DriverRequestType, reason: string, note: string | undefined, by: ActorRef) => Promise<void>;
  resolveDriverRequest: (orderId: string, by: ActorRef, response?: string) => Promise<void>;
  updateOrder: (id: string, patch: Partial<Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt">>) => Promise<void>;
  getOrdersForDepartment: (department: Department) => Order[];
  refreshOrders: () => void;
  purgeAllOrders: () => Promise<void>;
  /** Orders saved on this device but not yet on the server. */
  pendingSyncCount: number;
  retrySync: () => void;
  isLoading: boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const LOCAL_COUNTER_KEY = "@order_counter_v4_fallback";
const LOCAL_ORDERS_KEY = "@orders_local_v2";
const OUTBOX_KEY = "@orders_outbox_v1";
const SYNC_INTERVAL_MS = 15000;

const localOrdersKey = (companyId: string) => `${LOCAL_ORDERS_KEY}_${companyId}`;
const outboxKey = (companyId: string) => `${OUTBOX_KEY}_${companyId}`;

/** Firestore rejects `undefined` anywhere (even inside arrays/maps) — strip it recursively. */
export function deepClean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => deepClean(v)).filter((v) => v !== undefined) as unknown as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = deepClean(v);
    }
    return out as T;
  }
  return value;
}

/** Firestore-compatible random document id, generated on the device so retries are idempotent. */
function newDocId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(20);
  (globalThis.crypto ?? { getRandomValues: (a: Uint8Array) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / unavailable */ }
}

/** Fields that only exist on the device. */
function toServer(order: Order): Record<string, unknown> {
  const { id: _id, syncState: _s, ...rest } = order;
  return deepClean(rest as Record<string, unknown>);
}

const isRemoteUri = (uri?: string) => !!uri && /^https?:\/\//.test(uri);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { companyId, company } = useCompany();
  const [serverOrders, setServerOrders] = useState<Order[]>([]);
  const [outbox, setOutbox] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [syncTick, setSyncTick] = useState(0);
  const outboxRef = useRef<Order[]>([]);
  const serverRef = useRef<Order[]>([]);
  const syncing = useRef(false);

  outboxRef.current = outbox;
  serverRef.current = serverOrders;

  // Outbox entries first (newest), then server orders; an order is never shown twice.
  const allOrders = React.useMemo(() => {
    const pendingIds = new Set(outbox.map((o) => o.id));
    return [...outbox, ...serverOrders.filter((o) => !pendingIds.has(o.id))];
  }, [outbox, serverOrders]);

  const orders = React.useMemo(() => allOrders.filter((o) => !o.deleted), [allOrders]);
  const deletedOrders = React.useMemo(() => allOrders.filter((o) => o.deleted), [allOrders]);

  const ordersCollection = useCallback(() => collection(db, "companies", companyId, "orders"), [companyId]);
  const orderDoc = useCallback((id: string) => doc(db, "companies", companyId, "orders", id), [companyId]);
  const counterDoc = useCallback(() => doc(db, "companies", companyId, "counters", "orders"), [companyId]);

  const saveOutbox = useCallback((next: Order[]) => {
    outboxRef.current = next;
    setOutbox(next);
    void writeJson(outboxKey(companyId), next);
  }, [companyId]);

  // Load cache + outbox, then subscribe to Firestore.
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setServerOrders([]);
    setOutbox([]);

    Promise.all([
      readJson<Order[]>(localOrdersKey(companyId), []),
      readJson<Order[]>(outboxKey(companyId), []),
    ]).then(([cached, pending]) => {
      if (!mounted) return;
      // Migrate orders saved by older versions with a "local-" id and never synced.
      const legacyLocal = cached.filter((o) => o.id.startsWith("local-"));
      const migrated = legacyLocal.map((o) => ({ ...o, id: newDocId(), syncState: "pending" as const }));
      const nextOutbox = [...pending, ...migrated];
      if (migrated.length) void writeJson(outboxKey(companyId), nextOutbox);
      outboxRef.current = nextOutbox;
      setOutbox(nextOutbox);
      setServerOrders((cur) => (cur.length ? cur : cached.filter((o) => !o.id.startsWith("local-"))));
      setIsLoading(false);
      setSyncTick((t) => t + 1);
    });

    const q = query(ordersCollection(), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!mounted) return;
        const loaded: Order[] = snapshot.docs.map((d) => ({ ...(d.data() as Omit<Order, "id">), id: d.id, companyId }));
        if (snapshot.metadata.fromCache) {
          // Offline/local view: merge over what we already show, never wipe the cache with it.
          setServerOrders((prev) => {
            const byId = new Map(prev.map((o) => [o.id, o]));
            loaded.forEach((o) => byId.set(o.id, o));
            return [...byId.values()].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
          });
        } else {
          setServerOrders(loaded);
          void writeJson(localOrdersKey(companyId), loaded);
        }
        setIsLoading(false);
        // Only writes the server has acknowledged may leave the outbox
        // (a pending local write is lost if the page is closed).
        const confirmed = new Set(snapshot.docs.filter((d) => !d.metadata.hasPendingWrites && !snapshot.metadata.fromCache).map((d) => d.id));
        if (outboxRef.current.some((o) => confirmed.has(o.id))) {
          saveOutbox(outboxRef.current.filter((o) => !confirmed.has(o.id)));
        }
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
  }, [companyId, ordersCollection, refreshTick, saveOutbox]);

  // ── Outbox sync ──────────────────────────────────────────────────────────────
  const flushOutbox = useCallback(async () => {
    if (syncing.current || outboxRef.current.length === 0) return;
    syncing.current = true;
    try {
      for (const pending of [...outboxRef.current]) {
        try {
          let order = pending;
          // Device-local images (blob:, file:, data:) are uploaded so every department can see them.
          // An image that cannot be uploaded while online is dropped rather than blocking the order.
          const upload = async (uri: string, name: string): Promise<string | undefined> => {
            if (isRemoteUri(uri)) return uri;
            try {
              // Stored under product-images/<company>/ — a path both the current and the secure rules allow.
              return (await uploadUriToFirebaseStorage({ uri, kind: "product-images", ownerId: companyId, fileName: name })).url;
            } catch (e) {
              if (navigatorOffline()) throw e;
              console.warn("Order image upload failed; sending order without it:", e);
              return undefined;
            }
          };
          if (order.imageUri && !isRemoteUri(order.imageUri)) {
            order = { ...order, imageUri: await upload(order.imageUri, `order-${order.orderNumber}`) };
          }
          if (order.referenceImages?.some((u) => !isRemoteUri(u))) {
            const urls: string[] = [];
            for (const [i, uri] of order.referenceImages.entries()) {
              const url = await upload(uri, `order-${order.orderNumber}-ref${i + 1}`);
              if (url) urls.push(url);
            }
            order = { ...order, referenceImages: urls };
          }
          if (order !== pending) {
            // Keep uploaded URLs so a retry does not upload the same images again.
            saveOutbox(outboxRef.current.map((o) => (o.id === order.id ? order : o)));
          }
          // setDoc with a client-generated id is idempotent: a retry can never create a duplicate.
          await Promise.race([
            setDoc(orderDoc(order.id), toServer(order)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
          ]);
          saveOutbox(outboxRef.current.filter((o) => o.id !== order.id));
          setServerOrders((cur) => (cur.some((o) => o.id === order.id) ? cur : [{ ...order, syncState: undefined }, ...cur]));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("Order sync failed, will retry:", msg);
          saveOutbox(outboxRef.current.map((o) => (o.id === pending.id ? { ...o, syncState: "failed" } : o)));
        }
      }
    } finally {
      syncing.current = false;
    }
  }, [companyId, orderDoc, saveOutbox]);

  useEffect(() => { void flushOutbox(); }, [syncTick, flushOutbox]);

  useEffect(() => {
    const id = setInterval(() => { if (outboxRef.current.length) void flushOutbox(); }, SYNC_INTERVAL_MS);
    const onOnline = () => void flushOutbox();
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("online", onOnline);
    };
  }, [flushOutbox]);

  const retrySync = useCallback(() => setSyncTick((t) => t + 1), []);

  const refreshOrders = useCallback(() => {
    setIsLoading(true);
    setRefreshTick((t) => t + 1);
    setSyncTick((t) => t + 1);
  }, []);

  // ── Generic patch: applies locally, to the outbox copy, or to Firestore ─────
  const patchOrder = useCallback(
    async (id: string, local: (o: Order) => Order, remote: (o: Order) => Record<string, unknown>) => {
      const inOutbox = outboxRef.current.find((o) => o.id === id);
      if (inOutbox) {
        // Not on the server yet: the full, updated order will be written by the next sync.
        saveOutbox(outboxRef.current.map((o) => (o.id === id ? local(o) : o)));
        setSyncTick((t) => t + 1);
        return;
      }
      const current = serverRef.current.find((o) => o.id === id);
      if (!current) return;
      setServerOrders((prev) => prev.map((o) => (o.id === id ? local(o) : o)));
      try {
        await updateDoc(orderDoc(id), deepClean({ ...remote(current), companyId, updatedAt: new Date().toISOString() }));
      } catch (err) {
        console.warn("Firestore order update failed:", (err as { code?: string })?.code ?? err);
        Alert.alert("تعذّر حفظ التحديث", "تحقق من الاتصال بالإنترنت ثم أعد المحاولة.");
        setServerOrders((prev) => prev.map((o) => (o.id === id ? current : o)));
        throw err;
      }
    },
    [companyId, orderDoc, saveOutbox]
  );

  const withEvent = (o: Order, ev: OrderEvent, extra: Partial<Order> = {}): Order => ({
    ...o,
    ...extra,
    events: [...(o.events ?? []), ev],
    updatedAt: ev.at,
  });

  const getNextOrderNumber = useCallback(async (): Promise<number> => {
    try {
      const counterRef = counterDoc();
      let next = 1;
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
      const known = Math.max(0, ...serverRef.current.map((o) => o.orderNumber || 0), ...outboxRef.current.map((o) => o.orderNumber || 0));
      const next = Math.max(stored ? parseInt(stored, 10) : 0, known) + 1;
      await AsyncStorage.setItem(key, next.toString());
      return next;
    }
  }, [companyId, counterDoc]);

  const addOrder = useCallback(
    async (
      orderData: Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt" | "updatedAt" | "departmentStatuses" | "departmentReceivers">
    ): Promise<Order> => {
      if (company.maxInvoicesPerMonth) {
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthCount = allOrders.filter((o) => !o.deleted && o.createdAt.startsWith(thisMonth)).length;
        if (monthCount >= company.maxInvoicesPerMonth) {
          const msg = t_("limitMaxInvMsg", "ar").replace("{n}", String(company.maxInvoicesPerMonth));
          Alert.alert(t_("limitMaxInvTitle", "ar"), msg);
          throw new Error("MAX_INVOICES_EXCEEDED");
        }
      }

      const orderNumber = await getNextOrderNumber();
      const now = new Date().toISOString();
      const depts = new Set(orderData.items.map((i) => i.department));
      depts.add("packaging");
      const departmentStatuses = {} as Record<Department, OrderStatus>;
      depts.forEach((d) => { departmentStatuses[d] = "pending"; });

      const newOrder: Order = deepClean({
        ...orderData,
        id: newDocId(),
        companyId,
        orderNumber,
        departmentStatuses,
        departmentReceivers: {},
        deliveryStatus: orderData.orderType === "delivery" ? "pending" : undefined,
        writingStatus: orderData.items.some((i) => i.writing?.text?.trim()) ? "pending" : undefined,
        trackingCode: orderData.trackingCode || newTrackingCode(),
        events: [
          ...(orderData.source === "online" ? [{ type: "online_received" as const, at: orderData.receivedAt && !isNaN(Date.parse(orderData.receivedAt)) ? new Date(orderData.receivedAt).toISOString() : now }] : []),
          { type: "created", at: now, by: orderData.cashierEmployee ? { name: orderData.cashierEmployee.name, employeeId: orderData.cashierEmployee.employeeId } : undefined },
        ],
        createdAt: now,
        updatedAt: now,
        syncState: "pending",
      }) as Order;

      saveOutbox([newOrder, ...outboxRef.current]);
      // Try to deliver immediately; the caller can await the result to show an honest status.
      await flushOutbox();
      const stillPending = outboxRef.current.find((o) => o.id === newOrder.id);
      return stillPending ?? { ...newOrder, syncState: undefined };
    },
    [allOrders, company.maxInvoicesPerMonth, companyId, flushOutbox, getNextOrderNumber, saveOutbox]
  );

  const updateDepartmentStatus = useCallback(
    async (id: string, department: Department, status: OrderStatus, receiver?: EmployeeRef) => {
      const now = new Date().toISOString();
      const by = receiver ? { name: receiver.name, employeeId: receiver.employeeId } : undefined;
      const apply = (o: Order): Order => {
        const receivers = { ...o.departmentReceivers };
        if (status === "in_progress" && receiver && !receivers[department]) receivers[department] = receiver;
        let next: Order = { ...o, departmentStatuses: { ...o.departmentStatuses, [department]: status }, departmentReceivers: receivers, updatedAt: now };
        if (status === "in_progress") next = withEvent(next, { type: "dept_started", at: now, dept: department, by });
        if (status === "done") {
          next = withEvent(next, { type: "dept_done", at: now, dept: department, by });
          if (!isProductionDone(o) && isProductionDone(next)) next = withEvent(next, { type: "ready", at: now });
        }
        return next;
      };
      await patchOrder(id, apply, (o) => {
        const next = apply(o);
        const added = (next.events ?? []).slice((o.events ?? []).length);
        return {
          [`departmentStatuses.${department}`]: status,
          departmentReceivers: next.departmentReceivers,
          ...(added.length ? { events: arrayUnion(...deepClean(added)) } : {}),
        };
      });
    },
    [patchOrder]
  );

  const transferToBranch = useCallback(
    async (orderId: string, transfer: BranchTransfer) => {
      const apply = (o: Order): Order => {
        const items = o.items.map((item) => (transfer.itemIds.includes(item.id) ? { ...item, department: transfer.toDept } : item));
        const statuses = { ...o.departmentStatuses };
        if (!statuses[transfer.toDept]) statuses[transfer.toDept] = "pending";
        return { ...o, items, departmentStatuses: statuses, branchTransfer: transfer, updatedAt: new Date().toISOString() };
      };
      await patchOrder(orderId, apply, (o) => {
        const n = apply(o);
        return { items: n.items, departmentStatuses: n.departmentStatuses, branchTransfer: transfer };
      });
    },
    [patchOrder]
  );

  const deleteOrder = useCallback(async (id: string, deletedBy?: ActorRef) => {
    const now = new Date().toISOString();
    const ev: OrderEvent = { type: "cancelled", at: now, by: deletedBy };
    await patchOrder(
      id,
      (o) => withEvent(o, ev, { deleted: true, deletedAt: now, deletedBy: deletedBy ?? null }),
      () => ({ deleted: true, deletedAt: now, deletedBy: deletedBy ?? null, events: arrayUnion(deepClean(ev)) })
    );
  }, [patchOrder]);

  const restoreOrder = useCallback(async (id: string) => {
    await patchOrder(
      id,
      (o) => ({ ...o, deleted: false, deletedAt: undefined, deletedBy: null, updatedAt: new Date().toISOString() }),
      () => ({ deleted: false, deletedAt: null, deletedBy: null })
    );
  }, [patchOrder]);

  const markTrayReturned = useCallback(async (orderId: string, employee?: ActorRef) => {
    const now = new Date().toISOString();
    await patchOrder(
      orderId,
      (o) => ({ ...o, trayReturned: true, trayReturnedAt: now, trayReturnedBy: employee, updatedAt: now }),
      () => ({ trayReturned: true, trayReturnedAt: now, trayReturnedBy: employee ?? null })
    );
  }, [patchOrder]);

  const assignDeliveryDriver = useCallback(
    async (orderId: string, driver: { name: string; employeeId: string; phone?: string }, by?: ActorRef) => {
      const now = new Date().toISOString();
      const removing = !driver.employeeId;
      const ev: OrderEvent = { type: "driver_assigned", at: now, by, note: driver.name };
      await patchOrder(
        orderId,
        (o) => removing
          ? { ...o, deliveryDriver: undefined, deliveryStatus: o.deliveryStatus === "out_for_delivery" ? o.deliveryStatus : "pending", updatedAt: now }
          : withEvent(o, ev, {
              deliveryDriver: { ...driver, assignedAt: now },
              deliveryStatus: o.deliveryStatus === "out_for_delivery" && o.deliveryDriver?.employeeId === driver.employeeId ? "out_for_delivery" : "assigned",
              driverRequest: o.driverRequest?.status === "open" ? { ...o.driverRequest, status: "resolved", resolvedAt: now, resolvedBy: by, response: `أُسند إلى ${driver.name}` } : o.driverRequest,
            }),
        (o) => removing
          ? { deliveryDriver: null, deliveryStatus: o.deliveryStatus === "out_for_delivery" ? o.deliveryStatus : "pending" }
          : {
              deliveryDriver: deepClean({ ...driver, assignedAt: now }),
              deliveryStatus: o.deliveryStatus === "out_for_delivery" && o.deliveryDriver?.employeeId === driver.employeeId ? "out_for_delivery" : "assigned",
              events: arrayUnion(deepClean(ev)),
              ...(o.driverRequest?.status === "open" ? { driverRequest: deepClean({ ...o.driverRequest, status: "resolved", resolvedAt: now, resolvedBy: by, response: `أُسند إلى ${driver.name}` }) } : {}),
            }
      );
    },
    [patchOrder]
  );

  const dispatchOrder = useCallback(async (orderId: string, by?: ActorRef) => {
    const now = new Date().toISOString();
    const ev: OrderEvent = { type: "dispatched", at: now, by };
    await patchOrder(
      orderId,
      (o) => withEvent(o, ev, { deliveryStatus: "out_for_delivery", dispatchedAt: now, deliveryFailedReason: undefined }),
      () => ({ deliveryStatus: "out_for_delivery", dispatchedAt: now, deliveryFailedReason: null, events: arrayUnion(deepClean(ev)) })
    );
  }, [patchOrder]);

  const markDelivered = useCallback(async (orderId: string, by?: ActorRef, deliveredTo?: string) => {
    const now = new Date().toISOString();
    const ev: OrderEvent = { type: "delivered", at: now, by, note: deliveredTo };
    await patchOrder(
      orderId,
      (o) => withEvent(o, ev, { deliveryStatus: "delivered", deliveryDeliveredAt: now, deliveredTo }),
      () => ({ deliveryStatus: "delivered", deliveryDeliveredAt: now, deliveredTo: deliveredTo ?? null, events: arrayUnion(deepClean(ev)) })
    );
  }, [patchOrder]);

  const markDeliveryFailed = useCallback(async (orderId: string, reason: string, by?: ActorRef) => {
    const now = new Date().toISOString();
    const ev: OrderEvent = { type: "delivery_failed", at: now, by, note: reason };
    await patchOrder(
      orderId,
      (o) => withEvent(o, ev, { deliveryStatus: "failed", deliveryFailedReason: reason }),
      () => ({ deliveryStatus: "failed", deliveryFailedReason: reason, events: arrayUnion(deepClean(ev)) })
    );
  }, [patchOrder]);

  const markPickedUp = useCallback(async (orderId: string, by?: ActorRef) => {
    const now = new Date().toISOString();
    const ev: OrderEvent = { type: "picked_up", at: now, by };
    await patchOrder(
      orderId,
      (o) => withEvent(o, ev, { pickedUpAt: now, pickedUpBy: by }),
      () => ({ pickedUpAt: now, pickedUpBy: by ?? null, events: arrayUnion(deepClean(ev)) })
    );
  }, [patchOrder]);

  const updateDeliveryStatus = useCallback(async (orderId: string, status: "pending" | "delivered") => {
    if (status === "delivered") return markDelivered(orderId);
    await patchOrder(
      orderId,
      (o) => ({ ...o, deliveryStatus: o.deliveryDriver ? "assigned" : "pending", deliveryDeliveredAt: undefined, updatedAt: new Date().toISOString() }),
      (o) => ({ deliveryStatus: o.deliveryDriver ? "assigned" : "pending", deliveryDeliveredAt: null })
    );
  }, [markDelivered, patchOrder]);

  const updateWritingStatus = useCallback(async (orderId: string, status: OrderStatus, by?: EmployeeRef) => {
    const now = new Date().toISOString();
    const actor = by ? { name: by.name, employeeId: by.employeeId } : undefined;
    const ev: OrderEvent | null = status === "in_progress" ? { type: "writing_started", at: now, by: actor } : status === "done" ? { type: "writing_done", at: now, by: actor } : null;
    const apply = (o: Order): Order => {
      let next: Order = { ...o, writingStatus: status, writingBy: status === "in_progress" && by ? by : o.writingBy, updatedAt: now };
      if (ev) next = withEvent(next, ev);
      if (status === "done" && !isProductionDone(o) && isProductionDone(next)) next = withEvent(next, { type: "ready", at: now });
      return next;
    };
    await patchOrder(orderId, apply, (o) => {
      const n = apply(o);
      const added = (n.events ?? []).slice((o.events ?? []).length);
      return { writingStatus: status, writingBy: n.writingBy ?? null, ...(added.length ? { events: arrayUnion(...deepClean(added)) } : {}) };
    });
  }, [patchOrder]);

  const raiseDriverRequest = useCallback(async (orderId: string, type: DriverRequestType, reason: string, note: string | undefined, by: ActorRef) => {
    const now = new Date().toISOString();
    const req: DriverRequest = deepClean({ type, reason, note: note?.trim() || undefined, at: now, by, status: "open" as const });
    const ev: OrderEvent = { type: type === "transfer" ? "transfer_requested" : "support_requested", at: now, by, note: [reason, note?.trim()].filter(Boolean).join(" — ") };
    await patchOrder(
      orderId,
      (o) => withEvent(o, ev, { driverRequest: req }),
      () => ({ driverRequest: req, events: arrayUnion(deepClean(ev)) })
    );
  }, [patchOrder]);

  const resolveDriverRequest = useCallback(async (orderId: string, by: ActorRef, response?: string) => {
    const now = new Date().toISOString();
    const ev: OrderEvent = { type: "request_resolved", at: now, by, note: response?.trim() || undefined };
    await patchOrder(
      orderId,
      (o) => o.driverRequest ? withEvent(o, ev, { driverRequest: { ...o.driverRequest, status: "resolved", resolvedAt: now, resolvedBy: by, response: response?.trim() || undefined } }) : o,
      (o) => o.driverRequest
        ? { driverRequest: deepClean({ ...o.driverRequest, status: "resolved", resolvedAt: now, resolvedBy: by, response: response?.trim() || undefined }), events: arrayUnion(deepClean(ev)) }
        : {}
    );
  }, [patchOrder]);

  const ensureTrackingCode = useCallback(async (orderId: string) => {
    const o = [...outboxRef.current, ...serverRef.current].find((x) => x.id === orderId);
    if (!o) return null;
    if (o.trackingCode) return o.trackingCode;
    const code = newTrackingCode();
    await patchOrder(orderId, (x) => ({ ...x, trackingCode: code }), () => ({ trackingCode: code }));
    return code;
  }, [patchOrder]);

  const updateOrder = useCallback(
    async (id: string, patch: Partial<Omit<Order, "id" | "companyId" | "orderNumber" | "createdAt">>) => {
      const now = new Date().toISOString();
      await patchOrder(id, (o) => ({ ...o, ...patch, updatedAt: now }), () => ({ ...patch }));
    },
    [patchOrder]
  );

  const getOrdersForDepartment = useCallback(
    (department: Department) =>
      orders
        .filter((o) => {
          const status = o.departmentStatuses?.[department];
          if (!status || status === "cancelled") return false;
          if (department === "packaging") return true;
          return o.items.some((i) => i.department === department);
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const purgeAllOrders = useCallback(async () => {
    try {
      const snap = await getDocs(query(ordersCollection()));
      const BATCH_SIZE = 500;
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn("Firestore purge failed:", err);
    }
    try { await deleteDoc(doc(db, "companies", companyId, "counters", "orders")); } catch { /* ignore */ }
    setServerOrders([]);
    saveOutbox([]);
    await writeJson(localOrdersKey(companyId), []);
  }, [companyId, ordersCollection, saveOutbox]);

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
        dispatchOrder,
        markDelivered,
        markDeliveryFailed,
        markPickedUp,
        ensureTrackingCode,
        updateWritingStatus,
        raiseDriverRequest,
        resolveDriverRequest,
        updateOrder,
        getOrdersForDepartment,
        refreshOrders,
        purgeAllOrders,
        pendingSyncCount: outbox.length,
        retrySync,
        isLoading,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

function navigatorOffline() {
  return typeof navigator !== "undefined" && (navigator as { onLine?: boolean }).onLine === false;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used inside OrdersProvider");
  return ctx;
}
