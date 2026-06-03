import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
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
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";
import { fmtCurrency, fmtDate } from "@/utils/dateUtils";

function openWhatsApp(phone: string, message?: string) {
  const raw = phone.replace(/\D/g, "");
  const intl = raw.startsWith("0") ? "966" + raw.slice(1) : raw;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  Linking.openURL(`https://wa.me/${intl}${text}`).catch(() => {});
}

export default function TraysScreen() {
  const { t, lang } = useLang();
  const { orders, markTrayReturned } = useOrders();
  const { currentEmployee } = useEmployee();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"pending" | "returned">("pending");

  const trayOrders = useMemo(
    () => orders.filter((o) => o.insuranceAmount && o.insuranceAmount > 0),
    [orders]
  );

  const pending = trayOrders.filter((o) => !o.trayReturned);
  const returned = trayOrders.filter((o) => o.trayReturned);
  const totalInsurance = trayOrders.reduce((s, o) => s + (o.insuranceAmount ?? 0), 0);
  const pendingInsurance = pending.reduce((s, o) => s + (o.insuranceAmount ?? 0), 0);

  const displayed = tab === "pending" ? pending : returned;

  const handleMarkReturned = (id: string) => {
    markTrayReturned(
      id,
      currentEmployee
        ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId }
        : undefined
    );
  };

  const TABS = [
    { key: "pending" as const,  label: t("traysPending"),  count: pending.length },
    { key: "returned" as const, label: t("traysReturned"), count: returned.length },
  ];

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: Colors.primary }]}>
          <Text style={styles.summaryNum}>{trayOrders.length}</Text>
          <Text style={styles.summaryLabel}>{t("traysTotal")}</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: Colors.gold }]}>
          <Text style={[styles.summaryNum, { color: Colors.gold }]}>{pending.length}</Text>
          <Text style={styles.summaryLabel}>{t("traysOutstanding")}</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: "#16a34a" }]}>
          <Text style={[styles.summaryNum, { color: "#16a34a" }]}>{returned.length}</Text>
          <Text style={styles.summaryLabel}>{t("traysReturned")}</Text>
        </View>
      </View>

      {/* Insurance summary */}
      <View style={styles.insuranceBox}>
        <Feather name="shield" size={16} color={Colors.gold} />
        <Text style={styles.insuranceText}>
          {t("traysInsAmt")} {fmtCurrency(pendingInsurance)} / {fmtCurrency(totalInsurance)}
        </Text>
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
        data={displayed}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t("traysNoData")}</Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const isReturned = !!order.trayReturned;
          return (
            <View style={[styles.card, { borderLeftColor: isReturned ? "#16a34a" : Colors.gold }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderNum}>#{order.orderNumber}</Text>
                  <Text style={styles.orderDate}>{fmtDate(order.createdAt, lang)}</Text>
                </View>
                <View style={[styles.amountBadge, { backgroundColor: Colors.gold + "20" }]}>
                  <Feather name="shield" size={12} color={Colors.gold} />
                  <Text style={styles.amountText}>{fmtCurrency(order.insuranceAmount ?? 0)}</Text>
                </View>
              </View>

              <View style={styles.customerRow}>
                <Feather name="user" size={13} color={Colors.primary} />
                <Text style={styles.customerName}>{order.customerName}</Text>
                <Text style={styles.customerPhone}>{order.customerPhone}</Text>
                <TouchableOpacity
                  style={[styles.quickBtn, { backgroundColor: "#16a34a18" }]}
                  onPress={() => { Haptics.selectionAsync(); Linking.openURL(`tel:${order.customerPhone.replace(/\D/g, "")}`); }}
                >
                  <Feather name="phone" size={13} color="#16a34a" />
                </TouchableOpacity>
                {!isReturned && (
                  <TouchableOpacity
                    style={[styles.quickBtn, { backgroundColor: "#25D36618" }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      openWhatsApp(order.customerPhone, `أهلاً ${order.customerName}، نذكّركم بإعادة الصينية الخاصة بطلب #${order.orderNumber}. شكراً لكم 🙏`);
                    }}
                  >
                    <Feather name="message-circle" size={13} color="#25D366" />
                  </TouchableOpacity>
                )}
              </View>

              {order.insurancePaymentMethod && (
                <Text style={styles.payMethod}>
                  {t("traysInsAmt")} {order.insurancePaymentMethod === "cash" ? t("repCash") : t("repCard")}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.returnBtn, isReturned && styles.returnBtnDone]}
                onPress={() => !isReturned && handleMarkReturned(order.id)}
                activeOpacity={0.8}
              >
                <Feather name={isReturned ? "check-circle" : "rotate-ccw"} size={14} color={isReturned ? "#16a34a" : Colors.primary} />
                <Text style={[styles.returnBtnText, isReturned && { color: "#16a34a" }]}>
                  {isReturned ? t("traysReturned2") : t("traysMarkRet")}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
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
  insuranceBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 8, padding: 10,
    backgroundColor: Colors.gold + "15", borderRadius: 10, borderWidth: 1, borderColor: Colors.gold + "40",
  },
  insuranceText: { fontSize: 13, fontWeight: "700", color: Colors.text },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  orderNum: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  orderDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  amountBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  amountText: { fontSize: 13, fontWeight: "700", color: Colors.gold },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  customerName: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text },
  customerPhone: { fontSize: 12, color: Colors.textMuted },
  quickBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  payMethod: { fontSize: 11, color: Colors.textSecondary, marginBottom: 10 },
  returnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.primary + "60", backgroundColor: Colors.primary + "08",
  },
  returnBtnDone: { borderColor: "#16a34a60", backgroundColor: "#16a34a10" },
  returnBtnText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
