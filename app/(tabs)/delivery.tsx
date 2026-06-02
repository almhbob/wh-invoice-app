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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return (
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س"
  );
}

function isDelivered(order: Order): boolean {
  return order.deliveryStatus === "delivered";
}

function isToday(dateStr: string): boolean {
  return dateStr?.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

// Parse "YYYY-MM-DD HH:MM" or "HH:MM"
function parseDeliveryDT(dt?: string): Date | null {
  if (!dt) return null;
  const full = dt.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (full) return new Date(`${full[1]}T${full[2]}:00`);
  const timeOnly = dt.match(/^(\d{2}:\d{2})$/);
  if (timeOnly) {
    return new Date(`${new Date().toISOString().slice(0, 10)}T${timeOnly[1]}:00`);
  }
  return null;
}

// An order is "ready for delivery" when all item departments are "done"
function isReadyForDelivery(order: Order): boolean {
  if (isDelivered(order)) return false;
  const depts = [...new Set(order.items.map((i) => i.department))];
  if (depts.length === 0) return false;
  return depts.every((d) => order.departmentStatuses[d] === "done");
}

type Urgency = "overdue" | "urgent" | "soon" | "ok" | "none";

function getUrgency(order: Order): Urgency {
  if (isDelivered(order)) return "none";
  const dt = parseDeliveryDT(order.deliveryTime);
  if (!dt) return "none";
  const diff = dt.getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 60 * 60 * 1000) return "urgent";
  if (diff < 2 * 60 * 60 * 1000) return "soon";
  return "ok";
}

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "#dc2626",
  urgent: "#ea580c",
  soon: Colors.gold,
  ok: "#16a34a",
  none: Colors.textMuted,
};

