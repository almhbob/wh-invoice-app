import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID, buildLavivianeProducts } from "@/constants/lavivianeProducts";
import { useCompany } from "@/context/CompanyContext";
import { useLang } from "@/context/LanguageContext";
import { Department, OrderItem } from "@/context/OrdersContext";
import { Product, useProducts } from "@/context/ProductsContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (items: OrderItem[]) => void;
}

const DEPT_FILTERS: { value: Department | "all"; labelAr: string; labelEn: string; color: string }[] = [
  { value: "all",       labelAr: "الكل",            labelEn: "All",                  color: Colors.primary },
  { value: "cake",      labelAr: "كيك و مناسبات",    labelEn: "Cakes & Occasions",    color: Colors.cake },
  { value: "halwa",     labelAr: "حلويات وضيافة",    labelEn: "Sweets & Hospitality", color: Colors.halwa },
  { value: "mawali",    labelAr: "موالح ومعجنات",    labelEn: "Savory & Pastries",    color: Colors.mawali },
  { value: "chocolate", labelAr: "شوكولاتة وهدايا",  labelEn: "Chocolate & Gifts",    color: Colors.chocolate },
];

function makeOrderItemId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function formatPrice(value: number, lang: string) {
  return `${value.toFixed(2)} ${lang === "ar" ? "ر.س" : "SAR"}`;
}

