import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { DEMO_INVENTORY_ITEMS, DEMO_LOYALTY_CUSTOMERS, DEMO_SHIFT_SUMMARIES, inventoryAlerts, loyaltyTierLabel, shiftTotal } from "@/constants/enterpriseOps";
import { POS_REPLACEMENT_POSITIONING_AR, POS_REPLACEMENT_SUITE, suiteCompletionPercent } from "@/constants/posReplacementSuite";

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}

function Metric({ icon, title, value, color }: { icon: any; title: string; value: string | number; color: string }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

export function EnterpriseOpsPanel() {
  const lowStock = inventoryAlerts(DEMO_INVENTORY_ITEMS);
  const openShifts = DEMO_SHIFT_SUMMARIES.filter((s) => s.status === "open");
  const totalShiftSales = DEMO_SHIFT_SUMMARIES.reduce((sum, s) => sum + shiftTotal(s), 0);
  const readyModules = POS_REPLACEMENT_SUITE.filter((m) => m.status === "ready").length;
  const partialModules = POS_REPLACEMENT_SUITE.filter((m) => m.status === "partial").length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{POS_REPLACEMENT_POSITIONING_AR.title}</Text>
      <Text style={styles.subtitle}>{POS_REPLACEMENT_POSITIONING_AR.summary}</Text>

      <View style={styles.metricsGrid}>
        <Metric icon="zap" title="اكتمال المنصة" value={`${suiteCompletionPercent()}%`} color={Colors.gold} />
        <Metric icon="check-circle" title="وحدات جاهزة" value={readyModules} color={Colors.success} />
        <Metric icon="tool" title="وحدات جزئية" value={partialModules} color={Colors.info} />
        <Metric icon="alert-triangle" title="تنبيهات مخزون" value={lowStock.length} color={Colors.accent} />
      </View>

      <Text style={styles.sectionTitle}>إغلاق الكاشير اليومي</Text>
      {DEMO_SHIFT_SUMMARIES.map((shift) => (
        <View key={shift.id} style={styles.rowCard}>
          <View style={styles.rowHead}>
            <Text style={styles.rowTitle}>{shift.cashierName}</Text>
            <Text style={[styles.badge, shift.status === "open" ? styles.openBadge : styles.closedBadge]}>{shift.status === "open" ? "مفتوح" : "مغلق"}</Text>
          </View>
          <Text style={styles.rowSub}>الفواتير: {shift.invoicesCount} · الإجمالي: {fmt(shiftTotal(shift))} ر.س</Text>
          {shift.difference ? <Text style={styles.warningText}>فرق الصندوق: {fmt(shift.difference)} ر.س</Text> : null}
        </View>
      ))}

      <Text style={styles.sectionTitle}>المخزون والتنبيهات</Text>
      {lowStock.map((item) => (
        <View key={item.id} style={styles.rowCard}>
          <View style={styles.rowHead}>
            <Text style={styles.rowTitle}>{item.nameAr}</Text>
            <Text style={styles.stockBadge}>منخفض</Text>
          </View>
          <Text style={styles.rowSub}>المتوفر: {fmt(item.quantity)} · الحد الأدنى: {fmt(item.minQuantity)} · التكلفة: {fmt(item.cost)} ر.س</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>العملاء والولاء</Text>
      {DEMO_LOYALTY_CUSTOMERS.map((customer) => (
        <View key={customer.id} style={styles.rowCard}>
          <View style={styles.rowHead}>
            <Text style={styles.rowTitle}>{customer.name}</Text>
            <Text style={styles.loyaltyBadge}>{loyaltyTierLabel(customer.tier)}</Text>
          </View>
          <Text style={styles.rowSub}>النقاط: {fmt(customer.points)} · الزيارات: {customer.visits} · الإنفاق: {fmt(customer.totalSpent)} ر.س</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>خريطة المميزات</Text>
      <View style={styles.moduleWrap}>
        {POS_REPLACEMENT_SUITE.map((mod) => (
          <View key={mod.key} style={styles.moduleChip}>
            <View style={[styles.statusDot, mod.status === "ready" ? styles.ready : mod.status === "partial" ? styles.partial : styles.planned]} />
            <Text style={styles.moduleText}>{mod.titleAr}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  metricsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  metric: { flexGrow: 1, minWidth: 130, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc", gap: 4 },
  metricIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  metricValue: { fontSize: 20, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  metricTitle: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right", marginTop: 4 },
  rowCard: { gap: 5, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  rowHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  rowSub: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 17 },
  badge: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, fontSize: 10, fontWeight: "900" },
  openBadge: { backgroundColor: Colors.success + "18", color: Colors.success },
  closedBadge: { backgroundColor: Colors.primary + "12", color: Colors.primary },
  stockBadge: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, fontSize: 10, fontWeight: "900", backgroundColor: Colors.accent + "15", color: Colors.accent },
  loyaltyBadge: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, fontSize: 10, fontWeight: "900", backgroundColor: Colors.gold + "18", color: Colors.gold },
  warningText: { fontSize: 11, color: Colors.accent, textAlign: "right", fontWeight: "800" },
  moduleWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  moduleChip: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f1f5f9" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ready: { backgroundColor: Colors.success },
  partial: { backgroundColor: Colors.info },
  planned: { backgroundColor: Colors.textMuted },
  moduleText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "800" },
});
