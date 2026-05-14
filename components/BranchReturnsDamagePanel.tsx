import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { BranchId, DAMAGE_REASON_PRESETS, DEFAULT_BRANCHES, TrayReturnRecord, compareBranchReturns, getBranchName } from "@/constants/branchOperations";

const nowIso = () => new Date().toISOString();

const demoRecords = (): TrayReturnRecord[] => [
  { id: "r1", orderId: "o1", orderNumber: 101, branchId: "main", customerName: "عميل تجريبي", customerPhone: "0500000000", insuranceAmount: 100, dueAt: nowIso(), status: "pending" },
  { id: "r2", orderId: "o2", orderNumber: 102, branchId: "north", customerName: "عميل شوكولاتة", customerPhone: "0500000001", insuranceAmount: 150, dueAt: nowIso(), returnedAt: nowIso(), status: "returned" },
  { id: "r3", orderId: "o3", orderNumber: 103, branchId: "south", customerName: "عميل كيك", customerPhone: "0500000002", insuranceAmount: 80, dueAt: nowIso(), status: "damaged", damage: { reason: "كسر في الصينية", note: "تم استلامها مكسورة", recordedAt: nowIso() } },
  { id: "r4", orderId: "o4", orderNumber: 104, branchId: "north", customerName: "عميل ضيافة", customerPhone: "0500000003", insuranceAmount: 120, dueAt: nowIso(), status: "expired" },
];

export function BranchReturnsDamagePanel() {
  const [records, setRecords] = useState<TrayReturnRecord[]>(demoRecords());
  const [branch, setBranch] = useState<BranchId | "all">("all");
  const [reason, setReason] = useState(DAMAGE_REASON_PRESETS[0]);
  const [note, setNote] = useState("");
  const [imageUri, setImageUri] = useState("");

  const stats = useMemo(() => compareBranchReturns(records), [records]);
  const visible = branch === "all" ? records : records.filter((r) => r.branchId === branch);

  const markReturned = (id: string) => setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status: "returned", returnedAt: nowIso() } : r));
  const markDamaged = (id: string) => {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status: "damaged", damage: { reason, note: note || undefined, imageUri: imageUri || undefined, recordedAt: nowIso() } } : r));
    setNote(""); setImageUri("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>إدارة الفروع والإرجاع والتلف</Text>
      <Text style={styles.subtitle}>متابعة الإكسباير، مقارنة الفروع الأكثر إرجاعًا، وتوثيق التلف بالصورة والملاحظة.</Text>

      <View style={styles.branchRow}>
        <TouchableOpacity style={[styles.branchChip, branch === "all" && styles.activeChip]} onPress={() => setBranch("all")}>
          <Text style={[styles.branchText, branch === "all" && styles.activeText]}>الكل</Text>
        </TouchableOpacity>
        {DEFAULT_BRANCHES.map((b) => (
          <TouchableOpacity key={b.id} style={[styles.branchChip, branch === b.id && styles.activeChip]} onPress={() => setBranch(b.id)}>
            <Text style={[styles.branchText, branch === b.id && styles.activeText]}>{b.nameAr}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>مقارنة الفروع</Text>
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.branch.id} style={styles.statCard}>
            <Text style={styles.statBranch}>{s.branch.nameAr}</Text>
            <Text style={styles.statNum}>{s.returned}</Text>
            <Text style={styles.statLabel}>مرتجع · خطورة {s.riskScore}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>تسجيل تلف</Text>
      <View style={styles.damageBox}>
        <View style={styles.reasonRow}>
          {DAMAGE_REASON_PRESETS.map((r) => (
            <TouchableOpacity key={r} style={[styles.reasonChip, reason === r && styles.damageActive]} onPress={() => setReason(r)}>
              <Text style={[styles.reasonText, reason === r && styles.damageActiveText]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="ملاحظة سبب التلف..." placeholderTextColor={Colors.textMuted} multiline textAlign="right" />
        <TextInput style={styles.input} value={imageUri} onChangeText={setImageUri} placeholder="رابط صورة التلف مؤقتًا" placeholderTextColor={Colors.textMuted} textAlign="right" />
      </View>

      <Text style={styles.sectionTitle}>سجلات الإرجاع والإكسباير</Text>
      {visible.map((r) => (
        <View key={r.id} style={[styles.recordCard, r.status === "returned" && styles.returned, r.status === "damaged" && styles.damaged, r.status === "expired" && styles.expired]}>
          <View style={styles.recordHead}>
            <Text style={styles.orderNo}>#{r.orderNumber}</Text>
            <Text style={styles.branchName}>{getBranchName(r.branchId)}</Text>
          </View>
          <Text style={styles.customer}>{r.customerName} · {r.customerPhone}</Text>
          <Text style={styles.amount}>{r.insuranceAmount.toFixed(2)} ر.س</Text>
          {r.damage?.imageUri ? <Image source={{ uri: r.damage.imageUri }} style={styles.damageImage} /> : null}
          {r.damage ? <Text style={styles.damageNote}>{r.damage.reason}{r.damage.note ? ` — ${r.damage.note}` : ""}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.returnBtn} onPress={() => markReturned(r.id)}>
              <Feather name="check-circle" size={13} color={Colors.success} />
              <Text style={styles.returnText}>تم الإرجاع</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.damageBtn} onPress={() => markDamaged(r.id)}>
              <Feather name="alert-triangle" size={13} color={Colors.accent} />
              <Text style={styles.damageText}>تسجيل تلف</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  branchRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  branchChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: Colors.border },
  activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  branchText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" },
  activeText: { color: "#fff" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right", marginTop: 4 },
  statsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statCard: { flexGrow: 1, minWidth: 120, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  statBranch: { fontSize: 12, fontWeight: "800", color: Colors.text, textAlign: "right" },
  statNum: { fontSize: 22, fontWeight: "900", color: Colors.gold, textAlign: "right" },
  statLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  damageBox: { gap: 8, padding: 10, borderRadius: 14, backgroundColor: Colors.accent + "08" },
  reasonRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  reasonChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  damageActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  reasonText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "700" },
  damageActiveText: { color: "#fff" },
  input: { minHeight: 42, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff", color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  recordCard: { gap: 7, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc", borderLeftWidth: 4, borderLeftColor: Colors.gold },
  returned: { borderLeftColor: Colors.success },
  damaged: { borderLeftColor: Colors.accent },
  expired: { borderLeftColor: Colors.warning },
  recordHead: { flexDirection: "row-reverse", justifyContent: "space-between" },
  orderNo: { fontSize: 15, fontWeight: "900", color: Colors.primary },
  branchName: { fontSize: 12, fontWeight: "800", color: Colors.textSecondary },
  customer: { fontSize: 12, color: Colors.text, textAlign: "right" },
  amount: { fontSize: 13, color: Colors.gold, fontWeight: "900", textAlign: "right" },
  damageImage: { height: 110, borderRadius: 12, backgroundColor: "#e5e7eb" },
  damageNote: { fontSize: 12, color: Colors.accent, textAlign: "right", lineHeight: 18 },
  actions: { flexDirection: "row-reverse", gap: 8 },
  returnBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.success + "12" },
  returnText: { fontSize: 12, color: Colors.success, fontWeight: "800" },
  damageBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.accent + "12" },
  damageText: { fontSize: 12, color: Colors.accent, fontWeight: "800" },
});
