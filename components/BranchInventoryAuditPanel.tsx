import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
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

const DEPT_META: Record<string, { color: string }> = {
  cake:      { color: Colors.cake },
  halwa:     { color: Colors.halwa },
  mawali:    { color: Colors.mawali },
  chocolate: { color: Colors.chocolate },
  packaging: { color: Colors.packaging },
};
const DEPT_ORDER = ["cake", "halwa", "mawali", "chocolate", "packaging"];

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
  const opening  = toNumber(draft?.opening);
  const received = toNumber(draft?.received);
  const sold     = toNumber(draft?.sold);
  const returned = toNumber(draft?.returned);
  const expired  = toNumber(draft?.expired);
  const damaged  = toNumber(draft?.damaged);
  const counted  = toNumber(draft?.counted);
  const expected = opening + received + returned - sold - expired - damaged;
  return {
    productId: product.id,
    name: product.name,
    department: product.department,
    opening, received, sold, returned, expired, damaged, expected, counted,
    variance: counted - expected,
    note: draft?.note?.trim() || undefined,
  };
}

function sumRows(rows: InventoryAuditRow[]) {
  const base = { opening: 0, received: 0, sold: 0, returned: 0, expired: 0, damaged: 0, expected: 0, counted: 0, variance: 0, availableItems: 0, outOfStockItems: 0 };
  return rows.reduce((totals, row) => {
    totals.opening += row.opening; totals.received += row.received; totals.sold += row.sold;
    totals.returned += row.returned; totals.expired += row.expired; totals.damaged += row.damaged;
    totals.expected += row.expected; totals.counted += row.counted; totals.variance += row.variance;
    if (row.counted > 0) totals.availableItems += 1;
    else totals.outOfStockItems += 1;
    return totals;
  }, base);
}