// URGENCY_LABEL moved inside DeliveryCard to use translations

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0, urgent: 1, soon: 2, ok: 3, none: 4,
};

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  Linking.openURL(`https://maps.google.com/?q=${encoded}`).catch(() =>
    Linking.openURL(`geo:0,0?q=${encoded}`)
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

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ deliveryOrders }: { deliveryOrders: Order[] }) {
  const { t } = useLang();
  const pendingCount = deliveryOrders.filter((o) => !isDelivered(o)).length;
  const deliveredCount = deliveryOrders.filter((o) => isDelivered(o)).length;
  const todayCount = deliveryOrders.filter((o) => isToday(o.createdAt)).length;
  const totalRevenue = deliveryOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const overdueCount = deliveryOrders.filter((o) => getUrgency(o) === "overdue").length;
  const completionPct =
    deliveryOrders.length > 0 ? Math.round((deliveredCount / deliveryOrders.length) * 100) : 0;

  return (
    <View style={styles.statsWrap}>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: Colors.gold }]}>
          <Text style={[styles.statNum, { color: Colors.gold }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>{t("delPending")}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#16a34a" }]}>
          <Text style={[styles.statNum, { color: "#16a34a" }]}>{deliveredCount}</Text>
          <Text style={styles.statLabel}>{t("delDelivered")}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.primary }]}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{todayCount}</Text>
          <Text style={styles.statLabel}>{t("delTodayCount")}</Text>
        </View>
        {overdueCount > 0 ? (
          <View style={[styles.statCard, { borderColor: "#dc2626" }]}>
            <Text style={[styles.statNum, { color: "#dc2626" }]}>{overdueCount}</Text>
            <Text style={styles.statLabel}>{t("delOverdue")}</Text>
          </View>
        ) : (
          <View style={[styles.statCard, { borderColor: Colors.border }]}>
            <Text style={[styles.statNum, { color: Colors.textMuted }]}>{deliveryOrders.length}</Text>
            <Text style={styles.statLabel}>{t("delAllTotal")}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow2}>
        <View style={styles.revenueCard}>
          <Feather name="dollar-sign" size={14} color={Colors.success} />
          <Text style={styles.revenueLabel}>{t("delRevenue")}</Text>
          <Text style={styles.revenueValue}>{fmtCurrency(totalRevenue)}</Text>
        </View>
        <View style={styles.completionCard}>
          <View style={styles.completionTop}>
            <Text style={styles.completionLabel}>{t("delCompletionRate")}</Text>
            <Text style={styles.completionPct}>{completionPct}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${completionPct}%` as any }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Driver Assignment Modal ───────────────────────────────────────────────────

function DriverModal({
  visible,
  orderId,
  currentDriver,
  onClose,
  onAssign,
}: {
  visible: boolean;
  orderId: string;
  currentDriver?: { name: string; employeeId: string };
  onClose: () => void;
  onAssign: (id: string, driver: { name: string; employeeId: string }) => void;
}) {
  const { t } = useLang();
  const { employees } = useEmployee();
  const [driverSearch, setDriverSearch] = useState("");
  const active = employees
    .filter((e) => e.status !== "suspended")
    .filter((e) =>
      driverSearch.trim()
        ? e.name.toLowerCase().includes(driverSearch.trim().toLowerCase()) ||
          e.employeeId.includes(driverSearch.trim())
        : true
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t("delChooseDriver")}</Text>

          {/* Search */}
          <View style={styles.driverSearchRow}>
            <Feather name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.driverSearchInput}
              value={driverSearch}
              onChangeText={setDriverSearch}
              placeholder={t("delSearchDriver")}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
            {driverSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDriverSearch("")}>
                <Feather name="x" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {currentDriver && (
            <View style={styles.currentDriverRow}>
              <Feather name="user-check" size={14} color={Colors.success} />
              <Text style={styles.currentDriverText}>
                {t("delCurrentDriver")}{" "}
                <Text style={{ fontWeight: "800" }}>{currentDriver.name}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onAssign(orderId, { name: "", employeeId: "" });
                  onClose();
                }}
              >
                <Text style={styles.removeDriverText}>{t("delRemoveDriver")}</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={active}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ gap: 8, padding: 16 }}
            renderItem={({ item: emp }) => {
              const isCurrent = currentDriver?.employeeId === emp.employeeId;
              return (
                <TouchableOpacity
                  style={[styles.driverRow, isCurrent && styles.driverRowActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onAssign(orderId, { name: emp.name, employeeId: emp.employeeId });
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.driverAvatar,
                      isCurrent && { backgroundColor: Colors.primary },
                    ]}
                  >
                    <Text
                      style={[styles.driverAvatarText, isCurrent && { color: "#fff" }]}
                    >
                      {emp.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverName, isCurrent && { color: Colors.primary }]}>
                      {emp.name}
                    </Text>
                    <Text style={styles.driverEmpId}>#{emp.employeeId}</Text>
                  </View>
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
  deliveringId,
  onMarkDelivered,
  onOpenDriverModal,
}: {
  order: Order;
  lang: string;
  deliveringId: string | null;
  onMarkDelivered: (id: string) => void;
  onOpenDriverModal: (order: Order) => void;
}) {
  const { t } = useLang();
  const urgencyLabels: Record<Urgency, string> = {
    overdue: t("delOverdue"),
    urgent: t("delUrgent"),
    soon: t("delSoon"),
    ok: "",
    none: "",
  };
  const delivered = isDelivered(order);
  const urgency = getUrgency(order);
  const urgencyColor = URGENCY_COLOR[urgency];
  const ready = isReadyForDelivery(order);
  const accentColor = delivered ? "#16a34a" : ready ? "#7c3aed" : urgency !== "none" ? urgencyColor : Colors.gold;
  const hasDriver = !!(order.deliveryDriver?.employeeId);

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            {ready && (
              <View style={[styles.urgencyBadge, { backgroundColor: "#7c3aed20" }]}>
                <Text style={[styles.urgencyText, { color: "#7c3aed" }]}>{t("delOrderReady")}</Text>
              </View>
            )}
            {!delivered && !ready && urgency !== "none" && (
              <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + "20" }]}>
                <Text style={[styles.urgencyText, { color: urgencyColor }]}>
                  {urgencyLabels[urgency]}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.orderDate}>{fmtDate(order.createdAt, lang as any)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: accentColor + "20" }]}>
          <Text style={[styles.statusText, { color: accentColor }]}>
            {delivered ? "✓ " + t("delDelivered") : t("delPending")}
          </Text>
        </View>
      </View>

      {/* Customer + quick-contact buttons */}
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

      {/* Delivery address */}
      {order.deliveryAddress ? (
        <TouchableOpacity
          style={styles.addressRow}
          onPress={() => { Haptics.selectionAsync(); openMaps(order.deliveryAddress!); }}
          activeOpacity={0.8}
        >
          <Feather name="map-pin" size={14} color={Colors.mawali} />
          <Text style={styles.addressText} numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
          <View style={styles.mapBtn}>
            <Feather name="navigation" size={12} color="#fff" />
            <Text style={styles.mapBtnText}>{t("delMapBtn")}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Delivery time */}
      {order.deliveryTime ? (
        <View style={styles.infoRow}>
          <Feather
            name="clock"
            size={13}
            color={urgency !== "none" ? urgencyColor : Colors.gold}
          />
          <Text style={styles.infoLabel}>{t("delTime")}</Text>
          <Text
            style={[
              styles.infoValue,
              { color: urgency !== "none" ? urgencyColor : Colors.gold, fontWeight: "700" },
            ]}
          >
            {order.deliveryTime}
          </Text>
        </View>
      ) : null}

      {/* Amount */}
      <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
        <Feather name="dollar-sign" size={13} color={Colors.primary} />
        <Text style={styles.infoLabel}>{t("delTotal")}</Text>
        <Text style={[styles.infoValue, { fontWeight: "700" }]}>
          {order.totalAmount ? fmtCurrency(order.totalAmount) : "—"}
        </Text>
      </View>

      {/* Notes */}
      {order.notes ? (
        <View style={styles.notesBox}>
          <Feather name="file-text" size={12} color={Colors.textMuted} />
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      {/* Driver assignment */}
      <TouchableOpacity
        style={styles.driverAssignRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenDriverModal(order);
        }}
        activeOpacity={0.8}
      >
        <Feather name="truck" size={14} color={hasDriver ? Colors.primary : Colors.textMuted} />
        {hasDriver ? (
          <Text style={styles.driverAssignedText}>
            {t("delDriverLabel")}{" "}
            <Text style={{ fontWeight: "800", color: Colors.primary }}>
              {order.deliveryDriver!.name}
            </Text>
          </Text>
        ) : (
          <Text style={styles.driverUnassignedText}>{t("delAssignDriverHint")}</Text>
        )}
        <Feather name="chevron-left" size={14} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* WhatsApp ready notification */}
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
          <Text style={styles.waReadyBtnText}>{t("delWaReadyBtn")}</Text>
        </TouchableOpacity>
      )}

      {/* Mark delivered */}
      {!delivered && (
        <TouchableOpacity
          style={[styles.deliverBtn, deliveringId === order.id && { opacity: 0.6 }]}
          onPress={() => deliveringId !== order.id && onMarkDelivered(order.id)}
          activeOpacity={0.8}
          disabled={deliveringId === order.id}
        >
          <Feather name={deliveringId === order.id ? "loader" : "check-circle"} size={16} color="#fff" />
          <Text style={styles.deliverBtnText}>
            {deliveringId === order.id ? "..." : t("markDelivered")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type TabKey = "all" | "pending" | "done";
type SortKey = "time" | "date";

export default function DeliveryScreen() {
  const { t, lang } = useLang();
  const { orders, updateDeliveryStatus, assignDeliveryDriver } = useOrders();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<TabKey>("all");
  const [sort, setSort] = useState<SortKey>("time");
  const [driverModalOrder, setDriverModalOrder] = useState<Order | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const deliveryOrders = useMemo(
    () => orders.filter((o) => o.orderType === "delivery"),
    [orders]
  );

  const filtered = useMemo(() => {
    let base = deliveryOrders;
    if (tab === "pending") base = base.filter((o) => !isDelivered(o));
    if (tab === "done") base = base.filter((o) => isDelivered(o));

    if (sort === "time") {
      return [...base].sort((a, b) => {
        const ua = getUrgency(a);
        const ub = getUrgency(b);
        if (URGENCY_RANK[ua] !== URGENCY_RANK[ub]) return URGENCY_RANK[ua] - URGENCY_RANK[ub];
        const da = parseDeliveryDT(a.deliveryTime);
        const db = parseDeliveryDT(b.deliveryTime);
        if (da && db) return da.getTime() - db.getTime();
        if (da) return -1;
        if (db) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return [...base].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [deliveryOrders, tab, sort]);

  const pendingCount = deliveryOrders.filter((o) => !isDelivered(o)).length;
  const doneCount = deliveryOrders.filter((o) => isDelivered(o)).length;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: t("delAllOrders"), count: deliveryOrders.length },
    { key: "pending", label: t("delPending"), count: pendingCount },
    { key: "done", label: t("delDelivered"), count: doneCount },
  ];

  return (
    <View style={styles.container}>
      <StatsBar deliveryOrders={deliveryOrders} />

      {/* Filter + Sort bar */}
      <View style={styles.controlBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map(({ key, label, count }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {label} ({count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => {
            Haptics.selectionAsync();
            setSort((s) => (s === "time" ? "date" : "time"));
          }}
        >
          <Feather
            name={sort === "time" ? "clock" : "calendar"}
            size={13}
            color={Colors.primary}
          />
          <Text style={styles.sortBtnText}>
            {sort === "time" ? t("delSortByTime") : t("delSortByDate")}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: insets.bottom + 100,
          gap: 10,
          paddingTop: 4,
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="truck" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t("delNoOrders")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <DeliveryCard
            order={item}
            lang={lang}
            deliveringId={deliveringId}
            onMarkDelivered={async (id) => {
              setDeliveringId(id);
              try { await updateDeliveryStatus(id, "delivered"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
              finally { setDeliveringId(null); }
            }}
            onOpenDriverModal={setDriverModalOrder}
          />
        )}
      />

      <DriverModal
        visible={driverModalOrder !== null}
        orderId={driverModalOrder?.id ?? ""}
        currentDriver={
          driverModalOrder?.deliveryDriver?.employeeId
            ? driverModalOrder.deliveryDriver
            : undefined
        }
        onClose={() => setDriverModalOrder(null)}
        onAssign={assignDeliveryDriver}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Stats
  statsWrap: { padding: 14, paddingBottom: 8, gap: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 10,
    alignItems: "center", borderWidth: 2,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statNum: { fontSize: 20, fontWeight: "900", color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },
  statsRow2: { flexDirection: "row", gap: 8 },
  revenueCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.success + "50",
  },
  revenueLabel: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
  revenueValue: { fontSize: 13, fontWeight: "800", color: Colors.success },
  completionCard: {
    flex: 1.3, backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.primary + "30", gap: 6,
  },
  completionTop: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  completionLabel: { fontSize: 11, color: Colors.textSecondary },
  completionPct: { fontSize: 14, fontWeight: "900", color: Colors.primary },
  progressBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },

  // Controls
  controlBar: {
    flexDirection: "row", alignItems: "center",
    paddingLeft: 14, paddingRight: 10, marginBottom: 6, gap: 8,
  },
  tabRow: { gap: 6, flexDirection: "row" },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  sortBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
    backgroundColor: Colors.primary + "12", borderWidth: 1, borderColor: Colors.primary + "30",
  },
  sortBtnText: { fontSize: 11, fontWeight: "700", color: Colors.primary },

  // Card
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10,
  },
  orderNum: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  orderDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  urgencyText: { fontSize: 11, fontWeight: "800" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },

  // Customer
  customerRow: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  customerName: { fontSize: 15, fontWeight: "800", color: Colors.text },
  customerPhone: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  quickActions: { flexDirection: "row", gap: 8 },
  quickBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  // Address
  addressRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.mawali + "0D", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8,
  },
  addressText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },
  mapBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.mawali, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  mapBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  // Info rows
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, width: 90 },
  infoValue: { flex: 1, fontSize: 13, color: Colors.text },

  // Notes
  notesBox: {
    flexDirection: "row", gap: 6, marginTop: 8, padding: 8,
    backgroundColor: Colors.background, borderRadius: 8, alignItems: "flex-start",
  },
  notesText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // Driver
  driverAssignRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  driverAssignedText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  driverUnassignedText: {
    flex: 1, fontSize: 13, color: Colors.textMuted, fontStyle: "italic",
  },

  // WhatsApp ready button
  waReadyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 10, paddingVertical: 11, borderRadius: 12,
    backgroundColor: "#25D366",
    shadowColor: "#25D366", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  waReadyBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  // Deliver button
  deliverBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#16a34a",
    shadowColor: "#16a34a", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  deliverBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // Empty
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },

  // Driver Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "70%", paddingBottom: 30,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2,
    alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17, fontWeight: "800", color: Colors.primary,
    textAlign: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  driverSearchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  driverSearchInput: {
    flex: 1, fontSize: 14, color: Colors.text,
  },
  currentDriverRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 10, padding: 10,
    backgroundColor: Colors.success + "12", borderRadius: 10,
  },
  currentDriverText: { flex: 1, fontSize: 13, color: Colors.text },
  removeDriverText: { fontSize: 12, color: Colors.accent, fontWeight: "700" },
  driverRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderRadius: 12, backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  driverRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
  driverAvatarText: { fontSize: 16, fontWeight: "800", color: Colors.textSecondary },
  driverName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  driverEmpId: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
});