function ProductCard({
  product,
  qty,
  onAdd,
  onRemove,
  lang,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  lang: string;
}) {
  const deptColorMap: Record<string, string> = {
    halwa: Colors.halwa,
    mawali: Colors.mawali,
    chocolate: Colors.chocolate,
    cake: Colors.cake,
  };
  const deptLabelAr: Record<string, string> = {
    halwa: "حلويات وضيافة",
    mawali: "موالح ومعجنات",
    chocolate: "شوكولاتة وهدايا",
    cake: "كيك و مناسبات",
  };
  const deptLabelEn: Record<string, string> = {
    halwa: "Sweets & Hospitality",
    mawali: "Savory & Pastries",
    chocolate: "Chocolate & Gifts",
    cake: "Cakes & Occasions",
  };
  const deptIconMap: Record<string, string> = {
    halwa: "coffee",
    mawali: "package",
    chocolate: "gift",
    cake: "layers",
  };

  const deptColor = deptColorMap[product.department] ?? Colors.primary;
  const deptLabel = lang === "ar"
    ? (deptLabelAr[product.department] ?? product.department)
    : (deptLabelEn[product.department] ?? product.department);
  const displayName = lang === "en" && product.nameEn ? product.nameEn : product.name;

  return (
    <View style={[styles.productCard, qty > 0 && { borderColor: deptColor }, !product.isAvailable && styles.productCardUnavailable]}>
      <View style={styles.productImageBox}>
        {product.imageUri ? (
          <Image source={{ uri: product.imageUri }} style={styles.productImage} contentFit="cover" transition={180} />
        ) : (
          <View style={[styles.productImagePlaceholder, { backgroundColor: deptColor + "18" }]}>
            <Feather name={(deptIconMap[product.department] as any) ?? "tag"} size={30} color={deptColor} />
            <Text style={[styles.placeholderLabel, { color: deptColor }]}>{deptLabel}</Text>
          </View>
        )}

        <View style={[styles.deptBadge, { backgroundColor: deptColor }]}>
          <Text style={styles.deptBadgeText}>{deptLabel}</Text>
        </View>

        {qty > 0 && (
          <View style={styles.selectedOverlayBadge}>
            <Feather name="check" size={12} color="#fff" />
            <Text style={styles.selectedOverlayText}>{qty}</Text>
          </View>
        )}

        {!product.isAvailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>{lang === "ar" ? "غير متوفر" : "Unavailable"}</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{displayName}</Text>
        {product.description ? <Text style={styles.productDesc} numberOfLines={1}>{product.description}</Text> : null}
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{formatPrice(product.price, lang)}</Text>
          {product.category ? <Text style={styles.categoryText} numberOfLines={1}>{product.category}</Text> : null}
        </View>
      </View>

      {product.isAvailable ? (
        qty > 0 ? (
          <View style={[styles.qtyRow, { borderColor: deptColor }]}>
            <TouchableOpacity style={styles.qtyBtnSmall} onPress={onRemove}>
              <Feather name={qty === 1 ? "trash-2" : "minus"} size={14} color={qty === 1 ? Colors.accent : Colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.qtyNum, { color: deptColor }]}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtnSmall} onPress={onAdd}>
              <Feather name="plus" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addToOrderBtn, { backgroundColor: deptColor }]} onPress={onAdd} activeOpacity={0.86}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.addToOrderText}>{lang === "ar" ? "إضافة" : "Add"}</Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

export function ProductGalleryModal({ visible, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { products } = useProducts();
  const { companyId } = useCompany();
  const { lang } = useLang();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [selected, setSelected] = useState<Record<string, number>>({});

  const columnCount = width >= 980 ? 4 : width >= 700 ? 3 : 2;

  const visibleProducts = useMemo(() => {
    if (products.length > 0) return products;
    if (companyId === LAVIVIANE_COMPANY_ID) return buildLavivianeProducts();
    return [];
  }, [products, companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleProducts.filter((p) => {
      if (deptFilter !== "all" && p.department !== deptFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.nameEn ?? "").toLowerCase().includes(q) && !(p.category ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visibleProducts, deptFilter, search]);

  const totalSelected = Object.values(selected).reduce((s, n) => s + n, 0);
  const totalValue = Object.entries(selected).reduce((sum, [productId, qty]) => {
    const prod = visibleProducts.find((p) => p.id === productId);
    return sum + ((prod?.price ?? 0) * qty);
  }, 0);

  const add = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const remove = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = { ...prev };
      if ((next[id] ?? 0) <= 1) delete next[id];
      else next[id]--;
      return next;
    });
  };

  const handleConfirm = () => {
    const items: OrderItem[] = Object.entries(selected)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const prod = visibleProducts.find((p) => p.id === productId)!;
        return {
          id: makeOrderItemId(),
          name: prod.name,
          quantity: qty,
          price: prod.price,
          department: prod.department,
          details: prod.category || prod.description || undefined,
        };
      });
    onConfirm(items);
    setSelected({});
    setSearch("");
    setDeptFilter("all");
    onClose();
  };

  const handleClose = () => {
    setSelected({});
    setSearch("");
    setDeptFilter("all");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 12 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{lang === "ar" ? "اختيار المنتجات" : "Choose Products"}</Text>
            <Text style={styles.headerSubtitle}>{lang === "ar" ? "بطاقات مرئية بالصور والسعر والكمية" : "Visual cards with image, price, and quantity"}</Text>
          </View>
          {totalSelected > 0 ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>{totalSelected}</Text>
            </View>
          ) : <View style={{ width: 36 }} />}
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={lang === "ar" ? "بحث بالاسم أو التصنيف..." : "Search name or category..."}
            placeholderTextColor={Colors.textMuted}
            textAlign={lang === "ar" ? "right" : "left"}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {DEPT_FILTERS.map((f) => {
            const label = lang === "ar" ? f.labelAr : f.labelEn;
            const isActive = deptFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, isActive && { backgroundColor: f.color, borderColor: f.color }]}
                onPress={() => setDeptFilter(f.value as any)}
              >
                <Text style={[styles.filterChipText, isActive && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.productCount}>{filtered.length} {lang === "ar" ? "منتج" : "products"}</Text>
        </View>

        <FlatList
          data={filtered}
          key={columnCount}
          keyExtractor={(item) => item.id}
          numColumns={columnCount}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              qty={selected[item.id] ?? 0}
              onAdd={() => add(item.id)}
              onRemove={() => remove(item.id)}
              lang={lang}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="shopping-bag" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{lang === "ar" ? "لا توجد منتجات" : "No products found"}</Text>
              {companyId === LAVIVIANE_COMPANY_ID ? (
                <Text style={styles.emptyHint}>{lang === "ar" ? "جاري تحميل كتالوج Laviviane المحلي بعد تحديث النشر." : "Loading Laviviane local catalog after deployment refresh."}</Text>
              ) : null}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        {totalSelected > 0 && (
          <View style={[styles.confirmBar, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.confirmLeft}>
              <Text style={styles.confirmCount}>{totalSelected} {lang === "ar" ? "صنف مختار" : "selected"}</Text>
              <Text style={styles.confirmTotal}>{formatPrice(totalValue, lang)}</Text>
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>{lang === "ar" ? "إضافة للفاتورة" : "Add to Invoice"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 2 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: Colors.primary },
  headerSubtitle: { fontSize: 11, color: Colors.textMuted, textAlign: "center" },
  selectedBadge: {
    minWidth: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  selectedBadgeText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.surface, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  filterRow: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterChipText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  productCount: { fontSize: 12, color: Colors.textMuted, marginLeft: "auto" },
  grid: { paddingHorizontal: 12, paddingBottom: 110 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  productCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 18,
    overflow: "hidden", borderWidth: 1.5, borderColor: "transparent",
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  productCardUnavailable: { opacity: 0.55 },
  productImageBox: { height: 132, position: "relative", backgroundColor: Colors.surfaceSecondary },
  productImage: { width: "100%", height: "100%" },
  productImagePlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", gap: 6 },
  placeholderLabel: { fontSize: 11, fontWeight: "800" },
  deptBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  deptBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  selectedOverlayBadge: {
    position: "absolute", left: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  selectedOverlayText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  unavailableOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center" },
  unavailableText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  productInfo: { padding: 10, gap: 4, flex: 1 },
  productName: { fontSize: 13, fontWeight: "800", color: Colors.text, lineHeight: 18, textAlign: "right" },
  productDesc: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  priceRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: "900", color: Colors.gold },
  categoryText: { flex: 1, fontSize: 10, color: Colors.textMuted, textAlign: "left" },
  addToOrderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginHorizontal: 10, marginBottom: 10, paddingVertical: 9, borderRadius: 12 },
  addToOrderText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  qtyRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 10, marginBottom: 10, borderWidth: 1.5, borderRadius: 12, overflow: "hidden" },
  qtyBtnSmall: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  qtyNum: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "900" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 80 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  emptyHint: { maxWidth: 280, fontSize: 12, color: Colors.info, textAlign: "center", lineHeight: 18 },
  confirmBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  confirmLeft: { flex: 1, gap: 2 },
  confirmCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: "700", textAlign: "right" },
  confirmTotal: { fontSize: 16, color: Colors.gold, fontWeight: "900", textAlign: "right" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
