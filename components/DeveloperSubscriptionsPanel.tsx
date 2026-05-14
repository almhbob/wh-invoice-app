import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import {
  DEVELOPER_SUBSCRIPTION_LINKS,
  SUBSCRIPTION_CATEGORY_ICONS,
  SUBSCRIPTION_CATEGORY_LABELS_AR,
  sortedDeveloperSubscriptions,
} from "@/constants/developerSubscriptions";

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  due_soon: "قريب الاستحقاق",
  needs_review: "يحتاج مراجعة",
  unknown: "غير محدد",
};

const STATUS_COLORS: Record<string, string> = {
  active: Colors.success,
  due_soon: Colors.warning,
  needs_review: Colors.accent,
  unknown: Colors.textMuted,
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "حرج",
  high: "مهم",
  medium: "متوسط",
  low: "منخفض",
};

export function DeveloperSubscriptionsPanel() {
  const links = sortedDeveloperSubscriptions();
  const criticalCount = DEVELOPER_SUBSCRIPTION_LINKS.filter((l) => l.priority === "critical").length;
  const reviewCount = DEVELOPER_SUBSCRIPTION_LINKS.filter((l) => l.status === "needs_review").length;

  const openUrl = async (url?: string) => {
    if (!url) return;
    await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>اشتراكات واستقرار النظام</Text>
      <Text style={styles.subtitle}>روابط السداد والخوادم والدومينات وقواعد البيانات لتسهيل متابعة الاستقرار المالي والتقني للنظام.</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricNum}>{DEVELOPER_SUBSCRIPTION_LINKS.length}</Text>
          <Text style={styles.metricLabel}>رابط خدمة</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricNum, { color: Colors.accent }]}>{criticalCount}</Text>
          <Text style={styles.metricLabel}>حرجة</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricNum, { color: Colors.warning }]}>{reviewCount}</Text>
          <Text style={styles.metricLabel}>تحتاج مراجعة</Text>
        </View>
      </View>

      {links.map((item) => {
        const icon = SUBSCRIPTION_CATEGORY_ICONS[item.category] ?? "link";
        const label = SUBSCRIPTION_CATEGORY_LABELS_AR[item.category];
        const statusColor = STATUS_COLORS[item.status] ?? Colors.textMuted;
        return (
          <View key={item.id} style={styles.linkCard}>
            <View style={styles.linkHead}>
              <View style={[styles.iconBox, { backgroundColor: statusColor + "14" }]}>
                <Feather name={icon as any} size={16} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{item.titleAr}</Text>
                <Text style={styles.linkMeta}>{item.provider} · {label} · أولوية {PRIORITY_LABELS[item.priority]}</Text>
              </View>
              <Text style={[styles.statusPill, { backgroundColor: statusColor + "15", color: statusColor }]}>{STATUS_LABELS[item.status]}</Text>
            </View>

            <Text style={styles.notes}>{item.notesAr}</Text>
            {item.renewalHintAr ? <Text style={styles.renewal}>{item.renewalHintAr}</Text> : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openUrl(item.dashboardUrl ?? item.url)}>
                <Feather name="external-link" size={13} color="#fff" />
                <Text style={styles.actionText}>لوحة الخدمة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.billingBtn]} onPress={() => openUrl(item.billingUrl ?? item.url)}>
                <Feather name="credit-card" size={13} color="#fff" />
                <Text style={styles.actionText}>السداد</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  metricsRow: { flexDirection: "row-reverse", gap: 8 },
  metricCard: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  metricNum: { fontSize: 20, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  metricLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  linkCard: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  linkHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  iconBox: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  linkTitle: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  linkMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  statusPill: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, fontSize: 10, fontWeight: "900" },
  notes: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 17 },
  renewal: { fontSize: 11, color: Colors.warning, textAlign: "right", lineHeight: 17, fontWeight: "800" },
  actionsRow: { flexDirection: "row-reverse", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 11, backgroundColor: Colors.primary },
  billingBtn: { backgroundColor: Colors.gold },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});
