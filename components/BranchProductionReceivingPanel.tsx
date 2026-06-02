import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { BranchOpsBaseRecord, loadLocalBranchOps, saveLocalBranchOps } from "@/lib/branchOpsStore";

const REQUESTS_PREFIX = "@fawtara_branch_daily_requests_v1";

type RequestStatus = "new" | "sent" | "preparing" | "completed" | "received" | "partial_received";

interface BranchRequestItem {
  productId: string;
  name: string;
  department: string;
  quantity: number;
  note?: string;
}

interface BranchProductionRequest extends BranchOpsBaseRecord {
  branchId: string;
  branchName: string;
  requestDate: string;
  requestedBy?: string;
  requestedById?: string;
  status: RequestStatus;
  items: BranchRequestItem[];
  receivedAt?: string;
  receivedBy?: string;
  receivedById?: string;
  receivedMatchedNote?: string;
  receivedShortageNote?: string;
  receivedSummary?: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "مسودة",
  sent: "مرسلة للمصنع",
  preparing: "قيد التجهيز",
  completed: "تم التوفير",
  received: "تم الاستلام مطابق",
  partial_received: "استلام مع نواقص",
};

const STATUS_COLORS: Record<string, string> = {
  new: Colors.textMuted,
  sent: Colors.info,
  preparing: Colors.gold,
  completed: Colors.success,
  received: Colors.success,
  partial_received: Colors.accent,
};

