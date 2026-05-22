import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { BranchOpsBaseRecord, loadLocalBranchOps } from "@/lib/branchOpsStore";

const REQUESTS_PREFIX = "@fawtara_branch_daily_requests_v1";
const AUDITS_PREFIX = "@fawtara_branch_inventory_audit_v1";

type OpsKind = "requests" | "audits";

interface OpsSnapshot {
  kind: OpsKind;
  title: string;
  total: number;
  synced: number;
  pending: number;
  failed: number;
}

function summarize(kind: OpsKind, title: string, records: BranchOpsBaseRecord[]): OpsSnapshot {
  return {
    kind,
    title,
    total: records.length,
    synced: records.filter((record) => record.syncStatus === "synced").length,
    pending: records.filter((record) => !record.syncStatus || record.syncStatus === "local").length,
    failed: records.filter((record) => record.syncStatus === "sync_failed").length,
  };
}

export function BranchOperationsSyncPanel() {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<OpsSnapshot[]>([
    summarize("requests", "طلبيات الفروع", []),
    summarize("audits", "جرد الفروع", []),
  ]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [requests, audits] = await Promise.all([
        loadLocalBranchOps<BranchOpsBaseRecord>(REQUESTS_PREFIX, companyId),
        loadLocalBranchOps<BranchOpsBaseRecord>(AUDITS_PREFIX, companyId),
      ]);
      setSnapshots([
        summarize("requests", "طلبيات الفروع", requests),
        summarize("audits", "جرد الفروع", audits),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [companyId]);

  const totals = useMemo(() => snapshots.reduce((acc, item) => ({
    total: acc.total + item.total,
    synced: acc.synced + item.synced,
    pending: acc.pending + item.pending,
    failed: acc.failed + item.failed,
  }), { total: 0, synced: 0, pending: 0, failed: 0 }), [snapshots]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="refresh-cw" size={18} color={Colors.info} />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>مركز مزامنة عمليات الفروع</Text>
          <Text style={styles.subtitle}>يعرض حالة حفظ طلبيات الفروع والجرد محليًا وتجهيزها للمزامنة مع Firestore.</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refresh} activeOpacity={0.85}>
          <Text style={styles.refreshText}>{loading ? "..." : "تحديث"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="إجمالي" value={totals.total} color={Colors.primary} />
        <Metric label="مزامن" value={totals.synced} color={Colors.success} />
        <Metric label="محلي" value={totals.pending} color={Colors.gold} />
        <Metric label="متعثر" value={totals.failed} color={Colors.accent} />
      </View>

      {snapshots.map((snapshot) => (
        <View key={snapshot.kind} style={styles.snapshotRow}>
          <Text style={styles.snapshotTitle}>{snapshot.title}</Text>
          <View style={styles.badgesRow}>
            <Badge label={`الكل ${snapshot.total}`} color={Colors.primary} />
            <Badge label={`مزامن ${snapshot.synced}`} color={Colors.success} />
            <Badge label={`محلي ${snapshot.pending}`} color={Colors.gold} />
            <Badge label={`متعثر ${snapshot.failed}`} color={Colors.accent} />
          </View>
        </View>
      ))}

      <Text style={styles.note}>عند اكتمال متغيرات Firebase وقواعد Firestore، ستنتقل السجلات الجديدة تدريجيًا إلى الحالة “مزامن”.</Text>
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "14" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: Colors.info + "14" },
  headerTextBlock: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 11, color: Colors.textMuted, lineHeight: 18, textAlign: "right", fontWeight: "700" },
  refreshBtn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.info + "14" },
  refreshText: { color: Colors.info, fontSize: 11, fontWeight: "900" },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricBox: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 10, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 18, fontWeight: "900" },
  metricLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "800" },
  snapshotRow: { gap: 8, padding: 10, borderRadius: 16, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  snapshotTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  badgesRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  badge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: "900" },
  note: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, fontWeight: "700" },
});
