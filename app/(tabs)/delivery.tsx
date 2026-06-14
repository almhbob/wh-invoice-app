import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Order, useOrders } from "@/context/OrdersContext";
import { fmtDate } from "@/utils/dateUtils";

// ── Types & constants ─────────────────────────────────────────────────────────

type Urgency = "overdue" | "urgent" | "soon" | "ok" | "none";
type TabKey = "all" | "pending" | "unassigned" | "done";
type SortKey = "time" | "date";

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "#dc2626",
  urgent: "#ea580c",
  soon: Colors.gold,
  ok: "#16a34a",
  none: Colors.textMuted,
};
// URGENCY_LABEL is built inside components using t() — see useUrgencyLabel()
const URGENCY_LABEL_KEYS: Record<Urgency, string | null> = {
  overdue: "delOverdue",
  urgent: "delUrgent",
  soon: "delSoon",
  ok: null,
  none: null,
};
const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0, urgent: 1, soon: 2, ok: 3, none: 4,
};
const DEPT_COLORS: Record<string, string> = {
  cake: Colors.cake,
  halwa: Colors.halwa,
  chocolate: Colors.chocolate,
  mawali: Colors.mawali,
  packaging: Colors.packaging,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}
function isDelivered(o: Order) { return o.deliveryStatus === "delivered"; }
function isUnassigned(o: Order) { return !o.deliveryDriver?.employeeId && !isDelivered(o); }
function isToday(ds: string) { return ds?.slice(0, 10) === new Date().toISOString().slice(0, 10); }

function parseDeliveryDT(dt?: string): Date | null {
  if (!dt) return null;
  const full = dt.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (full) return new Date(`${full[1]}T${full[2]}:00`);
  const timeOnly = dt.match(/^(\d{2}:\d{2})$/);
  if (timeOnly) return new Date(`${new Date().toISOString().slice(0, 10)}T${timeOnly[1]}:00`);
  return null;
}

function isReadyForDelivery(o: Order) {
  if (isDelivered(o)) return false;
  const depts = [...new Set(o.items.map((i) => i.department))];
  if (!depts.length) return false;
  return depts.every((d) => o.departmentStatuses?.[d] === "done");
}

function getUrgency(o: Order): Urgency {
  if (isDelivered(o)) return "none";
  const dt = parseDeliveryDT(o.deliveryTime);
  if (!dt) return "none";
  const diff = dt.getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 60 * 60 * 1000) return "urgent";
  if (diff < 2 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function openMaps(address: string) {
  const enc = encodeURIComponent(address);
  Linking.openURL(`https://maps.google.com/?q=${enc}`).catch(() =>
    Linking.openURL(`geo:0,0?q=${enc}`)
  );
}
function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);
}
function openWhatsApp(phone: string, message?: string) {
  const raw = phone.replace(/\D/g, "");
  const intl = raw.startsWith("0") ? "966" + raw.slice(1) : raw;
  const text = message ? `&text=${encodeURIComponent(message)}` : "";
  Linking.openURL(`whatsapp://send?phone=${intl}${text}`).catch(() =>
    Linking.openURL(`https://wa.me/${intl}${message ? `?text=${encodeURIComponent(message)}` : ""}`)
  );
}

// ── Dept Readiness Dots ───────────────────────────────────────────────────────

