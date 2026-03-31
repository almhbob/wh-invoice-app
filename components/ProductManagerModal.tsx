import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { Product, ProductDept, useProducts } from "@/context/ProductsContext";

interface Props {
  visible: boolean;
  product?: Product | null; // null = add mode
  onClose: () => void;
}

const DEPT_OPTIONS: { value: ProductDept; labelAr: string; labelEn: string; color: string; icon: any }[] = [
  { value: "halwa",     labelAr: "حلا زفة وضيافة",  labelEn: "Sweets",     color: Colors.halwa,     icon: "coffee"  },
  { value: "mawali",   labelAr: "معجنات وموالح",    labelEn: "Savory",     color: Colors.mawali,    icon: "package" },
  { value: "chocolate",labelAr: "شوكولاتة",          labelEn: "Chocolate",  color: Colors.chocolate, icon: "gift"    },
  { value: "cake",     labelAr: "كيك",              labelEn: "Cake",       color: Colors.cake,      icon: "layers"  },
];

const CATEGORY_SUGGESTIONS: Record<ProductDept, string[]> = {
  halwa:     ["حال الزفة", "الضيافة", "بوكسات وتين وحنين"],
  mawali:    ["الموالح"],
  chocolate: ["شوكلت", "حال القهوة", "شوكلت الحفر والطباعة", "توزيعات وشوكلت مواليد"],
  cake:      ["مقاس 15 سم", "مقاس 25 سم"],
};