export function BranchInventoryAuditPanel() {
  const { companyId, company } = useCompany();
  const { currentEmployee } = useEmployee();
  const { products, isLoading } = useProducts();
  const { t } = useLang();

  const deptLabel: Record<string, string> = {
    cake: t("deptCakeShort"), halwa: t("deptHalwaShort"),
    mawali: t("deptMawaliShort"), chocolate: t("deptChocolateShort"),
    packaging: t("deptPackagingShort"),
  };
  const [branchName, setBranchName]   = useState(company.name);
  const [auditDate, setAuditDate]     = useState(todayISO());
  const [search, setSearch]           = useState("");
  const [drafts, setDrafts]           = useState<Record<string, InventoryEntryDraft>>({});
  const [savedAudits, setSavedAudits] = useState<BranchInventoryAudit[]>([]);
  const [loaded, setLoaded]           = useState(false);
  const [quickFilter, setQuickFilter] = useState<"all" | "available" | "out" | "variance">("all");

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey(companyId))
      .then((raw) => mounted && setSavedAudits(raw ? JSON.parse(raw) : []))
      .catch(() => mounted && setSavedAudits([]))
      .finally(() => mounted && setLoaded(true));
    return () => { mounted = false; };
  }, [companyId]);

  const rows    = useMemo(() => products.map((p) => buildRow(p, drafts[p.id])), [products, drafts]);
  const totals  = useMemo(() => sumRows(rows), [rows]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.isAvailable)
      .filter((p) => {
        const row = buildRow(p, drafts[p.id]);
        if (quickFilter === "available" && row.counted <= 0) return false;
        if (quickFilter === "out"       && row.counted > 0)  return false;
        if (quickFilter === "variance"  && row.variance === 0) return false;
        if (!q) return true;
        return `${p.name} ${p.nameEn ?? ""} ${p.category}`.toLowerCase().includes(q);
      })
      .slice(0, 90);
  }, [products, drafts, search, quickFilter]);

  // Group visible products by department for clear section rendering
  const groupedProducts = useMemo(() => {
    const groups: { dept: string; label: string; color: string; products: Product[] }[] = [];
    DEPT_ORDER.forEach((dept) => {
      const deptProducts = visibleProducts.filter((p) => p.department === dept);
      if (deptProducts.length > 0) {
        const meta = DEPT_META[dept] ?? { color: Colors.textMuted };
        groups.push({ dept, label: deptLabel[dept] ?? dept, ...meta, products: deptProducts });
      }
    });
    const remaining = visibleProducts.filter((p) => !DEPT_ORDER.includes(p.department));
    if (remaining.length > 0) groups.push({ dept: "other", label: t("invOtherDept"), color: Colors.textMuted, products: remaining });
    return groups;
  }, [visibleProducts]);

  const activeRows = useMemo(() =>
    rows.filter((r) => r.opening || r.received || r.sold || r.returned || r.expired || r.damaged || r.counted || r.note),
    [rows]);

  const updateDraft = (productId: string, key: keyof InventoryEntryDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
  };

  const persistAudits = async (next: BranchInventoryAudit[]) => {
    setSavedAudits(next);
    await AsyncStorage.setItem(storageKey(companyId), JSON.stringify(next));
  };

  const clearDraft = () => {
    setDrafts({}); setSearch(""); setQuickFilter("all"); setAuditDate(todayISO());
  };

  const saveAudit = async () => {
    if (!branchName.trim()) { Alert.alert(t("branchNamePh"), t("branchNamePh") + "..."); return; }
    if (!activeRows.length) { Alert.alert(t("invRecord"), t("invNoMatch")); return; }
    const activeTotals = sumRows(activeRows);
    const audit: BranchInventoryAudit = {
      id: `inventory-audit-${Date.now()}`,
      companyId, branchId: company.id, branchName: branchName.trim(),
      auditDate: auditDate || todayISO(), createdBy: currentEmployee?.name,
      rows: activeRows, totals: activeTotals, createdAt: new Date().toISOString(),
    };
    await persistAudits([audit, ...savedAudits].slice(0, 60));
    clearDraft();
    Alert.alert(t("invSave"), t("invSavedLocally"));
  };

  const duplicateAudit = (audit: BranchInventoryAudit) => {
    const nextDrafts: Record<string, InventoryEntryDraft> = {};
    audit.rows.forEach((row) => {
      nextDrafts[row.productId] = { opening: String(row.counted), received: "0", sold: "0", returned: "0", expired: "0", damaged: "0", counted: String(row.counted), note: row.note };
    });
    setBranchName(audit.branchName); setAuditDate(todayISO()); setDrafts(nextDrafts);
  };

  const removeAudit = async (id: string) => {
    await persistAudits(savedAudits.filter((a) => a.id !== id));
  };

  const renderProductCard = (product: Product, deptColor: string) => {
    const draft = drafts[product.id] || {};
    const row = buildRow(product, draft);
    const isAvailable = row.counted > 0;
    const varianceColor = row.variance === 0 ? Colors.success : row.variance < 0 ? Colors.accent : Colors.warning;

    return (
      <View key={product.id} style={[styles.productCard, { borderLeftColor: deptColor }]}>
        {/* ── Product header ── */}
        <View style={styles.productHeader}>
          {product.imageUri ? (
            <Image source={{ uri: product.imageUri }} style={styles.productThumb} contentFit="cover" />
          ) : (
            <View style={[styles.productThumbPlaceholder, { backgroundColor: deptColor + "22" }]}>
              <Feather name="package" size={16} color={deptColor} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productMeta}>{product.category}</Text>
          </View>
          <View style={[styles.stockPill, { backgroundColor: isAvailable ? Colors.success + "18" : Colors.accent + "12" }]}>
            <View style={[styles.stockDot, { backgroundColor: isAvailable ? Colors.success : Colors.accent }]} />
            <Text style={[styles.stockPillText, { color: isAvailable ? Colors.success : Colors.accent }]}>
              {isAvailable ? t("invAvailable") : t("invOutOfStock")}
            </Text>
          </View>
        </View>

        {/* ── Fields row 1: بداية / وارد / بيع / مرتجع ── */}
        <View style={styles.fieldsRow}>
          <AuditField label={t("invOpening")}   value={draft.opening}  onChange={(v) => updateDraft(product.id, "opening", v)} />
          <AuditField label={t("invIncoming")}    value={draft.received} onChange={(v) => updateDraft(product.id, "received", v)} color={Colors.info} />
          <AuditField label={t("invSold")}     value={draft.sold}     onChange={(v) => updateDraft(product.id, "sold", v)}     color={Colors.primary} />
          <AuditField label={t("invReturned")}   value={draft.returned} onChange={(v) => updateDraft(product.id, "returned", v)} color={Colors.warning} />
        </View>

        {/* ── Fields row 2: إكسباير / تالف / الفعلي ── */}
        <View style={styles.fieldsRow}>
          <AuditField label={t("invExpired")} value={draft.expired}  onChange={(v) => updateDraft(product.id, "expired", v)}  color={Colors.gold} />
          <AuditField label={t("invDamaged")}    value={draft.damaged}  onChange={(v) => updateDraft(product.id, "damaged", v)}   color={Colors.accent} />
          <View style={{ flex: 1 }} />
          <AuditField label={t("invActual")}  value={draft.counted}  onChange={(v) => updateDraft(product.id, "counted", v)}   color={deptColor} highlight />
        </View>

        {/* ── Computed summary ── */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("invExpected")}</Text>
            <Text style={styles.summaryValue}>{row.expected}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("invActual")}</Text>
            <Text style={styles.summaryValue}>{row.counted}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t("invVariance")}</Text>
            <View style={[styles.variancePill, { backgroundColor: varianceColor + "18" }]}>
              <Text style={[styles.varianceText, { color: varianceColor }]}>
                {row.variance > 0 ? `+${row.variance}` : row.variance}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Note ── */}
        <TextInput
          style={styles.noteInput}
          value={draft.note || ""}
          onChangeText={(v) => updateDraft(product.id, "note", v)}
          placeholder={t("varNotePh")}
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
      </View>
    );
  };

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="bar-chart-2" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{t("invTitle")}</Text>
          <Text style={styles.subtitle}>{t("invSubtitle")}</Text>
        </View>
      </View>

      {/* ── Metrics ── */}
      <View style={styles.metricsRow}>
        <MetricBox label={t("invAvailable")}   value={totals.availableItems}  color={Colors.success} />
        <MetricBox label={t("invOutOfStock")}   value={totals.outOfStockItems} color={Colors.accent} />
        <MetricBox label={t("invSold")}     value={totals.sold}            color={Colors.primary} />
        <MetricBox label={t("invReturned")}   value={totals.returned}        color={Colors.info} />
      </View>
      <View style={styles.metricsRow}>
        <MetricBox label={t("invExpired")} value={totals.expired}  color={Colors.gold} />
        <MetricBox label={t("invDamaged")}    value={totals.damaged}  color={Colors.accent} />
        <MetricBox label={t("invActual")}    value={totals.counted}  color={Colors.success} />
        <MetricBox label={t("invVariance")}     value={totals.variance} color={totals.variance === 0 ? Colors.success : Colors.accent} />
      </View>

      {/* ── Form inputs ── */}
      <View style={styles.formGrid}>
        <TextInput style={styles.input} value={branchName} onChangeText={setBranchName} placeholder={t("branchNamePh")} placeholderTextColor={Colors.textMuted} textAlign="right" />
        <TextInput style={[styles.input, { maxWidth: 130 }]} value={auditDate} onChangeText={setAuditDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} textAlign="center" />
      </View>

      {/* ── Search + filter ── */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t("searchProducts")}
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {(["all", "available", "out", "variance"] as const).map((f) => (
          <FilterChip
            key={f}
            label={{ all: t("statusAll"), available: t("invAvailable"), out: t("invOutOfStock"), variance: t("invFilterVariance") }[f]}
            active={quickFilter === f}
            onPress={() => setQuickFilter(f)}
          />
        ))}
      </View>

      {/* ── Product list grouped by dept ── */}
      <View style={styles.productsHeader}>
        <Text style={styles.sectionTitle}>{t("invRecord")}</Text>
        <Text style={styles.smallText}>{isLoading ? t("loading") : `${visibleProducts.length} ${t("invProduct")}`}</Text>
      </View>

      <ScrollView style={styles.productsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {groupedProducts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="inbox" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t("invNoMatch")}</Text>
          </View>
        ) : (
          groupedProducts.map(({ dept, label, color, products: deptProducts }) => {
            const deptRows = deptProducts.map((p) => buildRow(p, drafts[p.id]));
            const deptCounted  = deptRows.reduce((s, r) => s + r.counted, 0);
            const deptVariance = deptRows.reduce((s, r) => s + r.variance, 0);
            return (
              <View key={dept}>
                {/* Department section header */}
                <View style={[styles.deptHeader, { borderLeftColor: color, borderLeftWidth: 4 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.deptHeaderTitleRow}>
                      <View style={[styles.deptHeaderDot, { backgroundColor: color }]} />
                      <Text style={[styles.deptHeaderTitle, { color }]}>{label}</Text>
                      <Text style={styles.deptHeaderCount}>{deptProducts.length} {t("invItem")}</Text>
                    </View>
                  </View>
                  {(deptCounted > 0 || deptVariance !== 0) && (
                    <View style={styles.deptHeaderStats}>
                      {deptCounted > 0 && (
                        <Text style={[styles.deptStatChip, { color: Colors.success, backgroundColor: Colors.success + "12" }]}>
                          {t("invActual")} {deptCounted}
                        </Text>
                      )}
                      {deptVariance !== 0 && (
                        <Text style={[styles.deptStatChip, { color: deptVariance < 0 ? Colors.accent : Colors.warning, backgroundColor: (deptVariance < 0 ? Colors.accent : Colors.warning) + "12" }]}>
                          {t("invVariance")} {deptVariance > 0 ? `+${deptVariance}` : deptVariance}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {deptProducts.map((p) => renderProductCard(p, color))}
              </View>
            );
          })
        )}
        <View style={{ height: 8 }} />
      </ScrollView>

      {/* ── Actions ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={clearDraft} activeOpacity={0.85}>
          <Feather name="refresh-cw" size={15} color={Colors.primary} />
          <Text style={styles.secondaryBtnText}>{t("invClear")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={saveAudit} activeOpacity={0.85}>
          <Feather name="save" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>{t("invSave")}</Text>
        </TouchableOpacity>
      </View>

      {/* ── History ── */}
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>{t("invLastRecord")}</Text>
        <Text style={styles.smallText}>{loaded ? t("invSavedLocally") : t("loading")}</Text>
      </View>

      {savedAudits.slice(0, 8).map((audit) => (
        <View key={audit.id} style={styles.auditCard}>
          <View style={styles.auditTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.auditTitle}>{audit.branchName}</Text>
              <Text style={styles.auditMeta}>{audit.auditDate} · {audit.rows.length} {t("invProduct")} · {audit.createdBy || "—"}</Text>
            </View>
            <View style={[styles.auditBadge, { backgroundColor: (audit.totals.variance === 0 ? Colors.success : Colors.accent) + "18" }]}>
              <Text style={[styles.auditBadgeText, { color: audit.totals.variance === 0 ? Colors.success : Colors.accent }]}>
                {t("invVariance")} {audit.totals.variance > 0 ? `+${audit.totals.variance}` : audit.totals.variance}
              </Text>
            </View>
          </View>
          <Text style={styles.auditSummary}>
            {t("invSold")} {audit.totals.sold} · {t("invReturned")} {audit.totals.returned} · {t("invExpired")} {audit.totals.expired} · {t("invOutOfStock")} {audit.totals.outOfStockItems}
          </Text>
          <View style={styles.auditActions}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => duplicateAudit(audit)}>
              <Feather name="copy" size={12} color={Colors.primary} />
              <Text style={styles.miniBtnText}>{t("invSetAsOpening")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteMiniBtn} onPress={() => removeAudit(audit.id)}>
              <Feather name="trash-2" size={13} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

function AuditField({
  label, value, onChange, color, highlight,
}: {
  label: string; value?: string; onChange: (v: string) => void; color?: string; highlight?: boolean;
}) {
  const borderColor = color ? color + "55" : Colors.border;
  const bg = highlight && color ? color + "0D" : Colors.surfaceSecondary;
  return (
    <View style={[styles.auditField, { borderColor: highlight ? borderColor : Colors.border, backgroundColor: bg }]}>
      <Text style={[styles.auditFieldLabel, color && { color }]}>{label}</Text>
      <TextInput
        style={[styles.auditFieldInput, highlight && { fontWeight: "900", color: color }]}
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

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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

  // header
  headerRow: { flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary + "12" },
  title: { fontSize: 17, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 18 },

  // metrics
  metricsRow: { flexDirection: "row", gap: 8 },
  metricBox: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 10, alignItems: "center", gap: 3 },
  metricValue: { fontSize: 20, fontWeight: "900" },
  metricLabel: { fontSize: 9, fontWeight: "700", color: Colors.textMuted },

  // form
  formGrid: { flexDirection: "row", gap: 10 },
  input: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 12, color: Colors.text, fontWeight: "700" },

  // search
  searchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, height: 46, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 13 },

  // filter
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  filterChip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "700" },
  filterChipTextActive: { color: "#fff" },

  // section header
  productsHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  smallText: { fontSize: 11, fontWeight: "600", color: Colors.textMuted },

  // product list
  productsList: { maxHeight: 560, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },

  // department section header
  deptHeader: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  deptHeaderTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  deptHeaderDot: { width: 10, height: 10, borderRadius: 5 },
  deptHeaderTitle: { fontSize: 14, fontWeight: "900" },
  deptHeaderCount: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  deptHeaderStats: { flexDirection: "row-reverse", gap: 6 },
  deptStatChip: { fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  // product card
  productCard: {
    gap: 10, padding: 12,
    borderLeftWidth: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: "#fff",
  },
  productHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  productThumb: { width: 44, height: 44, borderRadius: 10 },
  productThumbPlaceholder: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right" },
  productMeta: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  stockPill: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  stockDot: { width: 7, height: 7, borderRadius: 4 },
  stockPillText: { fontSize: 11, fontWeight: "800" },

  // audit fields
  fieldsRow: { flexDirection: "row-reverse", gap: 8 },
  auditField: { flex: 1, borderRadius: 10, borderWidth: 1.5, padding: 6, gap: 4 },
  auditFieldLabel: { fontSize: 9, fontWeight: "800", color: Colors.textMuted, textAlign: "center", textTransform: "uppercase" as const },
  auditFieldInput: { minHeight: 28, color: Colors.primary, fontWeight: "700", padding: 0, fontSize: 14 },

  // summary strip
  summaryStrip: { flexDirection: "row-reverse", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6 },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryLabel: { fontSize: 9, fontWeight: "700", color: Colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: "900", color: Colors.text },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },
  variancePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  varianceText: { fontSize: 13, fontWeight: "900" },

  // note
  noteInput: {
    height: 36, borderRadius: 10, backgroundColor: Colors.surfaceSecondary,
    color: Colors.text, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, fontSize: 11,
  },

  // empty
  emptyBox: { alignItems: "center", justifyContent: "center", gap: 8, padding: 36 },
  emptyText: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },

  // actions
  actionsRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 2, height: 48, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.primary + "10", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryBtnText: { color: Colors.primary, fontSize: 13, fontWeight: "900" },

  // history header
  historyHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 4 },

  // audit history cards
  auditCard: { gap: 8, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, padding: 12 },
  auditTopRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 10, alignItems: "center" },
  auditTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  auditMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  auditBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  auditBadgeText: { fontSize: 10, fontWeight: "900" },
  auditSummary: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },
  auditActions: { flexDirection: "row-reverse", gap: 7 },
  miniBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  miniBtnText: { color: Colors.primary, fontSize: 10, fontWeight: "800" },
  deleteMiniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent + "10", alignItems: "center", justifyContent: "center" },
});
