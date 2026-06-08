import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useMemo, useState, useCallback } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import {
  LAVIVIANE_CATEGORY_ORDER,
  LAVIVIANE_COMPANY_ID,
  buildLavivianeProducts,
} from "@/constants/lavivianeProducts";
import { useCompany } from "@/context/CompanyContext";
import { useLang } from "@/context/LanguageContext";
import { Product, useProducts } from "@/context/ProductsContext";

const LAVI_CAT_COLORS: Record<string, string> = {
  "New Cake Collection": "#c0392b",
  "Laviviane Cakes": "#8e44ad",
  "Celebration Bites": "#2f241d",
  "Mousse Cake": "#16a085",
  "Laviviane Bites": "#d35400",
  Sandwich: "#27ae60",
  "Luxury Chocolate": "#d6b56d",
  "Occasion Chocolate": "#2980b9",
  "Distributions and Gifts": "#7f8c8d",
};

const DEPT_COLORS: Record<string, string> = {
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
};

interface Props {
  selected: Record<string, number>;
  onAdd: (product: Product) => void;
  onRemove: (product: Product) => void;
}

function ProductTile({
  product,
  qty,
  onAdd,
  onRemove,
  isLaviviane,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  isLaviviane: boolean;
}) {
  const accentColor = isLaviviane
    ? (LAVI_CAT_COLORS[product.category] ?? Colors.primary)
    : (DEPT_COLORS[product.department] ?? Colors.primary);

  const categoryLabel = isLaviviane ? product.category : product.department;

  return (
    <View style={[styles.tile, !product.isAvailable && { opacity: 0.45 }]}>
      {/* Image / placeholder */}
      <View style={[styles.tileImgBox, { borderTopColor: accentColor }]}>
        {product.imageUri ? (
          <Image source={{ uri: product.imageUri }} style={styles.tileImg} contentFit="cover" />
        ) : (
          <View style={[styles.tileImgPlaceholder, { backgroundColor: accentColor + "14" }]}>
            <Feather name="tag" size={22} color={accentColor} />
          </View>
        )}
        {qty > 0 && (
          <View style={[styles.tileQtyBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.tileQtyBadgeText}>{qty}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.tileInfo}>
        <Text style={styles.tileName} numberOfLines={2}>{product.name}</Text>
        <Text style={[styles.tileCat, { color: accentColor }]} numberOfLines={1}>{categoryLabel}</Text>
        <Text style={styles.tilePrice}>{product.price.toFixed(2)} ر.س</Text>
      </View>

      {/* Controls */}
      {product.isAvailable ? (
        qty > 0 ? (
          <View style={[styles.tileQtyRow, { borderColor: accentColor + "60" }]}>
            <TouchableOpacity style={styles.tileQtyBtn} onPress={onRemove}>
              <Feather name={qty === 1 ? "trash-2" : "minus"} size={13}
                color={qty === 1 ? Colors.accent : Colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.tileQtyNum, { color: accentColor }]}>{qty}</Text>
            <TouchableOpacity style={styles.tileQtyBtn} onPress={onAdd}>
              <Feather name="plus" size={13} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.tileAddBtn, { backgroundColor: accentColor }]}
            onPress={onAdd}
            activeOpacity={0.82}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.tileAddText}>إضافة</Text>
          </TouchableOpacity>
        )
      ) : (
        <View style={styles.tileUnavailable}>
          <Text style={styles.tileUnavailableText}>غير متوفر</Text>
        </View>
      )}
    </View>
  );
}