export function ProductManagerModal({ visible, product, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { addProduct, updateProduct } = useProducts();
  const { lang } = useLang();
  const isEdit = !!product;

  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [department, setDepartment] = useState<ProductDept>("halwa");
  const [category, setCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("1");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCatSug, setShowCatSug] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setNameEn(product.nameEn ?? "");
      setPrice(product.price.toString());
      setDepartment(product.department);
      setCategory(product.category ?? "");
      setSortOrder(String(product.sortOrder ?? 1));
      setDescription(product.description ?? "");
      setImageUri(product.imageUri ?? null);
      setIsAvailable(product.isAvailable);
    } else {
      setName(""); setNameEn(""); setPrice("");
      setDepartment("halwa"); setCategory(""); setSortOrder("1");
      setDescription(""); setImageUri(null); setIsAvailable(true);
    }
    setShowCatSug(false);
  }, [product, visible]);

  const pickImage = async () => {
    if (Platform.OS === "web") {
      const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!res.canceled) setImageUri(res.assets[0].uri);
      return;
    }
    Alert.alert(
      lang === "ar" ? "اختر مصدر الصورة" : "Choose Photo Source",
      "",
      [
        {
          text: lang === "ar" ? "الكاميرا" : "Camera",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") return;
            const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!res.canceled) setImageUri(res.assets[0].uri);
          },
        },
        {
          text: lang === "ar" ? "معرض الصور" : "Gallery",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") return;
            const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!res.canceled) setImageUri(res.assets[0].uri);
          },
        },
        { text: lang === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error",
        lang === "ar" ? "أدخل اسم المنتج" : "Enter product name");
      return;
    }
    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum < 0) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error",
        lang === "ar" ? "أدخل سعراً صحيحاً" : "Enter a valid price");
      return;
    }
    if (!category.trim()) {
      Alert.alert(lang === "ar" ? "خطأ" : "Error",
        lang === "ar" ? "أدخل التصنيف (الفئة)" : "Enter a category");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        price: priceNum,
        department,
        category: category.trim(),
        sortOrder: Number(sortOrder) || 1,
        description: description.trim() || undefined,
        imageUri: imageUri || undefined,
        isAvailable,
      };
      if (isEdit && product) {
        await updateProduct(product.id, data);
      } else {
        await addProduct(data);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const deptColor = DEPT_OPTIONS.find((d) => d.value === department)?.color ?? Colors.halwa;
  const categorySuggestions = CATEGORY_SUGGESTIONS[department] ?? [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEdit
              ? (lang === "ar" ? "تعديل المنتج" : "Edit Product")
              : (lang === "ar" ? "إضافة منتج جديد" : "Add New Product")}
          </Text>
          <TouchableOpacity
            style={[styles.saveHdrBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.saveHdrText}>{saving ? "..." : (lang === "ar" ? "حفظ" : "Save")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Image picker */}
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
                <View style={styles.imageEditOverlay}>
                  <Feather name="camera" size={22} color="#fff" />
                  <Text style={styles.imageEditText}>{lang === "ar" ? "تغيير الصورة" : "Change Photo"}</Text>
                </View>
                <Pressable style={styles.removeImageBtn} onPress={() => setImageUri(null)} hitSlop={10}>
                  <Feather name="x" size={14} color="#fff" />
                </Pressable>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={[styles.imagePlaceholderIcon, { backgroundColor: deptColor + "18" }]}>
                  <Feather name="camera" size={28} color={deptColor} />
                </View>
                <Text style={styles.imagePlaceholderText}>
                  {lang === "ar" ? "اضغط لإضافة صورة المنتج" : "Tap to add product photo"}
                </Text>
                <Text style={styles.imagePlaceholderSub}>
                  {lang === "ar" ? "يُفضَّل صورة مربعة (1:1)" : "Square image preferred (1:1)"}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Department */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "القسم *" : "Department *"}</Text>
            <View style={styles.deptGrid}>
              {DEPT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.deptChip,
                    department === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setDepartment(opt.value); setCategory(""); setShowCatSug(false); }}
                >
                  <Feather
                    name={opt.icon}
                    size={14}
                    color={department === opt.value ? "#fff" : opt.color}
                  />
                  <Text style={[
                    styles.deptChipText,
                    { color: department === opt.value ? "#fff" : opt.color },
                  ]}>
                    {lang === "ar" ? opt.labelAr : opt.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Name AR */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "اسم المنتج (عربي) *" : "Product Name (Arabic) *"}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={lang === "ar" ? "مثال: كيك شوكولاتة" : "e.g. كيك شوكولاتة"}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
          </View>

          {/* Name EN */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "اسم المنتج (إنجليزي)" : "Product Name (English)"}</Text>
            <TextInput
              style={styles.input}
              value={nameEn}
              onChangeText={setNameEn}
              placeholder="e.g. Chocolate Cake"
              placeholderTextColor={Colors.textMuted}
              textAlign="left"
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "التصنيف *" : "Category *"}</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={(t) => { setCategory(t); setShowCatSug(true); }}
              onFocus={() => setShowCatSug(true)}
              placeholder={lang === "ar" ? "مثال: مقاس 15 سم" : "e.g. Size 15cm"}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
            {showCatSug && categorySuggestions.length > 0 && (
              <View style={styles.sugBox}>
                {categorySuggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.sugItem}
                    onPress={() => { setCategory(s); setShowCatSug(false); Haptics.selectionAsync(); }}
                  >
                    <Text style={styles.sugText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "السعر (ر.س) *" : "Price (SAR) *"}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.currency}>{lang === "ar" ? "ر.س" : "SAR"}</Text>
              <TextInput
                style={[styles.input, { flex: 1, borderRightWidth: 0, borderRadius: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="right"
              />
            </View>
          </View>

          {/* Sort Order */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "الترتيب في القائمة" : "Display Order"}</Text>
            <TextInput
              style={styles.input}
              value={sortOrder}
              onChangeText={setSortOrder}
              keyboardType="number-pad"
              textAlign="right"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>{lang === "ar" ? "وصف مختصر (اختياري)" : "Short Description (optional)"}</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              placeholder={lang === "ar" ? "وصف المنتج..." : "Product description..."}
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlign={lang === "ar" ? "right" : "left"}
              textAlignVertical="top"
            />
          </View>

          {/* Availability toggle */}
          <View style={styles.availRow}>
            <View style={styles.availInfo}>
              <Text style={styles.availTitle}>{lang === "ar" ? "متوفر للطلب" : "Available for Order"}</Text>
              <Text style={styles.availSub}>
                {lang === "ar" ? "إيقاف التوفر يخفي المنتج من الكاشير" : "Disabling hides it from cashier"}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: Colors.border, true: Colors.success + "80" }}
              thumbColor={isAvailable ? Colors.success : Colors.textMuted}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: deptColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Feather name={isEdit ? "save" : "plus-circle"} size={18} color="#fff" />
            <Text style={styles.saveBtnText}>
              {saving
                ? (lang === "ar" ? "جاري الحفظ..." : "Saving...")
                : isEdit
                  ? (lang === "ar" ? "حفظ التعديلات" : "Save Changes")
                  : (lang === "ar" ? "إضافة المنتج" : "Add Product")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  title: { fontSize: 17, fontWeight: "700", color: Colors.primary },
  saveHdrBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
  },
  saveHdrText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  body: { padding: 16, gap: 16 },
  imagePicker: {
    height: 200, borderRadius: 16, overflow: "hidden",
    borderWidth: 2, borderStyle: "dashed", borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  imagePreview: { width: "100%", height: "100%" },
  imageEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  imageEditText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  removeImageBtn: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12,
    width: 24, height: 24, alignItems: "center", justifyContent: "center",
  },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  imagePlaceholderIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
  },
  imagePlaceholderText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" },
  imagePlaceholderSub: { fontSize: 12, color: Colors.textMuted },
  field: { gap: 6 },
  label: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: Colors.text, backgroundColor: Colors.surface,
  },
  deptRow: { flexDirection: "row", gap: 12 },
  deptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  deptChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  deptChipText: { fontSize: 13, fontWeight: "700" },
  sugBox: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, marginTop: 2, overflow: "hidden",
  },
  sugItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sugText: { fontSize: 14, color: Colors.text, textAlign: "right" },
  priceRow: { flexDirection: "row", alignItems: "center" },
  currency: {
    backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.textSecondary, fontWeight: "600",
    borderWidth: 1.5, borderColor: Colors.border,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderRightWidth: 0,
  },
  availRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  availInfo: { flex: 1, gap: 3 },
  availTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  availSub: { fontSize: 12, color: Colors.textMuted },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderRadius: 16, paddingVertical: 15, marginTop: 8, marginBottom: 20,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
