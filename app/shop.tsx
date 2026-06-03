import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useOrders, Order } from "@/context/OrdersContext";
import { Product, useProducts } from "@/context/TenantProductsContext";
import { DeliveryDatePicker, DeliveryTimePicker } from "@/components/DeliveryDateTimePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type CartMap = Record<string, number>; // productId -> quantity

interface CartItem {
  product: Product;
  qty: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPT_META: Record<string, { color: string; icon: string }> = {
  cake:      { color: Colors.cake,      icon: "layers" },
  halwa:     { color: Colors.halwa,     icon: "coffee" },
  chocolate: { color: Colors.chocolate, icon: "gift" },
  mawali:    { color: Colors.mawali,    icon: "package" },
};

function formatNow() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${m}`;
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  qty,
  onAdd,
  onRemove,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t } = useLang();
  const dept = DEPT_META[product.department] ?? { color: Colors.primary, icon: "box" };

  return (
    <View style={cardStyles.card}>
      {product.imageUri ? (
        <Image
          source={product.imageUri}
          style={cardStyles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[cardStyles.imagePlaceholder, { backgroundColor: dept.color + "18" }]}>
          <Feather name={dept.icon as any} size={32} color={dept.color} />
        </View>
      )}

      {/* Dept color bar */}
      <View style={[cardStyles.deptBar, { backgroundColor: dept.color }]} />

      <View style={cardStyles.body}>
        <Text style={cardStyles.name} numberOfLines={2}>{product.name}</Text>
        {product.nameEn ? (
          <Text style={cardStyles.nameEn} numberOfLines={1}>{product.nameEn}</Text>
        ) : null}
        <Text style={cardStyles.price}>{product.price.toFixed(0)} ر.س</Text>

        {qty === 0 ? (
          <TouchableOpacity style={cardStyles.addBtn} onPress={onAdd} activeOpacity={0.85}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={cardStyles.addBtnText}>{t("shopAddToCart")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={cardStyles.qtyRow}>
            <TouchableOpacity style={cardStyles.qtyBtn} onPress={onRemove} activeOpacity={0.8}>
              <Feather name="minus" size={15} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={cardStyles.qtyNum}>{qty}</Text>
            <TouchableOpacity style={[cardStyles.qtyBtn, cardStyles.qtyBtnAdd]} onPress={onAdd} activeOpacity={0.8}>
              <Feather name="plus" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16,
    overflow: "hidden", margin: 4,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  image: { width: "100%", height: 160 },
  imagePlaceholder: { width: "100%", height: 160, alignItems: "center", justifyContent: "center" },
  deptBar: { height: 3 },
  body: { padding: 12, gap: 4 },
  name: { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right", lineHeight: 20 },
  nameEn: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  price: { fontSize: 16, fontWeight: "900", color: Colors.primary, textAlign: "right", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 9, marginTop: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  qtyRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 6,
  },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  qtyBtnAdd: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  qtyNum: { fontSize: 17, fontWeight: "800", color: Colors.primary, minWidth: 24, textAlign: "center" },
});

// ─── Cart / Checkout Sheet ────────────────────────────────────────────────────

function CartSheet({
  visible,
  cartItems,
  onClose,
  onQtyChange,
  onOrderPlaced,
}: {
  visible: boolean;
  cartItems: CartItem[];
  onClose: () => void;
  onQtyChange: (productId: string, delta: number) => void;
  onOrderPlaced: (order: Order) => void;
}) {
  const { t } = useLang();
  const { addOrder } = useOrders();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const grandTotal = cartItems.reduce((s, ci) => s + ci.product.price * ci.qty, 0);
  const itemCount = cartItems.reduce((s, ci) => s + ci.qty, 0);

  async function handleSubmit() {
    if (!name.trim()) { Alert.alert("خطأ", t("errName")); return; }
    if (!phone.trim() || phone.trim().length < 9) { Alert.alert("خطأ", t("errPhone")); return; }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      Alert.alert("خطأ", t("shopDeliveryAddr") + " مطلوب"); return;
    }
    if (cartItems.length === 0) { Alert.alert("خطأ", t("shopCartEmpty")); return; }

    setIsSubmitting(true);
    try {
      const deliveryDateTime = [deliveryDate, deliveryTime].filter(Boolean).join(" ") || undefined;
      const order = await addOrder({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        receivedAt: formatNow(),
        orderType,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
        deliveryTime: deliveryDateTime,
        items: cartItems.map((ci) => ({
          id: ci.product.id + "_" + Date.now(),
          name: ci.product.name,
          quantity: ci.qty,
          price: ci.product.price,
          department: ci.product.department,
        })),
        totalAmount: grandTotal,
        paymentMethod: "cash",
        amountPaid: 0,
        notes: notes.trim() || undefined,
      });
      onOrderPlaced(order);
    } catch (e) {
      Alert.alert("خطأ", t("errSend"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={step === "cart" ? onClose : undefined}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%", maxWidth: 540, alignSelf: "center" }}
        >
          <Pressable onPress={() => {}} style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            {/* Handle */}
            <View style={sheetStyles.handle} />

            {/* Header */}
            <View style={sheetStyles.header}>
              {step === "checkout" ? (
                <TouchableOpacity onPress={() => setStep("cart")} style={sheetStyles.backBtn}>
                  <Feather name="arrow-right" size={18} color={Colors.primary} />
                  <Text style={sheetStyles.backBtnText}>{t("shopBackToCart")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
                  <Feather name="x" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
              <Text style={sheetStyles.title}>
                {step === "cart" ? t("shopCartBtn") : t("shopCheckout")}
                {step === "cart" && itemCount > 0 ? ` (${itemCount})` : ""}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Cart step */}
            {step === "cart" && (
              <>
                {cartItems.length === 0 ? (
                  <View style={sheetStyles.emptyCart}>
                    <Feather name="shopping-cart" size={52} color={Colors.textMuted} />
                    <Text style={sheetStyles.emptyText}>{t("shopCartEmpty")}</Text>
                  </View>
                ) : (
                  <ScrollView style={sheetStyles.cartList} showsVerticalScrollIndicator={false}>
                    {cartItems.map((ci) => (
                      <View key={ci.product.id} style={sheetStyles.cartItem}>
                        {ci.product.imageUri ? (
                          <Image source={ci.product.imageUri} style={sheetStyles.cartItemImg} contentFit="cover" />
                        ) : (
                          <View style={[sheetStyles.cartItemImg, { backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }]}>
                            <Feather name="package" size={18} color={Colors.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={sheetStyles.cartItemName} numberOfLines={2}>{ci.product.name}</Text>
                          <Text style={sheetStyles.cartItemPrice}>{(ci.product.price * ci.qty).toFixed(0)} ر.س</Text>
                        </View>
                        <View style={sheetStyles.cartQtyRow}>
                          <TouchableOpacity style={sheetStyles.cartQtyBtn} onPress={() => onQtyChange(ci.product.id, -1)}>
                            <Feather name="minus" size={13} color={Colors.primary} />
                          </TouchableOpacity>
                          <Text style={sheetStyles.cartQtyNum}>{ci.qty}</Text>
                          <TouchableOpacity style={[sheetStyles.cartQtyBtn, sheetStyles.cartQtyBtnAdd]} onPress={() => onQtyChange(ci.product.id, 1)}>
                            <Feather name="plus" size={13} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {cartItems.length > 0 && (
                  <View style={sheetStyles.cartFooter}>
                    <View style={sheetStyles.totalRow}>
                      <Text style={sheetStyles.totalLabel}>{t("previewTotalLabel")}</Text>
                      <Text style={sheetStyles.totalValue}>{grandTotal.toFixed(2)} ر.س</Text>
                    </View>
                    <Text style={sheetStyles.payNote}>
                      <Feather name="info" size={12} color={Colors.textMuted} /> {t("shopPayLater")}
                    </Text>
                    <TouchableOpacity
                      style={sheetStyles.checkoutBtn}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("checkout"); }}
                      activeOpacity={0.85}
                    >
                      <Feather name="arrow-left" size={18} color="#fff" />
                      <Text style={sheetStyles.checkoutBtnText}>{t("shopCheckout")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Checkout step */}
            {step === "checkout" && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
                {/* Order summary */}
                <View style={sheetStyles.summaryBox}>
                  <Text style={sheetStyles.summaryTitle}>{t("shopSummary")}</Text>
                  {cartItems.map((ci) => (
                    <View key={ci.product.id} style={sheetStyles.summaryRow}>
                      <Text style={sheetStyles.summaryName}>{ci.product.name}</Text>
                      <Text style={sheetStyles.summaryQty}>×{ci.qty}</Text>
                      <Text style={sheetStyles.summaryPrice}>{(ci.product.price * ci.qty).toFixed(0)} ر.س</Text>
                    </View>
                  ))}
                  <View style={sheetStyles.summaryTotalRow}>
                    <Text style={sheetStyles.summaryTotalLabel}>{t("previewTotalLabel")}</Text>
                    <Text style={sheetStyles.summaryTotalValue}>{grandTotal.toFixed(2)} ر.س</Text>
                  </View>
                </View>

                {/* Customer info */}
                <View style={sheetStyles.formSection}>
                  <Text style={sheetStyles.formLabel}>{t("customerName")} *</Text>
                  <TextInput
                    style={sheetStyles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="أدخل اسمك"
                    placeholderTextColor={Colors.textMuted}
                    textAlign="right"
                  />
                  <Text style={sheetStyles.formLabel}>{t("customerPhone")} *</Text>
                  <TextInput
                    style={sheetStyles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="05XXXXXXXX"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    textAlign="right"
                  />
                </View>

                {/* Order type */}
                <View style={sheetStyles.formSection}>
                  <Text style={sheetStyles.formLabel}>{t("orderType")}</Text>
                  <View style={sheetStyles.typeRow}>
                    <TouchableOpacity
                      style={[sheetStyles.typeBtn, orderType === "pickup" && sheetStyles.typeBtnActive]}
                      onPress={() => { Haptics.selectionAsync(); setOrderType("pickup"); }}
                      activeOpacity={0.8}
                    >
                      <Feather name="shopping-bag" size={16} color={orderType === "pickup" ? "#fff" : Colors.textSecondary} />
                      <Text style={[sheetStyles.typeBtnText, orderType === "pickup" && sheetStyles.typeBtnTextActive]}>
                        {t("shopPickup")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[sheetStyles.typeBtn, orderType === "delivery" && sheetStyles.typeBtnActive]}
                      onPress={() => { Haptics.selectionAsync(); setOrderType("delivery"); }}
                      activeOpacity={0.8}
                    >
                      <Feather name="truck" size={16} color={orderType === "delivery" ? "#fff" : Colors.textSecondary} />
                      <Text style={[sheetStyles.typeBtnText, orderType === "delivery" && sheetStyles.typeBtnTextActive]}>
                        {t("shopDelivery")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {orderType === "delivery" && (
                    <>
                      <Text style={sheetStyles.formLabel}>{t("shopDeliveryAddr")} *</Text>
                      <TextInput
                        style={[sheetStyles.input, { height: 72, textAlignVertical: "top" }]}
                        value={deliveryAddress}
                        onChangeText={setDeliveryAddress}
                        placeholder="المدينة، الحي، الشارع، رقم المبنى"
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        textAlign="right"
                        textAlignVertical="top"
                      />
                    </>
                  )}
                </View>

                {/* Delivery time */}
                <View style={sheetStyles.formSection}>
                  <Text style={sheetStyles.formLabel}>{t("shopDeliveryTime")}</Text>
                  <DeliveryDatePicker value={deliveryDate} onChange={setDeliveryDate} accentColor={Colors.primary} />
                  {deliveryDate ? (
                    <View style={{ marginTop: 6 }}>
                      <DeliveryTimePicker value={deliveryTime} onChange={setDeliveryTime} accentColor={Colors.primary} />
                    </View>
                  ) : null}
                </View>

                {/* Notes */}
                <View style={sheetStyles.formSection}>
                  <Text style={sheetStyles.formLabel}>{t("shopNotes")}</Text>
                  <TextInput
                    style={[sheetStyles.input, { height: 72, textAlignVertical: "top" }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="أي تفاصيل أو طلبات خاصة..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlign="right"
                    textAlignVertical="top"
                  />
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[sheetStyles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Feather name="send" size={18} color="#fff" />
                  )}
                  <Text style={sheetStyles.submitBtnText}>
                    {isSubmitting ? t("sending") : t("shopPlaceOrder")}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center", width: "100%" },
  sheet: {
    backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "92%", width: "100%",
  },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  backBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  title: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  emptyCart: { alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 60 },
  emptyText: { fontSize: 16, color: Colors.textMuted, fontWeight: "600" },
  cartList: { maxHeight: 380 },
  cartItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  cartItemImg: { width: 60, height: 60, borderRadius: 10 },
  cartItemName: { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right", flex: 1 },
  cartItemPrice: { fontSize: 14, fontWeight: "800", color: Colors.primary, textAlign: "right", marginTop: 3 },
  cartQtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cartQtyBtn: {
    width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  cartQtyBtnAdd: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cartQtyNum: { fontSize: 15, fontWeight: "800", color: Colors.primary, minWidth: 20, textAlign: "center" },
  cartFooter: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, color: Colors.textSecondary, fontWeight: "600" },
  totalValue: { fontSize: 22, fontWeight: "900", color: Colors.primary },
  payNote: { fontSize: 12, color: Colors.textMuted, textAlign: "center" },
  checkoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  checkoutBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  // checkout form
  summaryBox: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryName: { flex: 1, fontSize: 13, color: Colors.text, textAlign: "right" },
  summaryQty: { fontSize: 12, color: Colors.textMuted },
  summaryPrice: { fontSize: 13, fontWeight: "700", color: Colors.text, minWidth: 70, textAlign: "left" },
  summaryTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  summaryTotalLabel: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  summaryTotalValue: { fontSize: 18, fontWeight: "900", color: Colors.primary },
  formSection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.borderLight },
  formLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14,
    color: Colors.text, backgroundColor: Colors.background,
  },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  typeBtnText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  typeBtnTextActive: { color: "#fff" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 17,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  submitBtnText: { fontSize: 17, fontWeight: "800", color: "#fff" },
});

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  order,
  onNewOrder,
}: {
  order: Order;
  onNewOrder: () => void;
}) {
  const { t } = useLang();

  return (
    <View style={successStyles.root}>
      <View style={successStyles.card}>
        <View style={successStyles.checkCircle}>
          <Feather name="check" size={38} color="#fff" />
        </View>
        <Text style={successStyles.title}>{t("shopOrderSuccess")}</Text>
        <Text style={successStyles.sub}>{t("shopConfirmMsg")}</Text>

        <View style={successStyles.numBox}>
          <Text style={successStyles.numLabel}>{t("shopOrderNum")}</Text>
          <Text style={successStyles.numValue}>#{order.orderNumber}</Text>
        </View>

        <View style={successStyles.detailsBox}>
          <View style={successStyles.detailRow}>
            <Feather name="user" size={15} color={Colors.textMuted} />
            <Text style={successStyles.detailText}>{order.customerName}</Text>
          </View>
          <View style={successStyles.detailRow}>
            <Feather name="phone" size={15} color={Colors.textMuted} />
            <Text style={successStyles.detailText}>{order.customerPhone}</Text>
          </View>
          <View style={successStyles.detailRow}>
            <Feather name={order.orderType === "delivery" ? "truck" : "shopping-bag"} size={15} color={Colors.textMuted} />
            <Text style={successStyles.detailText}>
              {order.orderType === "delivery" ? t("shopDelivery") : t("shopPickup")}
            </Text>
          </View>
          {order.deliveryTime ? (
            <View style={successStyles.detailRow}>
              <Feather name="clock" size={15} color={Colors.textMuted} />
              <Text style={successStyles.detailText}>{order.deliveryTime}</Text>
            </View>
          ) : null}
          <View style={successStyles.detailRow}>
            <Feather name="dollar-sign" size={15} color={Colors.textMuted} />
            <Text style={[successStyles.detailText, { fontWeight: "800", color: Colors.primary }]}>
              {(order.totalAmount ?? 0).toFixed(2)} ر.س
            </Text>
          </View>
        </View>

        <TouchableOpacity style={successStyles.newOrderBtn} onPress={onNewOrder} activeOpacity={0.85}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={successStyles.newOrderBtnText}>{t("shopNewOrder")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const successStyles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: Colors.background },
  card: {
    width: "100%", maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 24, padding: 28, alignItems: "center", gap: 14,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.success, alignItems: "center", justifyContent: "center",
    shadowColor: Colors.success, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "900", color: Colors.text, textAlign: "center" },
  sub: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  numBox: {
    backgroundColor: Colors.primary + "10", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
    alignItems: "center", borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  numLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  numValue: { fontSize: 30, fontWeight: "900", color: Colors.primary, marginTop: 2 },
  detailsBox: { width: "100%", backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 16, gap: 10 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailText: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  newOrderBtn: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 6,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  newOrderBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { products, isLoading } = useProducts();

  const [cart, setCart] = useState<CartMap>({});
  const [showCart, setShowCart] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const availableProducts = useMemo(
    () => products.filter((p) => p.isAvailable),
    [products]
  );

  const categories = useMemo(() => {
    const cats = Array.from(new Set(availableProducts.map((p) => p.category))).filter(Boolean);
    return [{ key: "all", label: t("shopAllCats") }, ...cats.map((c) => ({ key: c, label: c }))];
  }, [availableProducts, t]);

  const filteredProducts = useMemo(
    () => activeCat === "all" ? availableProducts : availableProducts.filter((p) => p.category === activeCat),
    [availableProducts, activeCat]
  );

  const cartItems: CartItem[] = useMemo(
    () => Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
      .filter((ci) => ci.product != null),
    [cart, products]
  );

  const cartCount = cartItems.reduce((s, ci) => s + ci.qty, 0);
  const cartTotal = cartItems.reduce((s, ci) => s + ci.product.price * ci.qty, 0);

  function updateCart(productId: string, delta: number) {
    Haptics.selectionAsync();
    setCart((prev) => {
      const next = { ...prev };
      const newQty = (next[productId] ?? 0) + delta;
      if (newQty <= 0) { delete next[productId]; } else { next[productId] = newQty; }
      return next;
    });
  }

  function handleOrderPlaced(order: Order) {
    setShowCart(false);
    setCart({});
    setPlacedOrder(order);
  }

  if (placedOrder) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <SuccessScreen order={placedOrder} onNewOrder={() => setPlacedOrder(null)} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <View>
            <Text style={styles.brandName}>{t("appName")}</Text>
            <Text style={styles.brandSub}>{t("appSub")}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.cartBtn, cartCount > 0 && styles.cartBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCart(true); }}
          activeOpacity={0.85}
        >
          <Feather name="shopping-cart" size={18} color={cartCount > 0 ? "#fff" : Colors.primary} />
          <Text style={[styles.cartBtnText, cartCount > 0 && { color: "#fff" }]}>{t("shopCartBtn")}</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Cart total strip when items in cart */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.cartStrip}
          onPress={() => { Haptics.selectionAsync(); setShowCart(true); }}
          activeOpacity={0.9}
        >
          <Feather name="shopping-cart" size={16} color="#fff" />
          <Text style={styles.cartStripText}>
            {cartCount} {t("shopItemsCount")} · {cartTotal.toFixed(2)} ر.س
          </Text>
          <Text style={styles.cartStripAction}>{t("shopCheckout")} ←</Text>
        </TouchableOpacity>
      )}

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScrollWrap}
        contentContainerStyle={styles.catScrollContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catPill, activeCat === cat.key && styles.catPillActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveCat(cat.key); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.catPillText, activeCat === cat.key && styles.catPillTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products grid */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="package" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{t("shopNoProducts")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + (cartCount > 0 ? 120 : 80) }]}
          showsVerticalScrollIndicator={false}
        >
          {chunk(filteredProducts, 2).map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((product) => (
                <View key={product.id} style={styles.gridCell}>
                  <ProductCard
                    product={product}
                    qty={cart[product.id] ?? 0}
                    onAdd={() => updateCart(product.id, 1)}
                    onRemove={() => updateCart(product.id, -1)}
                  />
                </View>
              ))}
              {row.length === 1 && <View style={styles.gridCell} />}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Cart Sheet */}
      <CartSheet
        visible={showCart}
        cartItems={cartItems}
        onClose={() => setShowCart(false)}
        onQtyChange={updateCart}
        onOrderPlaced={handleOrderPlaced}
      />
    </View>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
  },
  brandName: { fontSize: 16, fontWeight: "900", color: Colors.primary },
  brandSub: { fontSize: 10, color: Colors.gold, fontWeight: "600", letterSpacing: 0.5 },
  cartBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9, position: "relative",
  },
  cartBtnActive: { backgroundColor: Colors.primary },
  cartBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  cartBadge: {
    position: "absolute", top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.surface,
  },
  cartBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },

  // cart strip
  cartStrip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12,
  },
  cartStripText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },
  cartStripAction: { fontSize: 14, fontWeight: "800", color: Colors.gold },

  // categories
  catScrollWrap: { maxHeight: 52, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catScrollContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1.5, borderColor: Colors.border,
  },
  catPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  catPillTextActive: { color: "#fff" },

  // loading / empty
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  emptyText: { fontSize: 16, color: Colors.textMuted, fontWeight: "600" },

  // grid
  grid: { padding: 8 },
  gridRow: { flexDirection: "row" },
  gridCell: { flex: 1 },
});
