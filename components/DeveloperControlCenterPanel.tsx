import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { DEVELOPER_CONTROL_SECTIONS, DeveloperControlPriority, DeveloperControlStatus, developerControlSummary } from "@/constants/developerControlCenter";

const STATUS_LABELS: Record<DeveloperControlStatus, string> = {
  ready: "جاهز",
  needs_action: "يحتاج إجراء",
  planned: "مخطط",
  blocked: "متوقف",
};

const STATUS_COLORS: Record<DeveloperControlStatus, string> = {
  ready: Colors.success,
  needs_action: Colors.accent,
  planned: Colors.info,
  blocked: Colors.textMuted,
};

const PRIORITY_LABELS: Record<DeveloperControlPriority, string> = {
  critical: "حرج",
  high: "عالي",
  medium: "متوسط",
  low: "منخفض",
};

const PRIORITY_COLORS: Record<DeveloperControlPriority, string> = {
  critical: Colors.accent,
  high: Colors.warning,
  medium: Colors.info,
  low: Colors.textMuted,
};

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function DeveloperControlCenterPanel() {
  const summary = developerControlSummary();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Feather name="command" size={18} color={Colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>مركز تحكم المطور</Text>
          <Text style={styles.subtitle}>مراجعة شاملة لما يحتاجه النظام ليصبح منصة تأجير مستقرة وآمنة للشركات.</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <Metric label="إجمالي البنود" value={summary.total} color={Colors.primary} />
        <Metric label="جاهزة" value={summary.ready} color={Colors.success} />
        <Metric label="تحتاج إجراء" value={summary.needsAction} color={Colors.accent} />
        <Metric label="مخطط" value={summary.planned} color={Colors.info} />
      </View>

      {summary.needsAction > 0 ? (
        <View style={styles.warningBox}>
          <Feather name="alert-triangle" size={15} color={Colors.accent} />
          <Text style={styles.warningText}>يوجد {summary.needsAction} بند يحتاج إجراء قبل اعتبار لوحة المطور مكتملة للإنتاج.</Text>
        </View>
      ) : null}

      {DEVELOPER_CONTROL_SECTIONS.map((section) => (
        <View key={section.id} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.titleAr}</Text>
          <Text style={styles.sectionDesc}>{section.descriptionAr}</Text>

          {section.items.map((item) => {
            const statusColor = STATUS_COLORS[item.status];
            const priorityColor = PRIORITY_COLORS[item.priority];
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.titleAr}</Text>
                    <Text style={styles.itemDesc}>{item.descriptionAr}</Text>
                  </View>
                </View>

                <View style={styles.badgesRow}>
                  <Text style={[styles.badge, { backgroundColor: statusColor + "18", color: statusColor }]}>{STATUS_LABELS[item.status]}</Text>
                  <Text style={[styles.badge, { backgroundColor: priorityColor + "18", color: priorityColor }]}>أولوية {PRIORITY_LABELS[item.priority]}</Text>
                  <Text style={styles.ownerBadge}>{item.ownerAr}</Text>
                </View>

                <View style={styles.actionBox}>
                  <Feather name="corner-down-left" size={12} color={Colors.textMuted} />
                  <Text style={styles.actionText}>{item.actionAr}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  headerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  metricsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  metricCard: { flexGrow: 1, minWidth: 120, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  metricValue: { fontSize: 22, fontWeight: "900", textAlign: "right" },
  metricLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  warningBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, borderRadius: 13, backgroundColor: Colors.accent + "10" },
  warningText: { flex: 1, fontSize: 11, color: Colors.accent, textAlign: "right", lineHeight: 17, fontWeight: "800" },
  sectionCard: { gap: 9, padding: 12, borderRadius: 16, backgroundColor: "#f8fafc" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right" },
  sectionDesc: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 17 },
  itemCard: { gap: 8, padding: 11, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  itemHead: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  itemTitle: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  itemDesc: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 17, marginTop: 2 },
  badgesRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  badge: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18, fontSize: 10, fontWeight: "900" },
  ownerBadge: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18, fontSize: 10, fontWeight: "900", backgroundColor: Colors.primary + "10", color: Colors.primary },
  actionBox: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, padding: 8, borderRadius: 11, backgroundColor: "#f1f5f9" },
  actionText: { flex: 1, fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 17, fontWeight: "700" },
});
