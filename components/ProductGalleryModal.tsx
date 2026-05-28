import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useMemo, useState, useCallback } from "react";
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { LAVIVIANE_CATEGORY_ORDER, LAVIVIANE_COMPANY_ID, buildLavivianeProducts } from "@/constants/lavivianeProducts";
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

// Laviviane category colours — cycle through brand palette
const LAVI_CATEGORY_COLORS: Record<string, string> = {
  "New Cake Collection":      "#c0392b",
  "Laviviane Cakes":          "#8e44ad",
  "Celebration Bites":        "#2f241d",
  "Mousse Cake":              "#16a085",
  "Laviviane Bites":          "#d35400",
  "Sandwich":                 "#27ae60",
  "Luxury Chocolate":         "#d6b56d",
  "Occasion Chocolate":       "#2980b9",
  "Distributions and Gifts":  "#7f8c8d",
};

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
  onImagePress,
  lang,
  isLaviviane,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onImagePress: (uri: string, name: string) => void;
  lang: string;
  isLaviviane: boolean;
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

  const deptColor = isLaviviane && product.category
    ? (LAVI_CATEGORY_COLORS[product.category] ?? Colors.primary)
    : (deptColorMap[product.department] ?? Colors.primary);

  const badgeLabel = isLaviviane && product.category
    ? product.category
    : (lang === "ar"
        ? (deptLabelAr[product.department] ?? product.department)
        : (deptLabelEn[product.department] ?? product.department));

  const displayName = lang === "en" && product.nameEn ? product.nameEn : product.name;

  return (
    <View style={[styles.productCard, qty > 0 && { borderColor: deptColor }, !product.isAvailable && styles.productCardUnavailable]}>
      <TouchableOpacity
        style={styles.productImageBox}
        onPress={() => product.imageUri ? onImagePress(product.imageUri, displayName) : undefined}
        activeOpacity={product.imageUri ? 0.85 : 1}
      >
        {product.imageUri ? (
          <>
            <Image source={{ uri: product.imageUri }} style={styles.productImage} contentFit="cover" transition={180} />
            <View style={styles.imageZoomHint}>
              <Feather name="zoom-in" size={11} color="rgba(255,255,255,0.9)" />
            </View>
          </>
        ) : (
          <View style={[styles.productImagePlaceholder, { backgroundColor: deptColor + "18" }]}>
            <Feather name={(deptIconMap[product.department] as any) ?? "tag"} size={30} color={deptColor} />
          </View>
        )}

        <View style={[styles.deptBadge, { backgroundColor: deptColor }]}>
          <Text style={styles.deptBadgeText} numberOfLines={1}>{badgeLabel}</Text>
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
      </TouchableOpacity>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{displayName}</Text>
        {product.description ? <Text style={styles.productDesc} numberOfLines={1}>{product.description}</Text> : null}
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{formatPrice(product.price, lang)}</Text>
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [zoomedImage, setZoomedImage] = useState<{ uri: string; name: string } | null>(null);

  const handleImagePress = useCallback((uri: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZoomedImage({ uri, name });
  }, []);

  const isLaviviane = companyId === LAVIVIANE_COMPANY_ID;
  const columnCount = width >= 980 ? 4 : width >= 700 ? 3 : 2;

  const visibleProducts = useMemo(() => {
    if (products.length > 0) return products;
    if (isLaviviane) return buildLavivianeProducts();
    return [];
  }, [products, isLaviviane]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleProducts.filter((p) => {
      if (isLaviviane) {
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      } else {
        if (deptFilter !== "all" && p.department !== deptFilter) return false;
      }
      if (q && !p.name.toLowerCase().includes(q) && !(p.nameEn ?? "").toLowerCase().includes(q) && !(p.category ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visibleProducts, deptFilter, categoryFilter, search, isLaviviane]);

  // Sorted: available first → by category order → by price asc
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      if (isLaviviane) {
        const catA = LAVIVIANE_CATEGORY_ORDER.indexOf(a.category ?? "");
        const catB = LAVIVIANE_CATEGORY_ORDER.indexOf(b.category ?? "");
        if (catA !== catB) return catA - catB;
      }
      return (a.price || 0) - (b.price || 0);
    });
  }, [filtered, isLaviviane]);

  // Grouped by category for Laviviane "all" view (no search active)
  const groupedByCategory = useMemo(() => {
    if (!isLaviviane || categoryFilter !== "all" || search.trim()) return null;
    return LAVIVIANE_CATEGORY_ORDER.map((cat) => ({
      category: cat,
      color: LAVI_CATEGORY_COLORS[cat] ?? Colors.primary,
      available: sortedFiltered.filter(p => p.category === cat && p.isAvailable),
      unavailable: sortedFiltered.filter(p => p.category === cat && !p.isAvailable),
    })).filter(g => g.available.length + g.unavailable.length > 0);
  }, [isLaviviane, categoryFilter, search, sortedFiltered]);

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
        };
      });
    onConfirm(items);
    setSelected({});
    setSearch("");
    setDeptFilter("all");
    setCategoryFilter("all");
    onClose();
  };

  const handleClose = () => {
    setSelected({});
    setSearch("");
    setDeptFilter("all");
    setCategoryFilter("all");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {isLaviviane ? (
              <>
                <Text style={[styles.headerTitle, { color: "#2f241d" }]}>LAVIVIANE</Text>
                <Text style={styles.headerSubtitle}>اختر من كتالوج لاففيان · {visibleProducts.length} منتج</Text>
              </>
            ) : (
              <>
                <Text style={styles.headerTitle}>{lang === "ar" ? "اختيار المنتجات" : "Choose Products"}</Text>
                <Text style={styles.headerSubtitle}>{lang === "ar" ? "بطاقات مرئية بالصور والسعر والكمية" : "Visual cards with image, price, and quantity"}</Text>
              </>
            )}
          </View>
          {totalSelected > 0 ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>{totalSelected}</Text>
            </View>
          ) : <View style={{ width: 36 }} />}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={lang === "ar" ? "بحث بالاسم أو الفئة..." : "Search name or category..."}
            placeholderTextColor={Colors.textMuted}
            textAlign={lang === "ar" ? "right" : "left"}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filters */}
        {isLaviviane ? (
          /* Laviviane: category filter chips (horizontal scroll) */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.laviFilterRow}
          >
            <TouchableOpacity
              style={[styles.laviChip, categoryFilter === "all" && { backgroundColor: "#2f241d", borderColor: "#2f241d" }]}
              onPress={() => setCategoryFilter("all")}
            >
              <Text style={[styles.laviChipText, categoryFilter === "all" && { color: "#d6b56d" }]}>
                الكل ({visibleProducts.length})
              </Text>
            </TouchableOpacity>
            {LAVIVIANE_CATEGORY_ORDER.map((cat) => {
              const count = visibleProducts.filter((p) => p.category === cat).length;
              const color = LAVI_CATEGORY_COLORS[cat] ?? Colors.primary;
              const isActive = categoryFilter === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.laviChip, isActive && { backgroundColor: color, borderColor: color }]}
                  onPress={() => setCategoryFilter(cat)}
                >
                  <Text style={[styles.laviChipText, isActive && { color: "#fff" }]} numberOfLines={1}>
                    {cat} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          /* Other tenants: department filter */
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
        )}

        {isLaviviane && (
          <Text style={styles.laviResultCount}>
            {sortedFiltered.filter(p => p.isAvailable).length} متاح
            {sortedFiltered.filter(p => !p.isAvailable).length > 0
              ? ` · ${sortedFiltered.filter(p => !p.isAvailable).length} غير متاح` : ""}
            {" · "}{sortedFiltered.length} إجمالاً
          </Text>
        )}

        {groupedByCategory ? (
          /* ── Laviviane "all" grouped view ── */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.groupedContainer}>
            {groupedByCategory.map(({ category, color, available, unavailable }) => {
              const allProds = [...available, ...unavailable];
              const cardW = Math.floor((width - 48) / columnCount);
              return (
                <View key={category} style={styles.catSection}>
                  <View style={[styles.catSectionHeader, { borderRightColor: color }]}>
                    <View style={[styles.catSectionDot, { backgroundColor: color }]} />
                    <Text style={[styles.catSectionTitle, { color }]}>{category}</Text>
                    <Text style={styles.catSectionCount}>{available.length} منتج</Text>
                  </View>
                  <View style={styles.catSectionGrid}>
                    {allProds.map((p) => (
                      <View key={p.id} style={{ width: cardW, marginBottom: 12 }}>
                        <ProductCard
                          product={p}
                          qty={selected[p.id] ?? 0}
                          onAdd={() => add(p.id)}
                          onRemove={() => remove(p.id)}
                          onImagePress={handleImagePress}
                          lang={lang}
                          isLaviviane={isLaviviane}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 110 }} />
          </ScrollView>
        ) : (
          /* ── Filtered / search view ── */
          <FlatList
            data={sortedFiltered}
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
                onImagePress={handleImagePress}
                lang={lang}
                isLaviviane={isLaviviane}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Feather name="shopping-bag" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>{lang === "ar" ? "لا توجد منتجات" : "No products found"}</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── Image zoom modal ── */}
        {zoomedImage && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setZoomedImage(null)}>
            <TouchableOpacity
              style={styles.zoomOverlay}
              activeOpacity={1}
              onPress={() => setZoomedImage(null)}
            >
              <View style={styles.zoomSheet}>
                <Image
                  source={{ uri: zoomedImage.uri }}
                  style={styles.zoomImage}
                  contentFit="contain"
                />
                <View style={styles.zoomFooter}>
                  <Text style={styles.zoomName} numberOfLines={2}>{zoomedImage.name}</Text>
                  <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomedImage(null)}>
                    <Feather name="x" size={16} color="#fff" />
                    <Text style={styles.zoomCloseText}>إغلاق</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

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

  // Laviviane category chips
  laviFilterRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  laviChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#d6b56d", backgroundColor: "#fefcf8",
  },
  laviChipText: { fontSize: 12, fontWeight: "700", color: "#2f241d" },
  laviResultCount: { fontSize: 11, color: Colors.textMuted, textAlign: "right", paddingHorizontal: 16, paddingBottom: 4 },

  // Generic dept filter
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

  // Grouped category sections
  groupedContainer: { paddingHorizontal: 12, paddingTop: 4 },
  catSection: { marginBottom: 20 },
  catSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10,
    borderRightWidth: 4, borderRadius: 6,
    backgroundColor: Colors.surfaceSecondary,
  },
  catSectionDot: { width: 8, height: 8, borderRadius: 4 },
  catSectionTitle: { flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" },
  catSectionCount: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  catSectionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
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
  deptBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, maxWidth: "80%" },
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
  priceRow: { flexDirection: "row-reverse", alignItems: "center", marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: "900", color: Colors.gold },
  addToOrderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginHorizontal: 10, marginBottom: 10, paddingVertical: 9, borderRadius: 12 },
  addToOrderText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  qtyRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 10, marginBottom: 10, borderWidth: 1.5, borderRadius: 12, overflow: "hidden" },
  qtyBtnSmall: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  qtyNum: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "900" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 80 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
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

  // Image zoom hint
  imageZoomHint: {
    position: "absolute", bottom: 6, left: 6,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6,
    padding: 4,
  },

  // Image zoom overlay
  zoomOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  zoomSheet: {
    width: "100%", maxWidth: 480,
    backgroundColor: "#1a1a1a", borderRadius: 20, overflow: "hidden",
  },
  zoomImage: { width: "100%", aspectRatio: 1 },
  zoomFooter: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, backgroundColor: "#1a1a1a",
  },
  zoomName: {
    flex: 1, color: "#fff", fontSize: 14, fontWeight: "700",
    textAlign: "right",
  },
  zoomClose: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  zoomCloseText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
