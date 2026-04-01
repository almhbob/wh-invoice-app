import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { Order, useOrders } from "@/context/OrdersContext";
import { fmtDate } from "@/utils/dateUtils";

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

function isFullyDone(order: Order): boolean {
  return Object.values(order.departmentStatuses).every((s) => s === "done" || s === "cancelled");
}

function DeliveryCard({ order }: { order: Order }) {
  const { t, lang } = useLang();
  const done = isFullyDone(order);
  const accentColor = done ? "#16a34a" : Colors.gold;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNum}>#{order.orderNumber}</Text>
          <Text style={styles.orderDate}>{fmtDate(order.createdAt, lang)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: accentColor + "20" }]}>
          <Text style={[styles.statusText, { color: accentColor }]}>
            {done ? t("delDelivered") : t("delPending")}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Feather name="user" size={13} color={Colors.primary} />
        <Text style={styles.infoLabel}>{t("delCustomer")}</Text>
        <Text style={styles.infoValue}>{order.customerName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Feather name="phone" size={13} color={Colors.textMuted} />
        <Text style={styles.infoLabel}>{t("delPhone")}</Text>
        <Text style={styles.infoValue}>{order.customerPhone}</Text>
      </View>
      {order.deliveryTime && (
        <View style={styles.infoRow}>
          <Feather name="clock" size={13} color={Colors.gold} />
          <Text style={styles.infoLabel}>{t("delTime")}</Text>
          <Text style={[styles.infoValue, { color: Colors.gold, fontWeight: "700" }]}>{order.deliveryTime}</Text>
        </View>
      )}
      <View style={styles.infoRow}>
        <Feather name="dollar-sign" size={13} color={Colors.primary} />
        <Text style={styles.infoLabel}>{t("delTotal")}</Text>
        <Text style={styles.infoValue}>{fmtCurrency(order.totalAmount ?? 0)}</Text>
      </View>

      {order.notes ? (
        <View style={styles.notesBox}>
          <Feather name="file-text" size={12} color={Colors.textMuted} />
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DeliveryScreen() {
  const { t } = useLang();
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"all" | "pending" | "done">("all");

  const deliveryOrders = useMemo(
    () => orders.filter((o) => o.orderType === "delivery"),
    [orders]
  );

  const filtered = useMemo(() => {
    if (tab === "pending") return deliveryOrders.filter((o) => !isFullyDone(o));
    if (tab === "done") return deliveryOrders.filter((o) => isFullyDone(o));
    return deliveryOrders;
  }, [deliveryOrders, tab]);

  const pendingCount = deliveryOrders.filter((o) => !isFullyDone(o)).length;
  const doneCount = deliveryOrders.filter((o) => isFullyDone(o)).length;

  const TABS = [
    { key: "all" as const,     label: t("delAllOrders"),  count: deliveryOrders.length },
    { key: "pending" as const, label: t("delPending"),    count: pendingCount },
    { key: "done" as const,    label: t("delDelivered"),  count: doneCount },
  ];

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: Colors.gold }]}>
          <Text style={styles.summaryNum}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>{t("delPending")}</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: "#16a34a" }]}>
          <Text style={[styles.summaryNum, { color: "#16a34a" }]}>{doneCount}</Text>
          <Text style={styles.summaryLabel}>{t("delDelivered")}</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: Colors.primary }]}>
          <Text style={styles.summaryNum}>{deliveryOrders.length}</Text>
          <Text style={styles.summaryLabel}>{t("total")}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="truck" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t("delNoOrders")}</Text>
          </View>
        }
        renderItem={({ item }) => <DeliveryCard order={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summaryRow: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 8 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    alignItems: "center", borderWidth: 2,
  },
  summaryNum: { fontSize: 22, fontWeight: "900", color: Colors.primary },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  orderNum: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  orderDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border + "60" },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, width: 80 },
  infoValue: { flex: 1, fontSize: 13, color: Colors.text },
  notesBox: { flexDirection: "row", gap: 6, marginTop: 8, padding: 8, backgroundColor: Colors.background, borderRadius: 8, alignItems: "flex-start" },
  notesText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
