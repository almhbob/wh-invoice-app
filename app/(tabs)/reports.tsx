import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";

type Filter = "all" | "today" | "week" | "month";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

function isInFilter(isoDate: string, filter: Filter): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  if (filter === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (filter === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  if (filter === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{fmtCurrency(value)}</Text>
    </View>
  );
}

const DEPT_META = {
  halwa:     { label: "حلا زفة", color: Colors.halwa },
  mawali:    { label: "معجنات",  color: Colors.mawali },
  chocolate: { label: "شوكولاتة",color: Colors.chocolate },
  cake:      { label: "كيك",    color: Colors.cake },
  packaging: { label: "تغليف",  color: Colors.packaging },
};

const PAYMENT_COLORS = { cash: "#16a34a", card: "#2563eb", transfer: "#d97706" };

export default function ReportsScreen() {
  const { t } = useLang();
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("month");

  const filtered = useMemo(() => orders.filter((o) => isInFilter(o.createdAt, filter)), [orders, filter]);

  const totalRevenue = filtered.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const avgOrder = filtered.length > 0 ? totalRevenue / filtered.length : 0;

  const byDept = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.department;
        const lineTotal = (item.price ?? 0) * item.quantity;
        map[key] = (map[key] ?? 0) + lineTotal;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const maxDept = byDept[0]?.[1] ?? 1;

  const byPayment = useMemo(() => {
    const map: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
    filtered.forEach((o) => {
      const pm = o.paymentMethod ?? "cash";
      map[pm] = (map[pm] ?? 0) + (o.totalAmount ?? 0);
    });
    return map;
  }, [filtered]);

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((o) => {
      o.items.forEach((item) => {
        map[item.name] = (map[item.name] ?? 0) + item.quantity;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const maxProd = topProducts[0]?.[1] ?? 1;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "today", label: t("repFilterToday") },
    { key: "week",  label: t("repFilterWeek") },
    { key: "month", label: t("repFilterMonth") },
    { key: "all",   label: t("repFilterAll") },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterBtnText, filter === f.key && styles.filterBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPI cards */}
      <View style={styles.section}>
        <StatCard icon="trending-up" label={t("repTotalRevenue")} value={fmtCurrency(totalRevenue)} color={Colors.primary} />
        <StatCard icon="shopping-bag" label={t("repTotalOrdersNum")} value={String(filtered.length)} color={Colors.gold} />
        <StatCard icon="bar-chart-2" label={t("repAvgOrder")} value={fmtCurrency(avgOrder)} color={Colors.packaging} />
      </View>

      {/* Revenue by dept */}
      {byDept.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("repByDept")}</Text>
          {byDept.map(([dept, rev]) => (
            <BarRow
              key={dept}
              label={(DEPT_META as any)[dept]?.label ?? dept}
              value={rev}
              max={maxDept}
              color={(DEPT_META as any)[dept]?.color ?? Colors.primary}
            />
          ))}
        </View>
      )}

      {/* Payment methods */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("repByPayment")}</Text>
        {Object.entries(byPayment).filter(([, v]) => v > 0).map(([pm, val]) => (
          <View key={pm} style={styles.payRow}>
            <View style={[styles.payDot, { backgroundColor: (PAYMENT_COLORS as any)[pm] ?? Colors.primary }]} />
            <Text style={styles.payLabel}>{pm === "cash" ? t("repCash") : pm === "card" ? t("repCard") : t("repTransfer")}</Text>
            <Text style={styles.payValue}>{fmtCurrency(val)}</Text>
          </View>
        ))}
        {Object.values(byPayment).every((v) => v === 0) && (
          <Text style={styles.emptyText}>{t("repNoData")}</Text>
        )}
      </View>

      {/* Top products */}
      {topProducts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("repTopProducts")}</Text>
          {topProducts.map(([name, qty], idx) => (
            <View key={name} style={styles.prodRow}>
              <Text style={styles.prodRank}>#{idx + 1}</Text>
              <Text style={styles.prodName} numberOfLines={1}>{name}</Text>
              <View style={[styles.prodBar, { width: `${(qty / maxProd) * 55}%` as any, backgroundColor: Colors.primary + "40" }]} />
              <Text style={styles.prodQty}>{qty} {t("repUnits")}</Text>
            </View>
          ))}
        </View>
      )}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="bar-chart-2" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyStateText}>{t("repNoData")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterRow: { flexDirection: "row", gap: 8, padding: 16, flexWrap: "wrap" },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  filterBtnTextActive: { color: "#fff" },
  section: { paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  statCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 17, fontWeight: "800", color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  card: {
    margin: 16, marginTop: 8, backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: Colors.text, marginBottom: 14 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  barLabel: { width: 70, fontSize: 12, color: Colors.textSecondary },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 90, fontSize: 11, color: Colors.text, fontWeight: "700", textAlign: "right" },
  payRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  payDot: { width: 10, height: 10, borderRadius: 5 },
  payLabel: { flex: 1, fontSize: 13, color: Colors.text },
  payValue: { fontSize: 13, fontWeight: "700", color: Colors.text },
  prodRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  prodRank: { width: 24, fontSize: 11, fontWeight: "800", color: Colors.textMuted },
  prodName: { flex: 1, fontSize: 13, color: Colors.text },
  prodBar: { height: 6, borderRadius: 3, minWidth: 4 },
  prodQty: { fontSize: 12, fontWeight: "700", color: Colors.primary, width: 60, textAlign: "right" },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: "center", paddingVertical: 12 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 48, gap: 12 },
  emptyStateText: { fontSize: 15, color: Colors.textMuted },
});
