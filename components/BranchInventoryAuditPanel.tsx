import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { Product, useProducts } from "@/context/ProductsContext";

interface InventoryEntryDraft {
  opening?: string;
  received?: string;
  sold?: string;
  returned?: string;
  expired?: string;
  damaged?: string;
  counted?: string;
  note?: string;
}

interface InventoryAuditRow {
  productId: string;
  name: string;
  department: string;
  opening: number;
  received: number;
  sold: number;
  returned: number;
  expired: number;
  damaged: number;
  expected: number;
  counted: number;
  variance: number;
  note?: string;
}

interface BranchInventoryAudit {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  auditDate: string;
  createdBy?: string;
  rows: InventoryAuditRow[];
  totals: {
    opening: number;
    received: number;
    sold: number;
    returned: number;
    expired: number;
    damaged: number;
    expected: number;
    counted: number;
    variance: number;
    availableItems: number;
    outOfStockItems: number;
  };
  createdAt: string;
}

const STORAGE_PREFIX = "@fawtara_branch_inventory_audit_v1";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(companyId: string) {
  return `${STORAGE_PREFIX}_${companyId}`;
}

function toNumber(value?: string) {
  const parsed = Number(String(value || "0").replace(/,/g, "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function buildRow(product: Product, draft?: InventoryEntryDraft): InventoryAuditRow {
  const opening = toNumber(draft?.opening);
  const received = toNumber(draft?.received);
  const sold = toNumber(draft?.sold);
  const returned = toNumber(draft?.returned);
  const expired = toNumber(draft?.expired);
  const damaged = toNumber(draft?.damaged);
  const counted = toNumber(draft?.counted);
  const expected = opening + received + returned - sold - expired - damaged;
  const variance = counted - expected;
  return {
    productId: product.id,
    name: product.name,
    department: product.department,
    opening,
    received,
    sold,
    returned,
    expired,
    damaged,
    expected,
    counted,
    variance,
    note: draft?.note?.trim() || undefined,
  };
}

function sumRows(rows: InventoryAuditRow[]) {
  const base = {
    opening: 0,
    received: 0,
    sold: 0,
    returned: 0,
    expired: 0,
    damaged: 0,
    expected: 0,
    counted: 0,
    variance: 0,
    availableItems: 0,
    outOfStockItems: 0,
  };

  return rows.reduce((totals, row) => {
    totals.opening += row.opening;
    totals.received += row.received;
    totals.sold += row.sold;
    totals.returned += row.returned;
    totals.expired += row.expired;
    totals.damaged += row.damaged;
    totals.expected += row.expected;
    totals.counted += row.counted;
    totals.variance += row.variance;
    if (row.counted > 0) totals.availableItems += 1;
    if (row.counted <= 0) totals.outOfStockItems += 1;
    return totals;
  }, base);
}

export function BranchInventoryAuditPanel() {
  const { companyId, company } = useCompany();
  const { currentEmployee } = useEmployee();
  const { products, isLoading } = useProducts();
  const [branchName, setBranchName] = useState(company.name);
  const [auditDate, setAuditDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, InventoryEntryDraft>>({});
  const [savedAudits, setSavedAudits] = useState<BranchInventoryAudit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [quickFilter, setQuickFilter] = useState<"all" | "available" | "out" | "variance">("all");

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey(companyId))
      .then((raw) => {
        if (!mounted) return;
        setSavedAudits(raw ? JSON.parse(raw) : []);
      })
      .catch(() => mounted && setSavedAudits([]))
      .finally(() => mounted && setLoaded(true));
    return () => { mounted = false; };
  }, [companyId]);

  const rows = useMemo(() => products.map((product) => buildRow(product, drafts[product.id])), [products, drafts]);
  const totals = useMemo(() => sumRows(rows), [rows]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((product) => product.isAvailable)
      .filter((product) => {
        const row = buildRow(product, drafts[product.id]);
        if (quickFilter === "available" && row.counted <= 0) return false;
        if (quickFilter === "out" && row.counted > 0) return false;
        if (quickFilter === "variance" && row.variance === 0) return false;
        if (!q) return true;
        return `${product.name} ${product.nameEn ?? ""} ${product.category}`.toLowerCase().includes(q);
      })
      .slice(0, 90);
  }, [products, drafts, search, quickFilter]);

  const activeRows = useMemo(() => rows.filter((row) => {
    return row.opening || row.received || row.sold || row.returned || row.expired || row.damaged || row.counted || row.note;
  }), [rows]);

  const updateDraft = (productId: string, key: keyof InventoryEntryDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [key]: value,
      },
    }));
  };

  const persistAudits = async (next: BranchInventoryAudit[]) => {
    setSavedAudits(next);
    await AsyncStorage.setItem(storageKey(companyId), JSON.stringify(next));
  };

  const clearDraft = () => {
    setDrafts({});
    setSearch("");
    setQuickFilter("all");
    setAuditDate(todayISO());
  };

  const saveAudit = async () => {
    if (!branchName.trim()) {
      Alert.alert("مطلوب", "أدخل اسم الفرع قبل حفظ الجرد.");
      return;
    }
    if (!activeRows.length) {
      Alert.alert("لا توجد بيانات", "أدخل بيانات جرد أو بيع أو مرتجع لمنتج واحد على الأقل.");
      return;
    }

    const activeTotals = sumRows(activeRows);
    const audit: BranchInventoryAudit = {
      id: `inventory-audit-${Date.now()}`,
      companyId,
      branchId: company.id,
      branchName: branchName.trim(),
      auditDate: auditDate || todayISO(),
      createdBy: currentEmployee?.name,
      rows: activeRows,
      totals: activeTotals,
      createdAt: new Date().toISOString(),
    };

    await persistAudits([audit, ...savedAudits].slice(0, 60));
    clearDraft();
    Alert.alert("تم حفظ الجرد", "تم حفظ جرد الفرع اليومي وحساب المتوفر والخلصان والبيع والمرتجع والإكسباير.");
  };

  const duplicateAudit = (audit: BranchInventoryAudit) => {
    const nextDrafts: Record<string, InventoryEntryDraft> = {};
    audit.rows.forEach((row) => {
      nextDrafts[row.productId] = {
        opening: String(row.counted),
        received: "0",
        sold: "0",
        returned: "0",
        expired: "0",
        damaged: "0",
        counted: String(row.counted),
        note: row.note,
      };
    });
    setBranchName(audit.branchName);
    setAuditDate(todayISO());
    setDrafts(nextDrafts);
  };

  const removeAudit = async (id: string) => {
    await persistAudits(savedAudits.filter((audit) => audit.id !== id));
  };

  const renderMetric = (label: string, value: number, color = Colors.primary) => (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const renderProductRow = (product: Product) => {
    const draft = drafts[product.id] || {};
    const row = buildRow(product, draft);
    const stockColor = row.counted > 0 ? Colors.success : Colors.accent;
    return (
      <View key={product.id} style={styles.productCard}>
        <View style={styles.productTopRow}>
          <View style={styles.stockBadge}>
            <Text style={[styles.stockBadgeText, { color: stockColor }]}>{row.counted > 0 ? "متوفر" : "خلصان"}</Text>
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productMeta}>{product.category} · {product.department}</Text>
          </View>
        </View>

        <View style={styles.fieldsGrid}>
          <AuditInput label="بداية" value={draft.opening} onChange={(value) => updateDraft(product.id, "opening", value)} />
          <AuditInput label="وارد" value={draft.received} onChange={(value) => updateDraft(product.id, "received", value)} />
          <AuditInput label="بيع" value={draft.sold} onChange={(value) => updateDraft(product.id, "sold", value)} />
          <AuditInput label="مرتجع" value={draft.returned} onChange={(value) => updateDraft(product.id, "returned", value)} />
          <AuditInput label="إكسباير" value={draft.expired} onChange={(value) => updateDraft(product.id, "expired", value)} />
          <AuditInput label="تالف" value={draft.damaged} onChange={(value) => updateDraft(product.id, "damaged", value)} />
          <AuditInput label="فعلي" value={draft.counted} onChange={(value) => updateDraft(product.id, "counted", value)} highlight />
        </View>

        <View style={styles.computedRow}>
          <Text style={styles.computedText}>المفترض: {row.expected}</Text>
          <Text style={[styles.computedText, { color: row.variance === 0 ? Colors.success : Colors.accent }]}>الفرق: {row.variance}</Text>
        </View>

        <TextInput
          style={styles.noteInput}
          value={draft.note || ""}
          onChangeText={(value) => updateDraft(product.id, "note", value)}
          placeholder="ملاحظة للجرد أو سبب الفرق"
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="bar-chart-2" size={20} color={Colors.primary} />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>لوحة جرد الفرع والمخزون</Text>
          <Text style={styles.subtitle}>تابع المتوفر والخلصان، واحسب البيع والمرتجع والإكسباير والتالف والفرق اليومي.</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {renderMetric("متوفر", totals.availableItems, Colors.success)}
        {renderMetric("خلصان", totals.outOfStockItems, Colors.accent)}
        {renderMetric("بيع", totals.sold, Colors.primary)}
        {renderMetric("مرتجع", totals.returned, Colors.info)}
      </View>
      <View style={styles.metricsRow}>
        {renderMetric("إكسباير", totals.expired, Colors.gold)}
        {renderMetric("تالف", totals.damaged, Colors.accent)}
        {renderMetric("فعلي", totals.counted, Colors.success)}
        {renderMetric("فرق", totals.variance, totals.variance === 0 ? Colors.success : Colors.accent)}
      </View>

      <View style={styles.formGrid}>
        <TextInput style={styles.input} value={branchName} onChangeText={setBranchName} placeholder="اسم الفرع" placeholderTextColor={Colors.textMuted} textAlign="right" />
        <TextInput style={styles.input} value={auditDate} onChangeText={setAuditDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} textAlign="center" />
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="بحث عن منتج للجرد..."
        placeholderTextColor={Colors.textMuted}
        textAlign="right"
      />

      <View style={styles.filterRow}>
        <FilterChip label="الكل" active={quickFilter === "all"} onPress={() => setQuickFilter("all")} />
        <FilterChip label="متوفر" active={quickFilter === "available"} onPress={() => setQuickFilter("available")} />
        <FilterChip label="خلصان" active={quickFilter === "out"} onPress={() => setQuickFilter("out")} />
        <FilterChip label="فيه فرق" active={quickFilter === "variance"} onPress={() => setQuickFilter("variance")} />
      </View>

      <View style={styles.productsHeader}>
        <Text style={styles.sectionTitle}>سجل الجرد اليومي</Text>
        <Text style={styles.smallText}>{isLoading ? "جاري التحميل..." : `${visibleProducts.length} منتج`}</Text>
      </View>

      <ScrollView style={styles.productsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {visibleProducts.length ? visibleProducts.map(renderProductRow) : (
          <View style={styles.emptyBox}>
            <Feather name="inbox" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد منتجات مطابقة للجرد.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={clearDraft} activeOpacity={0.85}>
          <Feather name="refresh-cw" size={15} color={Colors.primary} />
          <Text style={styles.secondaryBtnText}>تفريغ المسودة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={saveAudit} activeOpacity={0.85}>
          <Feather name="save" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>حفظ جرد اليوم</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>آخر الجرد</Text>
        <Text style={styles.smallText}>{loaded ? "محفوظ محليًا لهذا الفرع" : "جاري التحميل..."}</Text>
      </View>

      {savedAudits.slice(0, 8).map((audit) => (
        <View key={audit.id} style={styles.auditCard}>
          <View style={styles.auditTopRow}>
            <View>
              <Text style={styles.auditTitle}>{audit.branchName}</Text>
              <Text style={styles.auditMeta}>{audit.auditDate} · {audit.rows.length} منتج · {audit.createdBy || "غير محدد"}</Text>
            </View>
            <View style={styles.auditBadge}>
              <Text style={styles.auditBadgeText}>فرق {audit.totals.variance}</Text>
            </View>
          </View>
          <Text style={styles.auditSummary}>بيع {audit.totals.sold} · مرتجع {audit.totals.returned} · إكسباير {audit.totals.expired} · خلصان {audit.totals.outOfStockItems}</Text>
          <View style={styles.auditActions}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => duplicateAudit(audit)}><Text style={styles.miniBtnText}>فتح كبداية اليوم</Text></TouchableOpacity>
            <TouchableOpacity style={styles.deleteMiniBtn} onPress={() => removeAudit(audit.id)}><Feather name="trash-2" size={13} color={Colors.accent} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

function AuditInput({ label, value, onChange, highlight }: { label: string; value?: string; onChange: (value: string) => void; highlight?: boolean }) {
  return (
    <View style={[styles.auditInputBox, highlight && styles.auditInputHighlight]}>
      <Text style={styles.auditInputLabel}>{label}</Text>
      <TextInput
        style={styles.auditInput}
        value={value || ""}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
        textAlign="center"
      />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary + "12" },
  headerTextBlock: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, fontWeight: "600", color: Colors.textMuted, textAlign: "right", lineHeight: 19 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricBox: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 10, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 18, fontWeight: "900" },
  metricLabel: { fontSize: 10, fontWeight: "700", color: Colors.textMuted, textAlign: "center" },
  formGrid: { flexDirection: "row", gap: 10 },
  input: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#f8fafc", paddingHorizontal: 12, color: Colors.text, fontWeight: "700" },
  searchInput: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#f8fafc", paddingHorizontal: 12, color: Colors.text },
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  filterChip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "800" },
  filterChipTextActive: { color: "#fff" },
  productsHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  smallText: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  productsList: { maxHeight: 520, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  productCard: { gap: 9, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: "#fff" },
  productTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  stockBadge: { minWidth: 58, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: Colors.surfaceSecondary, alignItems: "center" },
  stockBadgeText: { fontSize: 10, fontWeight: "900" },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  productMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right" },
  fieldsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  auditInputBox: { width: 72, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, padding: 6, gap: 4 },
  auditInputHighlight: { borderColor: Colors.success + "70", backgroundColor: Colors.success + "08" },
  auditInputLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: "900", textAlign: "center" },
  auditInput: { minHeight: 28, color: Colors.primary, fontWeight: "900", padding: 0 },
  computedRow: { flexDirection: "row-reverse", justifyContent: "space-between", backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  computedText: { fontSize: 11, fontWeight: "900", color: Colors.textSecondary },
  noteInput: { minHeight: 38, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, color: Colors.text, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, fontSize: 11 },
  emptyBox: { alignItems: "center", justifyContent: "center", gap: 8, padding: 28 },
  emptyText: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1.3, minHeight: 46, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: Colors.primary + "10", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryBtnText: { color: Colors.primary, fontSize: 13, fontWeight: "900" },
  historyHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  auditCard: { gap: 8, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#f8fafc", padding: 12 },
  auditTopRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 10, alignItems: "center" },
  auditTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  auditMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  auditBadge: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: Colors.gold + "18" },
  auditBadgeText: { fontSize: 10, fontWeight: "900", color: Colors.gold },
  auditSummary: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },
  auditActions: { flexDirection: "row-reverse", gap: 7, flexWrap: "wrap" },
  miniBtn: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  miniBtnText: { color: Colors.primary, fontSize: 10, fontWeight: "800" },
  deleteMiniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent + "10", alignItems: "center", justifyContent: "center" },
});