export function InlineCatalog({ selected, onAdd, onRemove }: Props) {
  const { products } = useProducts();
  const { companyId } = useCompany();
  const { lang } = useLang();
  const isLaviviane = companyId === LAVIVIANE_COMPANY_ID;

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const allProducts = useMemo(() => {
    if (products.length > 0) return products;
    if (isLaviviane) return buildLavivianeProducts();
    return [];
  }, [products, isLaviviane]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (catFilter !== "all") {
        if (isLaviviane ? p.category !== catFilter : p.department !== catFilter) return false;
      }
      if (q && !p.name.toLowerCase().includes(q) &&
          !(p.nameEn ?? "").toLowerCase().includes(q) &&
          !(p.category ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allProducts, catFilter, search, isLaviviane]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      if (isLaviviane) {
        const ci = LAVIVIANE_CATEGORY_ORDER.indexOf(a.category as any);
        const cj = LAVIVIANE_CATEGORY_ORDER.indexOf(b.category as any);
        if (ci !== cj) return ci - cj;
      }
      return (a.price || 0) - (b.price || 0);
    }), [filtered, isLaviviane]);

  const handleAdd = useCallback((p: Product) => {
    Haptics.selectionAsync();
    onAdd(p);
  }, [onAdd]);

  const handleRemove = useCallback((p: Product) => {
    Haptics.selectionAsync();
    onRemove(p);
  }, [onRemove]);

  const totalSelected = Object.values(selected).reduce((s, n) => s + n, 0);

  const categories = isLaviviane
    ? (["all", ...LAVIVIANE_CATEGORY_ORDER] as string[])
    : (["all", "cake", "halwa", "chocolate", "mawali"] as string[]);

  const catLabels: Record<string, string> = isLaviviane
    ? Object.fromEntries(LAVIVIANE_CATEGORY_ORDER.map(c => [c, c]))
    : { all: "الكل", cake: "كيك", halwa: "حلويات", chocolate: "شوكولاتة", mawali: "موالح" };
  catLabels["all"] = `الكل (${allProducts.length})`;

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="بحث بالاسم أو الفئة..."
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {totalSelected > 0 && (
          <View style={styles.selectedPill}>
            <Feather name="shopping-cart" size={13} color={Colors.gold} />
            <Text style={styles.selectedPillText}>{totalSelected} صنف</Text>
          </View>
        )}
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catFilterRow}
        style={styles.catFilterScroll}
      >
        {categories.map((cat) => {
          const isActive = catFilter === cat;
          const color = cat === "all" ? Colors.primary : (LAVI_CAT_COLORS[cat] ?? DEPT_COLORS[cat] ?? Colors.primary);
          const count = cat === "all" ? allProducts.length : allProducts.filter(p =>
            isLaviviane ? p.category === cat : p.department === cat
          ).length;
          const label = cat === "all" ? `الكل (${count})` : `${catLabels[cat] ?? cat} (${count})`;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => setCatFilter(cat)}
            >
              <Text style={[styles.catChipText, isActive && { color: "#fff", fontWeight: "700" }]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results count */}
      <View style={styles.resultBar}>
        <Text style={styles.resultCount}>
          {sorted.filter(p => p.isAvailable).length} منتج متاح
        </Text>
        {search ? (
          <Text style={styles.resultCount}>· نتائج "{search}"</Text>
        ) : null}
      </View>

      {/* Product grid */}
      <FlatList
        data={sorted}
        key="3col"
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <ProductTile
            product={item}
            qty={selected[item.id] ?? 0}
            onAdd={() => handleAdd(item)}
            onRemove={() => handleRemove(item)}
            isLaviviane={isLaviviane}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="package" size={44} color={Colors.textMuted + "60"} />
            <Text style={styles.emptyText}>
              {search ? `لا توجد نتائج لـ "${search}"` : "لا توجد منتجات في هذه الفئة"}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F3EF",
    borderRightWidth: 1,
    borderRightColor: "#E8DDD0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8DDD0",
    backgroundColor: "#fff",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F3EF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 9 : 10,
    borderWidth: 1,
    borderColor: "#E8DDD0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.gold + "18",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  selectedPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.gold,
  },
  catFilterScroll: {
    maxHeight: 48,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8DDD0",
  },
  catFilterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 7,
    alignItems: "center",
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#D6C9B8",
    backgroundColor: "#fff",
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  resultBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resultCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 40,
  },
  row: {
    gap: 8,
    marginBottom: 8,
    justifyContent: "flex-start",
  },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#EDE5DC",
    shadowColor: "#2f241d",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tileImgBox: {
    height: 100,
    position: "relative",
    borderTopWidth: 3,
  },
  tileImg: {
    width: "100%",
    height: "100%",
  },
  tileImgPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileQtyBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tileQtyBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  tileInfo: {
    padding: 8,
    gap: 2,
  },
  tileName: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 16,
  },
  tileCat: {
    fontSize: 10,
    fontWeight: "600",
  },
  tilePrice: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  tileQtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: "#F9F6F2",
  },
  tileQtyBtn: {
    padding: 4,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tileQtyNum: {
    fontSize: 15,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  tileAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    margin: 8,
    marginTop: 2,
    borderRadius: 8,
    paddingVertical: 7,
  },
  tileAddText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  tileUnavailable: {
    margin: 8,
    marginTop: 2,
    borderRadius: 8,
    paddingVertical: 7,
    backgroundColor: "#F0EAE2",
    alignItems: "center",
  },
  tileUnavailableText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
});