function formatDateTime(value?: string) {
  if (!value) return "لم يتم الاستلام";
  try {
    return new Date(value).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function buildSummary(matched: string, shortage: string) {
  const cleanMatched = matched.trim();
  const cleanShortage = shortage.trim();
  if (cleanMatched && cleanShortage) return `المطابق: ${cleanMatched} | الناقص: ${cleanShortage}`;
  if (cleanMatched) return `المطابق: ${cleanMatched}`;
  if (cleanShortage) return `الناقص: ${cleanShortage}`;
  return "تم تسجيل الاستلام بدون ملاحظات.";
}

export function BranchProductionReceivingPanel() {
  const { t } = useLang();
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const [requests, setRequests] = useState<BranchProductionRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchedNote, setMatchedNote] = useState("");
  const [shortageNote, setShortageNote] = useState("");

  const refresh = async () => {
    const records = await loadLocalBranchOps<BranchProductionRequest>(REQUESTS_PREFIX, companyId);
    setRequests(records);
    setSelectedId((current) => current || records[0]?.id || null);
    setLoaded(true);
  };

  useEffect(() => {
    let mounted = true;
    loadLocalBranchOps<BranchProductionRequest>(REQUESTS_PREFIX, companyId)
      .then((records) => {
        if (!mounted) return;
        setRequests(records);
        setSelectedId(records[0]?.id || null);
      })
      .catch(() => mounted && setRequests([]))
      .finally(() => mounted && setLoaded(true));
    return () => { mounted = false; };
  }, [companyId]);

  const selected = useMemo(() => requests.find((request) => request.id === selectedId) || requests[0], [requests, selectedId]);
  const totalRequested = selected?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ?? 0;

  const saveReceipt = async (mode: "received" | "partial_received") => {
    if (!selected) {
      Alert.alert(t("warningTitle"), "لا توجد طلبية محفوظة لتسجيل الاستلام.");
      return;
    }

    const now = new Date().toISOString();
    const summary = buildSummary(matchedNote, shortageNote);
    const next = requests.map((request) => request.id === selected.id ? {
      ...request,
      status: mode,
      receivedAt: now,
      receivedBy: currentEmployee?.name || "غير محدد",
      receivedById: currentEmployee?.employeeId,
      receivedMatchedNote: matchedNote.trim() || undefined,
      receivedShortageNote: shortageNote.trim() || undefined,
      receivedSummary: summary,
      syncStatus: request.syncStatus || "local",
    } : request);

    await saveLocalBranchOps(REQUESTS_PREFIX, companyId, next);
    setRequests(next);
    setMatchedNote("");
    setShortageNote("");
    Alert.alert(t("successTitle"), mode === "received" ? "تم تسجيل أن الطلبية وصلت مطابقة." : "تم تسجيل الاستلام مع توضيح النواقص.");
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="check-square" size={20} color={Colors.success} />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>استلام طلبية الفرع</Text>
          <Text style={styles.subtitle}>سجل ما وصل مطابقًا وما هو ناقص، مع وقت الاستلام ومقدم الطلب تلقائيًا.</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refresh} activeOpacity={0.85}>
          <Text style={styles.refreshText}>{loaded ? "تحديث" : "..."}</Text>
        </TouchableOpacity>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="inbox" size={30} color={Colors.textMuted} />
          <Text style={styles.emptyText}>لا توجد طلبيات محفوظة للاستلام.</Text>
          <Text style={styles.emptySubText}>أنشئ طلبية من لوحة “طلبية الفرع اليومية من المصنع” أولًا.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.requestChips}>
            {requests.slice(0, 12).map((request) => {
              const active = selected?.id === request.id;
              const color = STATUS_COLORS[request.status] || Colors.textMuted;
              return (
                <TouchableOpacity key={request.id} style={[styles.requestChip, active && { borderColor: color, backgroundColor: color + "12" }]} onPress={() => setSelectedId(request.id)} activeOpacity={0.85}>
                  <Text style={[styles.requestChipTitle, active && { color }]} numberOfLines={1}>{request.branchName}</Text>
                  <Text style={styles.requestChipSub}>{request.requestDate}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selected ? (
            <View style={styles.selectedBox}>
              <View style={styles.selectedTopRow}>
                <View>
                  <Text style={styles.selectedTitle}>{selected.branchName}</Text>
                  <Text style={styles.selectedMeta}>تاريخ الطلب: {selected.requestDate} · إجمالي الكمية: {totalRequested}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selected.status] || Colors.textMuted) + "16" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[selected.status] || Colors.textMuted }]}>{STATUS_LABELS[selected.status] || selected.status}</Text>
                </View>
              </View>

              <View style={styles.autoInfoGrid}>
                <InfoBox label="مقدم الطلب" value={selected.requestedBy || "تلقائيًا من اليوزر"} icon="user" />
                <InfoBox label="مستلم الطلبية" value={selected.receivedBy || currentEmployee?.name || "سيتم تسجيله تلقائيًا"} icon="user-check" />
                <InfoBox label="وقت الاستلام" value={formatDateTime(selected.receivedAt)} icon="clock" />
              </View>

              <View style={styles.itemsBox}>
                <Text style={styles.sectionTitle}>بنود الطلبية</Text>
                {selected.items.slice(0, 8).map((item) => (
                  <View key={item.productId} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>× {item.quantity}</Text>
                  </View>
                ))}
                {selected.items.length > 8 ? <Text style={styles.moreItems}>+ {selected.items.length - 8} بنود أخرى</Text> : null}
              </View>

              <TextInput
                style={styles.textArea}
                value={matchedNote}
                onChangeText={setMatchedNote}
                placeholder="ما وصل مطابقًا؟ مثال: وصلت كل كمية الحلا والشوكولاتة مطابقة"
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlign="right"
              />

              <TextInput
                style={styles.textArea}
                value={shortageNote}
                onChangeText={setShortageNote}
                placeholder="ما هو ناقص؟ مثال: ناقص 3 كيكات، أو لم تصل المعجنات"
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlign="right"
              />

              {selected.receivedSummary ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>آخر توضيح استلام</Text>
                  <Text style={styles.summaryText}>{selected.receivedSummary}</Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.partialBtn} onPress={() => saveReceipt("partial_received")} activeOpacity={0.85}>
                  <Feather name="alert-circle" size={15} color="#fff" />
                  <Text style={styles.actionText}>استلام مع نواقص</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.receivedBtn} onPress={() => saveReceipt("received")} activeOpacity={0.85}>
                  <Feather name="check-circle" size={15} color="#fff" />
                  <Text style={styles.actionText}>استلام مطابق</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={styles.infoBox}>
      <Feather name={icon} size={14} color={Colors.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row-reverse", gap: 10, alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.success + "14" },
  headerTextBlock: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, fontWeight: "600", color: Colors.textMuted, textAlign: "right", lineHeight: 19 },
  refreshBtn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.success + "14" },
  refreshText: { color: Colors.success, fontSize: 11, fontWeight: "900" },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 28, backgroundColor: Colors.surfaceSecondary, borderRadius: 18 },
  emptyText: { fontSize: 13, fontWeight: "900", color: Colors.textSecondary, textAlign: "center" },
  emptySubText: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textAlign: "center" },
  requestChips: { gap: 8, paddingVertical: 2 },
  requestChip: { minWidth: 118, gap: 3, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  requestChipTitle: { fontSize: 12, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  requestChipSub: { fontSize: 10, fontWeight: "700", color: Colors.textMuted, textAlign: "right" },
  selectedBox: { gap: 12, borderRadius: 18, padding: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  selectedTopRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 10 },
  selectedTitle: { fontSize: 15, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  selectedMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 3, fontWeight: "700" },
  statusBadge: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "900" },
  autoInfoGrid: { flexDirection: "row", gap: 8 },
  infoBox: { flex: 1, gap: 4, alignItems: "center", borderRadius: 14, padding: 9, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  infoLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: "900", textAlign: "center" },
  infoValue: { fontSize: 10, color: Colors.textSecondary, fontWeight: "800", textAlign: "center", lineHeight: 15 },
  itemsBox: { gap: 7, padding: 10, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  itemRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 5 },
  itemName: { flex: 1, fontSize: 11, color: Colors.textSecondary, fontWeight: "800", textAlign: "right" },
  itemQty: { fontSize: 11, color: Colors.primary, fontWeight: "900" },
  moreItems: { fontSize: 10, color: Colors.textMuted, fontWeight: "800", textAlign: "center" },
  textArea: { minHeight: 72, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontSize: 12, fontWeight: "700", textAlignVertical: "top" },
  summaryBox: { gap: 4, padding: 10, borderRadius: 14, backgroundColor: Colors.info + "10", borderWidth: 1, borderColor: Colors.info + "25" },
  summaryTitle: { fontSize: 11, fontWeight: "900", color: Colors.info, textAlign: "right" },
  summaryText: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10 },
  partialBtn: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: Colors.accent, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  receivedBtn: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: Colors.success, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});
