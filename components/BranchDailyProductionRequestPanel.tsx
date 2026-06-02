import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Product, useProducts } from "@/context/ProductsContext";

type BranchRequestStatus = "new" | "sent" | "preparing" | "completed";

interface BranchRequestItem {
  productId: string;
  name: string;
  department: string;
  quantity: number;
  note?: string;
}

interface BranchProductionRequest {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  requestDate: string;
  requestedBy?: string;
  status: BranchRequestStatus;
  items: BranchRequestItem[];
  createdAt: string;
}

const STORAGE_PREFIX = "@fawtara_branch_daily_requests_v1";
const STATUS_LABELS: Record<BranchRequestStatus, string> = {
  new: "مسودة",
  sent: "مرسلة للمصنع",
  preparing: "قيد التجهيز",
  completed: "تم التوفير",
};

const STATUS_COLORS: Record<BranchRequestStatus, string> = {
  new: Colors.textMuted,
  sent: Colors.info,
  preparing: Colors.gold,
  completed: Colors.success,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(companyId: string) {
  return `${STORAGE_PREFIX}_${companyId}`;
}

function normalizeQty(value: string) {
  const parsed = Number(value.replace(/,/g, "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function BranchDailyProductionRequestPanel() {
  const { t } = useLang();
  const { companyId, company } = useCompany();
  const { currentEmployee } = useEmployee();
  const { products, isLoading } = useProducts();
  const [branchName, setBranchName] = useState(company.name);
  const [requestDate, setRequestDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedRequests, setSavedRequests] = useState<BranchProductionRequest[]>([]);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey(companyId))
      .then((raw) => {
        if (!mounted) return;
        setSavedRequests(raw ? JSON.parse(raw) : []);
      })
      .catch(() => mounted && setSavedRequests([]))
      .finally(() => mounted && setLoaded(true));
    return () => { mounted = false; };
  }, [companyId]);

  const availableProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((product) => product.isAvailable)
      .filter((product) => {
        if (!q) return true;
        return `${product.name} ${product.nameEn ?? ""} ${product.category}`.toLowerCase().includes(q);
      })
      .slice(0, 80);
  }, [products, search]);

  const requestItems = useMemo<BranchRequestItem[]>(() => {
    return products
      .map((product) => {
        const quantity = normalizeQty(quantities[product.id] || "0");
        if (quantity <= 0) return null;
        return {
          productId: product.id,
          name: product.name,
          department: product.department,
          quantity,
          note: notes[product.id]?.trim() || undefined,
        };
      })
      .filter(Boolean) as BranchRequestItem[];
  }, [products, quantities, notes]);

  const totalQuantity = requestItems.reduce((sum, item) => sum + item.quantity, 0);

  const persistRequests = async (next: BranchProductionRequest[]) => {
    setSavedRequests(next);
    await AsyncStorage.setItem(storageKey(companyId), JSON.stringify(next));
  };

  const clearDraft = () => {
    setQuantities({});
    setNotes({});
    setSearch("");
    setRequestDate(todayISO());
  };

  const submitRequest = async () => {
    if (!branchName.trim()) {
      Alert.alert(t("requiredTitle"), "أدخل اسم الفرع أو الجهة الطالبة.");
      return;
    }
    if (!requestItems.length) {
      Alert.alert(t("warningTitle"), "أدخل كمية لمنتج واحد على الأقل قبل إرسال الطلبية.");
      return;
    }

    const request: BranchProductionRequest = {
      id: `branch-request-${Date.now()}`,
      companyId,
      branchId: company.id,
      branchName: branchName.trim(),
      requestDate: requestDate || todayISO(),
      requestedBy: currentEmployee?.name,
      status: "sent",
      items: requestItems,
      createdAt: new Date().toISOString(),
    };

    await persistRequests([request, ...savedRequests].slice(0, 60));
    clearDraft();
    Alert.alert(t("successTitle"), "تم حفظ طلبية الفرع اليومية وتجهيزها للمصنع.");
  };

  const updateStatus = async (id: string, status: BranchRequestStatus) => {
    await persistRequests(savedRequests.map((request) => request.id === id ? { ...request, status } : request));
  };

  const duplicateRequest = (request: BranchProductionRequest) => {
    const nextQuantities: Record<string, string> = {};
    const nextNotes: Record<string, string> = {};
    request.items.forEach((item) => {
      nextQuantities[item.productId] = String(item.quantity);
      if (item.note) nextNotes[item.productId] = item.note;
    });
    setBranchName(request.branchName);
    setRequestDate(todayISO());
    setQuantities(nextQuantities);
    setNotes(nextNotes);
  };

  const removeRequest = async (id: string) => {
    await persistRequests(savedRequests.filter((request) => request.id !== id));
  };

  const renderProductRow = (product: Product) => {
    const qty = quantities[product.id] || "";
    return (
      <View key={product.id} style={styles.productRow}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productMeta}>{product.category} · {product.department}</Text>
        </View>
        <TextInput
          style={styles.qtyInput}
          value={qty}
          onChangeText={(value) => setQuantities((current) => ({ ...current, [product.id]: value }))}
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          textAlign="center"
        />
        <TextInput
          style={styles.noteInput}
          value={notes[product.id] || ""}
          onChangeText={(value) => setNotes((current) => ({ ...current, [product.id]: value }))}
          placeholder="ملاحظة"
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
          <Feather name="clipboard" size={20} color={Colors.gold} />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>طلبية الفرع اليومية من المصنع</Text>
          <Text style={styles.subtitle}>حدد المنتجات والكميات المطلوبة يوميًا ليتم تجهيزها وتوفيرها من المصنع.</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{requestItems.length}</Text>
          <Text style={styles.summaryLabel}>منتجات مطلوبة</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{totalQuantity}</Text>
          <Text style={styles.summaryLabel}>إجمالي الكميات</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{savedRequests.length}</Text>
          <Text style={styles.summaryLabel}>طلبيات محفوظة</Text>
        </View>
      </View>

      <View style={styles.formGrid}>
        <TextInput
          style={styles.input}
          value={branchName}
          onChangeText={setBranchName}
          placeholder="اسم الفرع"
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
        <TextInput
          style={styles.input}
          value={requestDate}
          onChangeText={setRequestDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textMuted}
          textAlign="center"
        />
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="بحث عن منتج داخل قائمة الطلبية..."
        placeholderTextColor={Colors.textMuted}
        textAlign="right"
      />

      <View style={styles.productsHeader}>
        <Text style={styles.sectionTitle}>المنتجات</Text>
        <Text style={styles.smallText}>{isLoading ? "جاري التحميل..." : `${availableProducts.length} منتج`}</Text>
      </View>

      <ScrollView style={styles.productsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {availableProducts.length ? availableProducts.map(renderProductRow) : (
          <View style={styles.emptyBox}>
            <Feather name="package" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد منتجات متاحة للطلب.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={clearDraft} activeOpacity={0.85}>
          <Feather name="refresh-cw" size={15} color={Colors.primary} />
          <Text style={styles.secondaryBtnText}>تفريغ المسودة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={submitRequest} activeOpacity={0.85}>
          <Feather name="send" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>إرسال الطلبية للمصنع</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>آخر الطلبيات</Text>
        <Text style={styles.smallText}>{loaded ? "محفوظة محليًا لهذا الفرع" : "جاري التحميل..."}</Text>
      </View>

      {savedRequests.slice(0, 8).map((request) => (
        <View key={request.id} style={styles.requestCard}>
          <View style={styles.requestTopRow}>
            <View>
              <Text style={styles.requestTitle}>{request.branchName}</Text>
              <Text style={styles.requestMeta}>{request.requestDate} · {request.items.length} منتج · {request.requestedBy || "غير محدد"}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[request.status] + "18" }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[request.status] }]}>{STATUS_LABELS[request.status]}</Text>
            </View>
          </View>
          <Text style={styles.requestItems} numberOfLines={2}>{request.items.map((item) => `${item.name} × ${item.quantity}`).join("، ")}</Text>
          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => duplicateRequest(request)}><Text style={styles.miniBtnText}>تكرار اليوم</Text></TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => updateStatus(request.id, "preparing")}><Text style={styles.miniBtnText}>قيد التجهيز</Text></TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => updateStatus(request.id, "completed")}><Text style={styles.miniBtnText}>تم التوفير</Text></TouchableOpacity>
            <TouchableOpacity style={styles.deleteMiniBtn} onPress={() => removeRequest(request.id)}><Feather name="trash-2" size={13} color={Colors.accent} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gold + "18" },
  headerTextBlock: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, fontWeight: "600", color: Colors.textMuted, textAlign: "right", lineHeight: 19 },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 10, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 18, fontWeight: "900", color: Colors.primary },
  summaryLabel: { fontSize: 10, fontWeight: "700", color: Colors.textMuted, textAlign: "center" },
  formGrid: { flexDirection: "row", gap: 10 },
  input: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#f8fafc", paddingHorizontal: 12, color: Colors.text, fontWeight: "700" },
  searchInput: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#f8fafc", paddingHorizontal: 12, color: Colors.text },
  productsHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  smallText: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  productsList: { maxHeight: 360, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  productRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  productMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right" },
  qtyInput: { width: 64, minHeight: 40, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, color: Colors.primary, fontWeight: "900", borderWidth: 1, borderColor: Colors.border },
  noteInput: { width: 96, minHeight: 40, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, color: Colors.text, paddingHorizontal: 9, borderWidth: 1, borderColor: Colors.border, fontSize: 11 },
  emptyBox: { alignItems: "center", justifyContent: "center", gap: 8, padding: 28 },
  emptyText: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1.3, minHeight: 46, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: Colors.primary + "10", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryBtnText: { color: Colors.primary, fontSize: 13, fontWeight: "900" },
  historyHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  requestCard: { gap: 8, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#f8fafc", padding: 12 },
  requestTopRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 10, alignItems: "center" },
  requestTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  requestMeta: { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  statusBadge: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "900" },
  requestItems: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },
  requestActions: { flexDirection: "row-reverse", gap: 7, flexWrap: "wrap" },
  miniBtn: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  miniBtnText: { color: Colors.primary, fontSize: 10, fontWeight: "800" },
  deleteMiniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent + "10", alignItems: "center", justifyContent: "center" },
});