function DeptDots({ order }: { order: Order }) {
  const depts = [...new Set(order.items.map((i) => i.department))].filter(Boolean);
  if (!depts.length) return null;
  return (
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
      {depts.map((dept) => {
        const done = order.departmentStatuses?.[dept] === "done";
        const color = DEPT_COLORS[dept] ?? Colors.textMuted;
        return (
          <View
            key={dept}
            style={{
              width: 9, height: 9, borderRadius: 5,
              backgroundColor: done ? color : "transparent",
              borderWidth: 1.5, borderColor: color,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Stats Header ──────────────────────────────────────────────────────────────

function StatsHeader({ orders }: { orders: Order[] }) {
  const { t } = useLang();
  const pendingCount = orders.filter((o) => !isDelivered(o)).length;
  const deliveredCount = orders.filter((o) => isDelivered(o)).length;
  const unassignedCount = orders.filter(isUnassigned).length;
  const readyCount = orders.filter(isReadyForDelivery).length;
  const overdueCount = orders.filter((o) => getUrgency(o) === "overdue").length;
  const revenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const pct = orders.length > 0 ? Math.round((deliveredCount / orders.length) * 100) : 0;

  return (
    <View style={styles.statsWrap}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Feather name="truck" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>{t("delManageTitle")}</Text>
          <Text style={styles.screenSub}>{orders.length} {t("delOrdersCount")}</Text>
        </View>
        {overdueCount > 0 && (
          <View style={styles.alertBadge}>
            <Feather name="alert-circle" size={11} color="#fff" />
            <Text style={styles.alertBadgeText}>{overdueCount} {t("delOverdue")}</Text>
          </View>
        )}
      </View>

      {/* 4 stat cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: Colors.gold + "80" }]}>
          <Text style={[styles.statNum, { color: Colors.gold }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>{t("delInProgress")}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#16a34a60" }]}>
          <Text style={[styles.statNum, { color: "#16a34a" }]}>{deliveredCount}</Text>
          <Text style={styles.statLabel}>{t("delDelivered")}</Text>
        </View>
        <View style={[styles.statCard, {
          borderColor: unassignedCount > 0 ? "#ea580c60" : Colors.border,
        }]}>
          <Text style={[styles.statNum, { color: unassignedCount > 0 ? "#ea580c" : Colors.textMuted }]}>
            {unassignedCount}
          </Text>
          <Text style={styles.statLabel}>{t("delNoDriverTab")}</Text>
        </View>
        <View style={[styles.statCard, {
          borderColor: readyCount > 0 ? "#7c3aed60" : Colors.border,
        }]}>
          <Text style={[styles.statNum, { color: readyCount > 0 ? "#7c3aed" : Colors.textMuted }]}>
            {readyCount}
          </Text>
          <Text style={styles.statLabel}>{t("delReadyLabel")}</Text>
        </View>
      </View>

      {/* Revenue + completion bar */}
      <View style={styles.statsRow2}>
        <View style={styles.revenueCard}>
          <Feather name="dollar-sign" size={14} color={Colors.success} />
          <Text style={styles.revenueLabel}>{t("delAllTotal")}</Text>
          <Text style={styles.revenueValue}>{fmtCurrency(revenue)}</Text>
        </View>
        <View style={styles.completionCard}>
          <View style={styles.completionTop}>
            <Text style={styles.completionLabel}>{t("delCompletionRate")}</Text>
            <Text style={styles.completionPct}>{pct}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Driver Chips (filter by driver) ──────────────────────────────────────────

interface DriverInfo {
  id: string;
  name: string;
  pendingCount: number;
  readyCount: number;
}

function DriverChips({
  orders,
  selectedDriver,
  onSelect,
}: {
  orders: Order[];
  selectedDriver: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useLang();
  const drivers: DriverInfo[] = useMemo(() => {
    const map = new Map<string, DriverInfo>();
    orders.forEach((o) => {
      if (!o.deliveryDriver?.employeeId || isDelivered(o)) return;
      const id = o.deliveryDriver.employeeId;
      const prev = map.get(id) ?? { id, name: o.deliveryDriver.name, pendingCount: 0, readyCount: 0 };
      map.set(id, {
        ...prev,
        pendingCount: prev.pendingCount + 1,
        readyCount: prev.readyCount + (isReadyForDelivery(o) ? 1 : 0),
      });
    });
    return [...map.values()];
  }, [orders]);

  if (!drivers.length) return null;

  return (
    <View style={styles.chipsWrap}>
      <Text style={styles.chipsLabel}>{t("delActiveDrivers")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        <TouchableOpacity
          style={[styles.driverChip, !selectedDriver && styles.driverChipActive]}
          onPress={() => { Haptics.selectionAsync(); onSelect(null); }}
          activeOpacity={0.8}
        >
          <Feather name="users" size={13} color={!selectedDriver ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.driverChipText, !selectedDriver && styles.driverChipTextActive]}>
            {t("delAllFilter")}
          </Text>
        </TouchableOpacity>

        {drivers.map((d) => {
          const active = selectedDriver === d.id;
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.driverChip, active && styles.driverChipActive]}
              onPress={() => { Haptics.selectionAsync(); onSelect(active ? null : d.id); }}
              activeOpacity={0.8}
            >
              <View style={[styles.chipAvatar, active && styles.chipAvatarActive]}>
                <Text style={[styles.chipAvatarText, active && { color: Colors.primary }]}>
                  {d.name.charAt(0)}
                </Text>
              </View>
              <Text style={[styles.driverChipText, active && styles.driverChipTextActive]}>
                {d.name}
              </Text>
              <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                <Text style={[styles.chipBadgeText, active && { color: "#fff" }]}>
                  {d.pendingCount}
                </Text>
              </View>
              {d.readyCount > 0 && (
                <View style={[styles.chipReadyDot, active && { backgroundColor: "#7c3aed" }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Driver Assignment Modal ───────────────────────────────────────────────────

function DriverModal({
  visible,
  orderId,
  orderNumber,
  currentDriver,
  allOrders,
  onClose,
  onAssign,
}: {
  visible: boolean;
  orderId: string;
  orderNumber?: number;
  currentDriver?: { name: string; employeeId: string };
  allOrders: Order[];
  onClose: () => void;
  onAssign: (id: string, driver: { name: string; employeeId: string }) => void;
}) {
  const { employees } = useEmployee();
  const { t } = useLang();
  const [search, setSearch] = useState("");

  const workload: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    allOrders.forEach((o) => {
      if (o.deliveryDriver?.employeeId && !isDelivered(o)) {
        const id = o.deliveryDriver.employeeId;
        m[id] = (m[id] ?? 0) + 1;
      }
    });
    return m;
  }, [allOrders]);

  const filteredEmployees = employees
    .filter((e) => e.status !== "suspended")
    .filter((e) =>
      search.trim()
        ? e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.employeeId.includes(search.trim())
        : true
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />

          {/* Modal header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}>
              <Feather name="truck" size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.modalTitle}>{t("delAssignTitle")}</Text>
              {orderNumber ? (
                <Text style={styles.modalSub}>#{orderNumber}</Text>
              ) : null}
            </View>
          </View>

          {/* Current driver */}
          {currentDriver?.employeeId ? (
            <View style={styles.currentDriverBox}>
              <View style={styles.currentDriverAvatar}>
                <Text style={styles.currentDriverAvatarText}>{currentDriver.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.currentDriverLabel}>{t("delCurrentDriver")}</Text>
                <Text style={styles.currentDriverName}>{currentDriver.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => { onAssign(orderId, { name: "", employeeId: "" }); onClose(); }}
              >
                <Feather name="user-x" size={13} color={Colors.accent} />
                <Text style={styles.removeBtnText}>{t("delRemoveDriver")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Search */}
          <View style={styles.searchRow}>
            <Feather name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t("delSearchDriver")}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Employee list */}
          <FlatList
            data={filteredEmployees}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ gap: 8, padding: 16 }}
            renderItem={({ item: emp }) => {
              const isCurrent = currentDriver?.employeeId === emp.employeeId;
              const load = workload[emp.employeeId] ?? 0;
              return (
                <TouchableOpacity
                  style={[styles.empRow, isCurrent && styles.empRowActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onAssign(orderId, { name: emp.name, employeeId: emp.employeeId });
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.empAvatar, isCurrent && { backgroundColor: Colors.primary }]}>
                    <Text style={[styles.empAvatarText, isCurrent && { color: "#fff" }]}>
                      {emp.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.empName, isCurrent && { color: Colors.primary }]}>
                      {emp.name}
                    </Text>
                    <Text style={styles.empId}>#{emp.employeeId}</Text>
                  </View>
                  {load > 0 && (
                    <View style={[styles.loadBadge, load >= 3 && styles.loadBadgeHeavy]}>
                      <Feather
                        name="package"
                        size={11}
                        color={load >= 3 ? "#ea580c" : Colors.textSecondary}
                      />
                      <Text style={[styles.loadBadgeText, load >= 3 && { color: "#ea580c" }]}>
                        {load}
                      </Text>
                    </View>
                  )}
                  {isCurrent && (
                    <Feather name="check-circle" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Delivery Card ─────────────────────────────────────────────────────────────

function DeliveryCard({
  order,
  lang,
  onMarkDelivered,
  onOpenDriverModal,
}: {
  order: Order;
  lang: string;
  onMarkDelivered: (id: string) => void;
  onOpenDriverModal: (order: Order) => void;
}) {
  const { t } = useLang();
  const delivered = isDelivered(order);
  const urgency = getUrgency(order);
  const urgencyColor = URGENCY_COLOR[urgency];
  const ready = isReadyForDelivery(order);
  const hasDriver = !!order.deliveryDriver?.employeeId;

  const accentColor = delivered
    ? "#16a34a"
    : ready
    ? "#7c3aed"
    : urgency !== "none"
    ? urgencyColor
    : Colors.gold;

  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      {/* ── Card header ── */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            {ready && !delivered && (
              <View style={[styles.badge, { backgroundColor: "#7c3aed12" }]}>
                <Feather name="check-circle" size={10} color="#7c3aed" />
                <Text style={[styles.badgeText, { color: "#7c3aed" }]}>{t("delReadyForDel")}</Text>
              </View>
            )}
            {!delivered && !ready && urgency !== "none" && (
              <View style={[styles.badge, { backgroundColor: urgencyColor + "18" }]}>
                <Text style={[styles.badgeText, { color: urgencyColor }]}>
                  {URGENCY_LABEL_KEYS[urgency] ? t(URGENCY_LABEL_KEYS[urgency] as any) : ""}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={styles.orderDate}>{fmtDate(order.createdAt, lang as any)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="package" size={10} color={Colors.textMuted} />
              <Text style={styles.smallMeta}>{itemCount} {t("chocoCardPcs")}</Text>
            </View>
            <DeptDots order={order} />
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: accentColor + "18" }]}>
          <Text style={[styles.statusPillText, { color: accentColor }]}>
            {delivered ? t("delDeliveredMark") : t("delPending")}
          </Text>
        </View>
      </View>

      {/* ── Customer row ── */}
      <View style={styles.customerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>{order.customerName}</Text>
          <Text style={styles.customerPhone}>{order.customerPhone}</Text>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: "#16a34a18" }]}
            onPress={() => { Haptics.selectionAsync(); callPhone(order.customerPhone); }}
          >
            <Feather name="phone" size={15} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: "#25D36618" }]}
            onPress={() => { Haptics.selectionAsync(); openWhatsApp(order.customerPhone); }}
          >
            <Feather name="message-circle" size={15} color="#25D366" />
          </TouchableOpacity>
          {order.customerPhone2 ? (
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: "#16a34a18" }]}
              onPress={() => { Haptics.selectionAsync(); callPhone(order.customerPhone2!); }}
            >
              <Feather name="phone-call" size={15} color="#16a34a" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Delivery address ── */}
      {order.deliveryAddress ? (
        <TouchableOpacity
          style={styles.addressRow}
          onPress={() => { Haptics.selectionAsync(); openMaps(order.deliveryAddress!); }}
          activeOpacity={0.8}
        >
          <Feather name="map-pin" size={14} color={Colors.mawali} />
          <Text style={styles.addressText} numberOfLines={2}>{order.deliveryAddress}</Text>
          <View style={styles.mapBtn}>
            <Feather name="navigation" size={11} color="#fff" />
            <Text style={styles.mapBtnText}>{t("delMapBtn")}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* ── Info chips: time + amount ── */}
      <View style={styles.infoChipsRow}>
        {order.deliveryTime ? (
          <View style={[styles.infoChip, { backgroundColor: (urgency !== "none" ? urgencyColor : Colors.gold) + "12" }]}>
            <Feather name="clock" size={12} color={urgency !== "none" ? urgencyColor : Colors.gold} />
            <Text style={[styles.infoChipText, { color: urgency !== "none" ? urgencyColor : Colors.gold }]}>
              {order.deliveryTime}
            </Text>
          </View>
        ) : null}
        <View style={[styles.infoChip, { backgroundColor: Colors.primary + "0E" }]}>
          <Feather name="dollar-sign" size={12} color={Colors.primary} />
          <Text style={[styles.infoChipText, { color: Colors.primary }]}>
            {order.totalAmount ? fmtCurrency(order.totalAmount) : "—"}
          </Text>
        </View>
        {order.amountPaid != null && order.amountPaid > 0 && order.amountPaid < (order.totalAmount ?? 0) && (
          <View style={[styles.infoChip, { backgroundColor: Colors.warning + "12" }]}>
            <Feather name="credit-card" size={12} color={Colors.warning} />
            <Text style={[styles.infoChipText, { color: Colors.warning }]}>
              {t("delPaidPartial")} {fmtCurrency(order.amountPaid)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Notes ── */}
      {order.notes ? (
        <View style={styles.notesBox}>
          <Feather name="file-text" size={12} color={Colors.textMuted} />
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      {/* ── Driver assignment row ── */}
      <TouchableOpacity
        style={[styles.driverRow, hasDriver && styles.driverRowFilled]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenDriverModal(order);
        }}
        activeOpacity={0.8}
      >
        {hasDriver ? (
          <>
            <View style={styles.driverMiniAvatar}>
              <Text style={styles.driverMiniAvatarText}>
                {order.deliveryDriver!.name.charAt(0)}
              </Text>
            </View>
            <Text style={styles.driverRowText}>
              <Text style={{ color: Colors.textMuted, fontWeight: "400" }}>{t("delDriverLabel")} </Text>
              <Text style={{ fontWeight: "800", color: Colors.primary }}>
                {order.deliveryDriver!.name}
              </Text>
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.driverMiniAvatar, styles.driverMiniAvatarEmpty]}>
              <Feather name="user-plus" size={13} color={Colors.textMuted} />
            </View>
            <Text style={styles.driverUnassignedText}>{t("delAssignDriverHint")}</Text>
          </>
        )}
        <Feather name="chevron-left" size={14} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* ── WhatsApp ready notification ── */}
      {!delivered && ready && (
        <TouchableOpacity
          style={styles.waReadyBtn}
          onPress={() => {
            Haptics.selectionAsync();
            openWhatsApp(
              order.customerPhone,
              `أهلاً ${order.customerName}، طلبك رقم #${order.orderNumber} جاهز وفي طريقه إليك! 🎉`
            );
          }}
          activeOpacity={0.8}
        >
          <Feather name="message-circle" size={15} color="#fff" />
          <Text style={styles.waReadyBtnText}>{t("delWaReadyBtn")} 🎉</Text>
        </TouchableOpacity>
      )}

      {/* ── Mark as delivered ── */}
      {!delivered && (
        <TouchableOpacity
          style={styles.deliverBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onMarkDelivered(order.id);
          }}
          activeOpacity={0.8}
        >
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={styles.deliverBtnText}>{t("markDelivered")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DeliveryScreen() {
  const { t, lang } = useLang();
  const { orders, updateDeliveryStatus, assignDeliveryDriver } = useOrders();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<TabKey>("all");
  const [sort, setSort] = useState<SortKey>("time");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [driverModalOrder, setDriverModalOrder] = useState<Order | null>(null);

  const deliveryOrders = useMemo(
    () => orders.filter((o) => o.orderType === "delivery"),
    [orders]
  );

  const tabCounts = useMemo(
    () => ({
      all: deliveryOrders.length,
      pending: deliveryOrders.filter((o) => !isDelivered(o)).length,
      unassigned: deliveryOrders.filter(isUnassigned).length,
      done: deliveryOrders.filter(isDelivered).length,
    }),
    [deliveryOrders]
  );

  const filtered = useMemo(() => {
    let base = deliveryOrders;
    if (tab === "pending") base = base.filter((o) => !isDelivered(o));
    if (tab === "done") base = base.filter((o) => isDelivered(o));
    if (tab === "unassigned") base = base.filter(isUnassigned);
    if (selectedDriver) base = base.filter((o) => o.deliveryDriver?.employeeId === selectedDriver);

    if (sort === "time") {
      return [...base].sort((a, b) => {
        const ua = getUrgency(a), ub = getUrgency(b);
        if (URGENCY_RANK[ua] !== URGENCY_RANK[ub]) return URGENCY_RANK[ua] - URGENCY_RANK[ub];
        const da = parseDeliveryDT(a.deliveryTime), db = parseDeliveryDT(b.deliveryTime);
        if (da && db) return da.getTime() - db.getTime();
        if (da) return -1;
        if (db) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return [...base].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [deliveryOrders, tab, sort, selectedDriver]);

  const TABS: { key: TabKey; label: string; alert?: boolean }[] = [
    { key: "all",        label: t("delAllFilter") },
    { key: "pending",    label: t("delInProgress") },
    { key: "unassigned", label: t("delNoDriverTab"), alert: true },
    { key: "done",       label: t("delDelivered") },
  ];

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: insets.bottom + 100,
          gap: 10,
          paddingTop: 4,
        }}
        ListHeaderComponent={
          <>
            {/* Stats + title */}
            <StatsHeader orders={deliveryOrders} />

            {/* Driver filter chips */}
            <DriverChips
              orders={deliveryOrders}
              selectedDriver={selectedDriver}
              onSelect={setSelectedDriver}
            />

            {/* Tabs + sort */}
            <View style={styles.controlBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabRow}
              >
                {TABS.map(({ key, label, alert }) => {
                  const isActive = tab === key;
                  const count = tabCounts[key];
                  const hasAlert = alert && count > 0 && !isActive;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.tabBtn,
                        isActive && styles.tabBtnActive,
                        hasAlert && styles.tabBtnAlert,
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setTab(key); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.tabText,
                        isActive && styles.tabTextActive,
                        hasAlert && styles.tabTextAlert,
                      ]}>
                        {label}
                      </Text>
                      {count > 0 && (
                        <View style={[
                          styles.tabBadge,
                          isActive && styles.tabBadgeActive,
                          hasAlert && styles.tabBadgeAlert,
                        ]}>
                          <Text style={[
                            styles.tabBadgeText,
                            (isActive || hasAlert) && { color: "#fff" },
                          ]}>
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Sort toggle */}
              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => { Haptics.selectionAsync(); setSort((s) => s === "time" ? "date" : "time"); }}
              >
                <Feather
                  name={sort === "time" ? "clock" : "calendar"}
                  size={14}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="truck" size={32} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {tab === "unassigned" ? t("delAllAssigned") : t("delNoOrders")}
            </Text>
            <Text style={styles.emptyHint}>
              {tab === "unassigned" ? t("delNoUnassigned") : t("delNoOrders")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <DeliveryCard
            order={item}
            lang={lang}
            onMarkDelivered={(id) => updateDeliveryStatus(id, "delivered")}
            onOpenDriverModal={setDriverModalOrder}
          />
        )}
      />

      <DriverModal
        visible={driverModalOrder !== null}
        orderId={driverModalOrder?.id ?? ""}
        orderNumber={driverModalOrder?.orderNumber}
        currentDriver={
          driverModalOrder?.deliveryDriver?.employeeId
            ? driverModalOrder.deliveryDriver
            : undefined
        }
        allOrders={deliveryOrders}
        onClose={() => setDriverModalOrder(null)}
        onAssign={assignDeliveryDriver}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ─ Stats Header ─
  statsWrap: { padding: 14, paddingBottom: 8, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleIcon: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  screenTitle: { fontSize: 18, fontWeight: "900", color: Colors.primary },
  screenSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  alertBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#dc2626", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: "#dc2626", shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  alertBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },

  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 10,
    alignItems: "center", borderWidth: 2,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statNum: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },

  statsRow2: { flexDirection: "row", gap: 8 },
  revenueCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.success + "40",
  },
  revenueLabel: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
  revenueValue: { fontSize: 13, fontWeight: "800", color: Colors.success },
  completionCard: {
    flex: 1.3, backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.primary + "30", gap: 6,
  },
  completionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  completionLabel: { fontSize: 11, color: Colors.textSecondary },
  completionPct: { fontSize: 14, fontWeight: "900", color: Colors.primary },
  progressBg: { height: 7, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 7, backgroundColor: Colors.primary, borderRadius: 4 },

  // ─ Driver chips ─
  chipsWrap: { paddingHorizontal: 14, paddingBottom: 8 },
  chipsLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "700", marginBottom: 7, textAlign: "right" },
  chipsScroll: { gap: 8, flexDirection: "row" },
  driverChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  driverChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center",
  },
  chipAvatarActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  chipAvatarText: { fontSize: 11, fontWeight: "900", color: Colors.primary },
  driverChipText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  driverChipTextActive: { color: "#fff" },
  chipBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: Colors.primary + "15",
  },
  chipBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  chipBadgeText: { fontSize: 11, fontWeight: "800", color: Colors.primary },
  chipReadyDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "#7c3aed",
    position: "absolute", top: 0, right: 0,
  },

  // ─ Controls ─
  controlBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 8, gap: 6,
  },
  tabRow: { gap: 6, flexDirection: "row" },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnAlert: { borderColor: "#ea580c50", backgroundColor: "#ea580c0A" },
  tabText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  tabTextAlert: { color: "#ea580c", fontWeight: "700" },
  tabBadge: {
    minWidth: 20, height: 18, borderRadius: 9,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabBadgeAlert: { backgroundColor: "#ea580c" },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: Colors.textSecondary },
  sortBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.primary + "12",
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },

  // ─ Card ─
  card: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10,
  },
  orderNum: { fontSize: 16, fontWeight: "900", color: Colors.primary },
  orderDate: { fontSize: 11, color: Colors.textMuted },
  smallMeta: { fontSize: 11, color: Colors.textMuted },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: "700" },

  // ─ Customer ─
  customerRow: {
    flexDirection: "row", alignItems: "center",
    paddingBottom: 10, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  customerName: { fontSize: 15, fontWeight: "800", color: Colors.text },
  customerPhone: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  quickActions: { flexDirection: "row", gap: 8 },
  quickBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  // ─ Address ─
  addressRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.mawali + "0E", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8,
  },
  addressText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },
  mapBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.mawali, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  mapBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  // ─ Info chips ─
  infoChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 8 },
  infoChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  infoChipText: { fontSize: 12, fontWeight: "700" },

  // ─ Notes ─
  notesBox: {
    flexDirection: "row", gap: 6, marginBottom: 8, padding: 8,
    backgroundColor: Colors.background, borderRadius: 8, alignItems: "flex-start",
  },
  notesText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // ─ Driver row ─
  driverRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  driverRowFilled: { borderColor: Colors.primary + "40", backgroundColor: Colors.primary + "06" },
  driverMiniAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  driverMiniAvatarEmpty: { backgroundColor: Colors.border },
  driverMiniAvatarText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  driverRowText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  driverUnassignedText: { flex: 1, fontSize: 13, color: Colors.textMuted, fontStyle: "italic" },

  // ─ WA ready + deliver ─
  waReadyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 10, paddingVertical: 11, borderRadius: 12,
    backgroundColor: "#25D366",
    shadowColor: "#25D366", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  waReadyBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  deliverBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 10, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "#16a34a",
    shadowColor: "#16a34a", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  deliverBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // ─ Empty state ─
  emptyState: { alignItems: "center", paddingTop: 48, gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.textSecondary },
  emptyHint: { fontSize: 13, color: Colors.textMuted },

  // ─ Driver Modal ─
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: "74%", paddingBottom: 30,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2,
    alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalHeaderIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: Colors.primary },
  modalSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  currentDriverBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: Colors.primary + "08", borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  currentDriverAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  currentDriverAvatarText: { fontSize: 16, fontWeight: "900", color: "#fff" },
  currentDriverLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  currentDriverName: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  removeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.accent + "12",
  },
  removeBtnText: { fontSize: 12, color: Colors.accent, fontWeight: "700" },

  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  empRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 14, backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  empRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  empAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
  empAvatarText: { fontSize: 17, fontWeight: "800", color: Colors.textSecondary },
  empName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  empId: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  loadBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1, borderColor: Colors.border,
  },
  loadBadgeHeavy: { backgroundColor: "#ea580c12", borderColor: "#ea580c30" },
  loadBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
});
