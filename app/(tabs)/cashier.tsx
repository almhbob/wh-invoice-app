import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { ProductGalleryModal } from "@/components/ProductGalleryModal";
import { useEmployee } from "@/context/EmployeeContext";
import {
  Department,
  Discount,
  DiscountType,
  DISCOUNT_REASON_PRESETS,
  Order,
  OrderItem,
  OrderType,
  ORDER_TYPE_LABELS,
  PaymentMethod,
  PAYMENT_LABELS,
  useOrders,
} from "@/context/OrdersContext";
import { Offer, normalizePhone, useOffers } from "@/context/OffersContext";

const DEPT_OPTIONS: { value: Department; label: string; color: string }[] = [
  { value: "halwa",     label: "حلا زفة",   color: Colors.halwa },
  { value: "mawali",   label: "معجنات",    color: Colors.mawali },
  { value: "chocolate", label: "شوكولاتة", color: Colors.chocolate },
  { value: "cake",     label: "كيك",      color: Colors.cake },
];
const DEPT_CYCLE: Partial<Record<Department, Department>> = {
  halwa: "mawali", mawali: "chocolate", chocolate: "cake", cake: "halwa",
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

function newItem(dept: Department = "halwa"): OrderItem {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
    name: "",
    quantity: 1,
    price: undefined,
    department: dept,
  };
}

const PAYMENT_OPTIONS: { value: PaymentMethod; icon: string }[] = [
  { value: "cash",     icon: "dollar-sign" },
  { value: "card",     icon: "credit-card" },
  { value: "transfer", icon: "send" },
];

export default function CashierScreen() {
  const insets = useSafeAreaInsets();
  const { addOrder } = useOrders();
  const { currentEmployee } = useEmployee();
  const { getOfferByPhone, incrementUsage } = useOffers();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhone2, setCustomerPhone2] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [receivedAt, setReceivedAt] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [insurancePaymentMethod, setInsurancePaymentMethod] = useState<"cash" | "card">("cash");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [items, setItems] = useState<OrderItem[]>([newItem("halwa")]);
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Discount
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // Offer detection
  const [detectedOffer, setDetectedOffer] = useState<Offer | null>(null);
  const [appliedOfferId, setAppliedOfferId] = useState<string | null>(null);

  useEffect(() => {
    setReceivedAt(formatNow());
  }, []);

  // Auto-detect offer when phone changes
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length >= 9) {
      const offer = getOfferByPhone(customerPhone);
      if (offer) {
        if (offer.id !== detectedOffer?.id) {
          setDetectedOffer(offer);
          setAppliedOfferId(offer.id);
          setDiscountEnabled(true);
          setDiscountType(offer.discountType);
          setDiscountValue(offer.discountValue.toString());
          setDiscountReason(offer.reason || "");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        if (detectedOffer) {
          setDetectedOffer(null);
          setAppliedOfferId(null);
          if (!discountEnabled || appliedOfferId) {
            setDiscountEnabled(false);
            setDiscountValue("");
            setDiscountReason("");
          }
        }
      }
    } else {
      if (detectedOffer) {
        setDetectedOffer(null);
        setAppliedOfferId(null);
        setDiscountEnabled(false);
        setDiscountValue("");
        setDiscountReason("");
      }
    }
  }, [customerPhone, getOfferByPhone]);

  const addItemRow = (dept: Department) => {
    setItems((prev) => [...prev, newItem(dept)]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = <K extends keyof OrderItem>(id: string, field: K, value: OrderItem[K]) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const addItemsFromGallery = (newItems: OrderItem[]) => {
    setItems((prev) => {
      // Remove empty placeholder if it's the only item
      const clean = prev.filter((i) => i.name.trim());
      return clean.length > 0 ? [...clean, ...newItems] : newItems;
    });
  };

  const toggleDept = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, department: (DEPT_CYCLE[i.department] ?? i.department) as Department }
          : i
      )
    );
    Haptics.selectionAsync();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("إذن مطلوب", "يحتاج التطبيق للوصول إلى الصور"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("إذن مطلوب", "يحتاج التطبيق للوصول إلى الكاميرا"); return; }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const handleImagePress = () => {
    if (Platform.OS === "web") { pickImage(); return; }
    Alert.alert("إضافة صورة", "اختر مصدر الصورة", [
      { text: "الكاميرا", onPress: takePhoto },
      { text: "معرض الصور", onPress: pickImage },
      { text: "إلغاء", style: "cancel" },
    ]);
  };

  const resetForm = () => {
    setCustomerName(""); setCustomerPhone(""); setCustomerPhone2(""); setReceivedAt(formatNow());
    setOrderType("pickup"); setDeliveryDate(""); setDeliveryTime("");
    setInsuranceAmount(""); setInsurancePaymentMethod("cash");
    setPaymentMethod("cash"); setAmountPaid("");
    setItems([newItem("halwa")]); setNotes(""); setImageUri(null);
    setDiscountEnabled(false); setDiscountType("percentage");
    setDiscountValue(""); setDiscountReason("");
    setDetectedOffer(null); setAppliedOfferId(null);
  };

  // ── Totals ──────────────────────────────────────────────────────────────
  const validItems = items.filter((i) => i.name.trim());
  const subtotal = validItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
  const insuranceVal = parseFloat(insuranceAmount) || 0;
  const discountVal = parseFloat(discountValue) || 0;
  const discountAmount = discountEnabled && discountVal > 0
    ? (discountType === "percentage" ? subtotal * (Math.min(discountVal, 100) / 100) : discountVal)
    : 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + insuranceVal);
  const amountPaidVal = parseFloat(amountPaid) || 0;
  const remainingAmount = Math.max(0, grandTotal - amountPaidVal);
  const hasPrices = validItems.some((i) => (i.price || 0) > 0);
  const deliveryDateTime = [deliveryDate.trim(), deliveryTime.trim()].filter(Boolean).join(" ");

  // ── WhatsApp share ───────────────────────────────────────────────────────
  const buildReceiptText = (order: Order) => {
    const itemLines = order.items
      .map((i) => {
        const lineTotal = i.price ? ` = ${(i.price * i.quantity).toFixed(2)} ر.س` : "";
        const det = i.details ? `\n   تفاصيل: ${i.details}` : "";
        return `• ${i.name} × ${i.quantity}${i.price ? ` @ ${i.price} ر.س` : ""}${lineTotal}${det}`;
      })
      .join("\n");
    const ins = order.insuranceAmount
      ? `\nتأمين الصواني: ${order.insuranceAmount.toFixed(2)} ر.س (${order.insurancePaymentMethod === "card" ? "شبكة" : "كاش"}) — مدة التأمين 3 أيام`
      : "";
    const disc = order.discount
      ? `\nخصم${order.discount.reason ? ` (${order.discount.reason})` : ""}: ${
          order.discount.type === "percentage"
            ? `${order.discount.value}%`
            : `${order.discount.value.toFixed(2)} ر.س`
        }`
      : "";
    const deliv = order.deliveryTime ? `\nموعد التسليم: ${order.deliveryTime}` : "";
    const pm = order.paymentMethod ? `\nطريقة الدفع: ${PAYMENT_LABELS[order.paymentMethod]}` : "";
    const otype = order.orderType ? `\nنوع الطلب: ${ORDER_TYPE_LABELS[order.orderType]}` : "";
    const paid = order.amountPaid != null
      ? `\nالمبلغ المدفوع: ${order.amountPaid.toFixed(2)} ر.س` : "";
    const remaining = order.amountPaid != null && order.totalAmount
      ? `\nالمتبقي: ${Math.max(0, order.totalAmount - order.amountPaid).toFixed(2)} ر.س` : "";
    const cashier = order.cashierEmployee ? `\nمنشئ الطلب: ${order.cashierEmployee.name} #${order.cashierEmployee.employeeId}` : "";
    return (
      `🎂 فاتورة W&H كيك وشوكولاتة\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `رقم الفاتورة: #${order.orderNumber}\n` +
      `العميل: ${order.customerName}\n` +
      `الهاتف: ${order.customerPhone}${order.customerPhone2 ? ` / ${order.customerPhone2}` : ""}${otype}\n` +
      `تاريخ الطلب: ${order.receivedAt}${deliv}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `الأصناف:\n${itemLines}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      (order.totalAmount ? `الإجمالي: ${order.totalAmount.toFixed(2)} ر.س${disc}${ins}` : "") +
      `${pm}${paid}${remaining}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${cashier}\n` +
      (order.insuranceAmount ? `⚠️ ملاحظة: مدة التأمين 3 أيام حتى استرجاع الصواني\n` : "") +
      `شكراً لثقتكم 🙏`
    );
  };

  const shareViaWhatsApp = (order: Order) => {
    const text = buildReceiptText(order);
    const rawPhone = order.customerPhone.replace(/\D/g, "");
    const intlPhone = rawPhone.startsWith("0") ? "966" + rawPhone.slice(1) : rawPhone;
    const url = `whatsapp://send?phone=${intlPhone}&text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Share.share({ message: text });
    });
  };

  const shareAsText = (order: Order) => {
    Share.share({ message: buildReceiptText(order) });
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) { Alert.alert("خطأ", "الرجاء إدخال اسم العميل"); return; }
    if (!customerPhone.trim()) { Alert.alert("خطأ", "الرجاء إدخال رقم الهاتف"); return; }
    const filteredItems = items.filter((i) => i.name.trim());
    if (filteredItems.length === 0) { Alert.alert("خطأ", "الرجاء إضافة صنف واحد على الأقل"); return; }

    const insurance = insuranceAmount.trim() ? parseFloat(insuranceAmount) : undefined;
    const total = grandTotal > 0 ? grandTotal : undefined;
    const discountData: Discount | undefined =
      discountEnabled && discountVal > 0
        ? { type: discountType, value: discountVal, reason: discountReason.trim() }
        : undefined;

    if (!currentEmployee) {
      Alert.alert(
        "تسجيل الدخول مطلوب",
        "يجب عليك تسجيل الدخول أولاً قبل إرسال الفاتورة. اضغط على زر الموظف في الأعلى.",
        [{ text: "حسناً" }]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const paidNum = amountPaidVal > 0 ? amountPaidVal : undefined;
      const created = await addOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerPhone2: customerPhone2.trim() || undefined,
        orderType,
        receivedAt,
        deliveryTime: deliveryDateTime || undefined,
        insuranceAmount: insurance && !isNaN(insurance) ? insurance : undefined,
        insurancePaymentMethod: insuranceVal > 0 ? insurancePaymentMethod : undefined,
        totalAmount: total,
        amountPaid: paidNum,
        paymentMethod,
        discount: discountData,
        items: filteredItems,
        notes: notes.trim() || undefined,
        imageUri: imageUri || undefined,
        cashierEmployee: {
          name: currentEmployee.name,
          employeeId: currentEmployee.employeeId,
          timestamp: new Date().toISOString(),
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (appliedOfferId) {
        incrementUsage(appliedOfferId).catch(() => {});
      }
      resetForm();
      setReceiptOrder(created);
    } catch {
      Alert.alert("خطأ", "فشل إرسال الطلب، حاول مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group items preview by dept
  const halwaCount = items.filter((i) => i.department === "halwa" && i.name.trim()).length;
  const mawaliCount = items.filter((i) => i.department === "mawali" && i.name.trim()).length;
  const chocolateCount = items.filter((i) => i.department === "chocolate" && i.name.trim()).length;
  const cakeCount = items.filter((i) => i.department === "cake" && i.name.trim()).length;

  return (
    <>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* بيانات العميل */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>بيانات العميل</Text>

        <Text style={styles.label}>اسم العميل *</Text>
        <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName}
          placeholder="أدخل اسم العميل" placeholderTextColor={Colors.textMuted} textAlign="right" />

        <Text style={styles.label}>رقم الهاتف *</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={customerPhone}
            onChangeText={setCustomerPhone} placeholder="05XXXXXXXX"
            placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" textAlign="right" />
          <View style={styles.iconBox}>
            <Feather name="phone" size={18} color={Colors.primary} />
          </View>
        </View>

        <Text style={styles.label}>رقم الهاتف 2 (اختياري)</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={customerPhone2}
            onChangeText={setCustomerPhone2} placeholder="05XXXXXXXX"
            placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" textAlign="right" />
          <View style={styles.iconBox}>
            <Feather name="phone-call" size={18} color={Colors.textSecondary} />
          </View>
        </View>

        {/* Offer banner — shown when phone matches an active offer */}
        {detectedOffer && (
          <View style={styles.offerBanner}>
            <View style={styles.offerBannerIcon}>
              <Feather name="gift" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offerBannerTitle}>عرض خاص مُفعَّل تلقائياً ✓</Text>
              <Text style={styles.offerBannerSub}>
                {detectedOffer.discountType === "percentage"
                  ? `خصم ${detectedOffer.discountValue}%`
                  : `خصم ${detectedOffer.discountValue.toFixed(2)} ر.س`}
                {detectedOffer.reason ? `  ·  ${detectedOffer.reason}` : ""}
                {detectedOffer.customerName ? `\n${detectedOffer.customerName}` : ""}
              </Text>
            </View>
            <View style={styles.offerBannerBadge}>
              <Text style={styles.offerBannerBadgeText}>مفعّل</Text>
            </View>
          </View>
        )}

        {/* Current employee display */}
        {currentEmployee ? (
          <View style={styles.empDisplay}>
            <Feather name="user-check" size={14} color={Colors.success} />
            <Text style={styles.empDisplayText}>
              الكاشير: <Text style={{ fontWeight: "700" }}>{currentEmployee.name}</Text>
              {"  "}
              <Text style={{ color: Colors.textMuted }}>#{currentEmployee.employeeId}</Text>
            </Text>
          </View>
        ) : (
          <View style={[styles.empDisplay, { borderColor: Colors.accent + "40", backgroundColor: Colors.accent + "08" }]}>
            <Feather name="alert-circle" size={14} color={Colors.accent} />
            <Text style={[styles.empDisplayText, { color: Colors.accent }]}>
              يجب تسجيل الدخول أولاً — اضغط على زر الموظف في الأعلى
            </Text>
          </View>
        )}
      </View>

      {/* نوع الطلب */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>نوع الطلب</Text>
        <View style={styles.orderTypeRow}>
          {(["pickup", "delivery"] as OrderType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.orderTypeBtn, orderType === t && styles.orderTypeBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setOrderType(t); }}
              activeOpacity={0.8}
            >
              <Feather
                name={t === "pickup" ? "shopping-bag" : "truck"}
                size={18}
                color={orderType === t ? "#fff" : Colors.textSecondary}
              />
              <Text style={[styles.orderTypeBtnText, orderType === t && styles.orderTypeBtnTextActive]}>
                {ORDER_TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* التوقيت */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>التوقيت والتأمين</Text>

        {/* Order date/time (auto) */}
        <Text style={styles.label}>تاريخ ووقت الطلب</Text>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Feather name="clock" size={15} color={Colors.primary} />
          <Text style={styles.autoText}>{receivedAt}</Text>
          <View style={styles.autoBadge}>
            <Feather name="zap" size={11} color={Colors.success} />
            <Text style={styles.autoBadgeText}>تلقائي</Text>
          </View>
        </View>

        {/* Delivery date */}
        <Text style={styles.label}>تاريخ التسليم</Text>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Feather name="calendar" size={15} color={Colors.textMuted} />
          <TextInput style={styles.inlineInput} value={deliveryDate} onChangeText={setDeliveryDate}
            placeholder="مثال: 2025-06-01 (الجمعة)" placeholderTextColor={Colors.textMuted} textAlign="right" />
        </View>

        {/* Delivery time */}
        <Text style={styles.label}>وقت التسليم</Text>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Feather name="watch" size={15} color={Colors.textMuted} />
          <TextInput style={styles.inlineInput} value={deliveryTime} onChangeText={setDeliveryTime}
            placeholder="مثال: 14:30" placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation" textAlign="right" />
        </View>

        {/* Insurance */}
        <Text style={styles.label}>مبلغ تأمين الصواني</Text>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Text style={styles.currency}>ر.س</Text>
          <TextInput style={[styles.inlineInput, { fontWeight: "600", color: Colors.primary }]}
            value={insuranceAmount} onChangeText={setInsuranceAmount}
            placeholder="0.00" placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" textAlign="right" />
        </View>

        {/* Insurance payment method (only when insurance > 0) */}
        {insuranceVal > 0 && (
          <>
            <Text style={styles.label}>طريقة دفع التأمين</Text>
            <View style={styles.insPayRow}>
              {(["cash", "card"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.insPayBtn, insurancePaymentMethod === m && styles.insPayBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setInsurancePaymentMethod(m); }}
                >
                  <Feather
                    name={m === "cash" ? "dollar-sign" : "credit-card"}
                    size={15}
                    color={insurancePaymentMethod === m ? "#fff" : Colors.textSecondary}
                  />
                  <Text style={[styles.insPayBtnText, insurancePaymentMethod === m && styles.insPayBtnTextActive]}>
                    {m === "cash" ? "كاش" : "شبكة"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.insNote}>
              <Feather name="info" size={12} color={Colors.gold} />
              <Text style={styles.insNoteText}>مدة التأمين 3 أيام حتى استرجاع الصواني</Text>
            </View>
          </>
        )}
      </View>

      {/* الأصناف */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>الأصناف</Text>
          {/* dept summary */}
          <View style={styles.deptSummary}>
            {halwaCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.halwa }]}>
                <Text style={styles.deptPillText}>حلا زفة {halwaCount}</Text>
              </View>
            )}
            {mawaliCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.mawali }]}>
                <Text style={styles.deptPillText}>معجنات {mawaliCount}</Text>
              </View>
            )}
            {chocolateCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.chocolate }]}>
                <Text style={styles.deptPillText}>شوكولاتة {chocolateCount}</Text>
              </View>
            )}
            {cakeCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.cake }]}>
                <Text style={styles.deptPillText}>كيك {cakeCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Column headers */}
        <View style={styles.colHeaders}>
          <Text style={[styles.colLabel, { flex: 1 }]}>اسم الصنف</Text>
          <Text style={[styles.colLabel, { width: 66 }]}>السعر</Text>
          <Text style={[styles.colLabel, { width: 74 }]}>الكمية</Text>
          <Text style={[styles.colLabel, { width: 52 }]}>القسم</Text>
          <View style={{ width: 24 }} />
        </View>

        {items.map((item, idx) => {
          const deptConf = DEPT_OPTIONS.find((d) => d.value === item.department)!;
          const lineTotal = (item.price || 0) * item.quantity;
          return (
            <View key={item.id}>
              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemName]}
                  value={item.name}
                  onChangeText={(v) => updateItem(item.id, "name", v)}
                  placeholder={`صنف ${idx + 1}`}
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                />
                {/* price */}
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  value={item.price !== undefined ? String(item.price) : ""}
                  onChangeText={(v) => {
                    const n = parseFloat(v);
                    updateItem(item.id, "price", isNaN(n) ? undefined : n);
                  }}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  textAlign="center"
                />
                {/* qty */}
                <View style={styles.qtyBox}>
                  <TouchableOpacity style={styles.qtyBtn}
                    onPress={() => updateItem(item.id, "quantity", Math.max(1, item.quantity - 1))}>
                    <Feather name="minus" size={12} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyVal}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn}
                    onPress={() => updateItem(item.id, "quantity", item.quantity + 1)}>
                    <Feather name="plus" size={12} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {/* dept toggle */}
                <TouchableOpacity
                  style={[styles.deptToggle, { backgroundColor: deptConf.color }]}
                  onPress={() => toggleDept(item.id)}
                >
                  <Text style={styles.deptToggleText}>{deptConf.label}</Text>
                </TouchableOpacity>
                {/* remove */}
                {items.length > 1 ? (
                  <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Feather name="x" size={16} color={Colors.accent} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 16 }} />
                )}
              </View>
              {/* line total hint */}
              {lineTotal > 0 && (
                <Text style={styles.lineTotalHint}>
                  {item.quantity} × {item.price} = {lineTotal.toFixed(2)} ر.س
                </Text>
              )}
            </View>
          );
        })}

        {/* note + details per item */}
        {items.map((item) => (
          item.name.trim() ? (
            <View key={`extra-${item.id}`} style={{ gap: 6 }}>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={item.note || ""}
                onChangeText={(v) => updateItem(item.id, "note", v)}
                placeholder={`ملاحظة على "${item.name.trim()}" (اختياري)`}
                placeholderTextColor={Colors.textMuted}
                textAlign="right"
              />
              <View>
                <TextInput
                  style={[styles.input, styles.detailsInput]}
                  value={item.details || ""}
                  onChangeText={(v) => {
                    const wordCount = v.trim() ? v.trim().split(/\s+/).length : 0;
                    if (wordCount <= 50) updateItem(item.id, "details", v);
                  }}
                  placeholder={`تفاصيل الصنف "${item.name.trim()}" (حتى 50 كلمة)`}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  textAlign="right"
                  textAlignVertical="top"
                />
                {(item.details?.trim().length ?? 0) > 0 && (() => {
                  const wc = item.details!.trim().split(/\s+/).length;
                  return (
                    <Text style={[styles.charCount, wc >= 48 && { color: wc >= 50 ? Colors.accent : Colors.warning }]}>
                      {wc} / 50 كلمة
                    </Text>
                  );
                })()}
              </View>
            </View>
          ) : null
        ))}

        {/* Browse gallery button */}
        <TouchableOpacity
          style={styles.galleryBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowGallery(true); }}
          activeOpacity={0.85}
        >
          <Feather name="grid" size={16} color={Colors.gold} />
          <Text style={styles.galleryBtnText}>اختر من معرض المنتجات</Text>
          <View style={styles.galleryBtnBadge}>
            <Feather name="arrow-left" size={14} color={Colors.gold} />
          </View>
        </TouchableOpacity>

        {/* add buttons */}
        <View style={styles.addRow}>
          {DEPT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.addBtn, { borderColor: opt.color }]}
              onPress={() => { Haptics.selectionAsync(); addItemRow(opt.value); }}
            >
              <Feather name="plus" size={14} color={opt.color} />
              <Text style={[styles.addBtnText, { color: opt.color }]}>
                إضافة صنف {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Gallery modal */}
      <ProductGalleryModal
        visible={showGallery}
        onClose={() => setShowGallery(false)}
        onConfirm={addItemsFromGallery}
      />

      {/* صورة */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>صورة الطلب</Text>
        <TouchableOpacity style={styles.imageArea} onPress={handleImagePress} activeOpacity={0.8}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
              <Pressable style={styles.removeImg} onPress={() => setImageUri(null)} hitSlop={10}>
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </>
          ) : (
            <View style={styles.imgPlaceholder}>
              <Feather name="camera" size={26} color={Colors.textMuted} />
              <Text style={styles.imgPlaceholderText}>اضغط لإضافة صورة</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ملاحظات */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ملاحظات عامة</Text>
        <TextInput
          style={[styles.input, { height: 75, textAlignVertical: "top" }]}
          value={notes} onChangeText={setNotes}
          placeholder="أي ملاحظات إضافية..." placeholderTextColor={Colors.textMuted}
          multiline textAlign="right" textAlignVertical="top"
        />
      </View>

      {/* الخصومات والعروض */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.discountToggleRow}
          onPress={() => { Haptics.selectionAsync(); setDiscountEnabled((v) => !v); }}
          activeOpacity={0.8}
        >
          <View style={styles.discountToggleLeft}>
            <View style={[styles.discountIcon, discountEnabled && styles.discountIconActive]}>
              <Feather name="tag" size={15} color={discountEnabled ? "#fff" : Colors.textSecondary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>الخصومات والعروض</Text>
              <Text style={styles.discountSubtitle}>
                {discountEnabled
                  ? (discountAmount > 0 ? `خصم ${discountAmount.toFixed(2)} ر.س` : "حدد قيمة الخصم")
                  : "اضغط لتفعيل الخصم"}
              </Text>
            </View>
          </View>
          <View style={[styles.discountSwitch, discountEnabled && styles.discountSwitchActive]}>
            <View style={[styles.discountSwitchThumb, discountEnabled && styles.discountSwitchThumbActive]} />
          </View>
        </TouchableOpacity>

        {discountEnabled && (
          <>
            {/* Type toggle */}
            <View style={styles.discountTypeRow}>
              <TouchableOpacity
                style={[styles.discountTypeBtn, discountType === "percentage" && styles.discountTypeBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setDiscountType("percentage"); }}
              >
                <Text style={[styles.discountTypeBtnText, discountType === "percentage" && styles.discountTypeBtnTextActive]}>
                  نسبة %
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.discountTypeBtn, discountType === "fixed" && styles.discountTypeBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setDiscountType("fixed"); }}
              >
                <Text style={[styles.discountTypeBtnText, discountType === "fixed" && styles.discountTypeBtnTextActive]}>
                  مبلغ ثابت ر.س
                </Text>
              </TouchableOpacity>
            </View>

            {/* Value input */}
            <View style={styles.discountValueRow}>
              <TextInput
                style={[styles.input, styles.discountValueInput]}
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountType === "percentage" ? "مثال: 10" : "مثال: 20.00"}
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                textAlign="right"
              />
              <View style={styles.discountUnit}>
                <Text style={styles.discountUnitText}>{discountType === "percentage" ? "%" : "ر.س"}</Text>
              </View>
            </View>

            {/* Reason presets */}
            <Text style={[styles.label, { marginTop: 4 }]}>سبب الخصم</Text>
            <View style={styles.discountPresets}>
              {DISCOUNT_REASON_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.discountPresetChip, discountReason === preset && styles.discountPresetChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setDiscountReason(discountReason === preset ? "" : preset); }}
                >
                  <Text style={[styles.discountPresetText, discountReason === preset && styles.discountPresetTextActive]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={discountReason}
              onChangeText={setDiscountReason}
              placeholder="أو اكتب سبباً مخصصاً..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
          </>
        )}
      </View>

      {/* طريقة الدفع */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>طريقة الدفع</Text>
        <View style={styles.paymentRow}>
          {PAYMENT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.paymentBtn,
                paymentMethod === opt.value && styles.paymentBtnActive,
              ]}
              onPress={() => { Haptics.selectionAsync(); setPaymentMethod(opt.value); }}
            >
              <Feather
                name={opt.icon as any}
                size={18}
                color={paymentMethod === opt.value ? "#fff" : Colors.textSecondary}
              />
              <Text style={[
                styles.paymentBtnText,
                paymentMethod === opt.value && styles.paymentBtnTextActive,
              ]}>
                {PAYMENT_LABELS[opt.value]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* إجمالي الفاتورة */}
      {hasPrices && (
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المجموع الفرعي</Text>
            <Text style={styles.totalValue}>{subtotal.toFixed(2)} ر.س</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.totalRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name="tag" size={12} color={Colors.warning} />
                <Text style={[styles.totalLabel, { color: Colors.warning }]}>
                  خصم{discountReason ? ` (${discountReason})` : ""}
                </Text>
              </View>
              <Text style={[styles.totalValue, { color: Colors.warning }]}>
                -{discountAmount.toFixed(2)} ر.س
              </Text>
            </View>
          )}
          {insuranceVal > 0 && (
            <View style={styles.totalRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name="shield" size={12} color={Colors.gold} />
                <Text style={styles.totalLabel}>
                  تأمين الصواني ({insurancePaymentMethod === "cash" ? "كاش" : "شبكة"})
                </Text>
              </View>
              <Text style={[styles.totalValue, { color: Colors.gold }]}>
                +{insuranceVal.toFixed(2)} ر.س
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>الإجمالي الكلي</Text>
            <Text style={styles.grandTotalValue}>{grandTotal.toFixed(2)} ر.س</Text>
          </View>

          {/* Divider */}
          <View style={styles.totalDivider} />

          {/* Amount paid */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المبلغ المدفوع</Text>
            <View style={styles.paidInputRow}>
              <Text style={styles.currency}>ر.س</Text>
              <TextInput
                style={styles.paidInput}
                value={amountPaid}
                onChangeText={setAmountPaid}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="right"
              />
            </View>
          </View>

          {/* Remaining */}
          {amountPaidVal > 0 && (
            <View style={[styles.totalRow, styles.remainingRow]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather
                  name={remainingAmount === 0 ? "check-circle" : "alert-circle"}
                  size={14}
                  color={remainingAmount === 0 ? Colors.success : Colors.accent}
                />
                <Text style={[
                  styles.grandTotalLabel,
                  { color: remainingAmount === 0 ? Colors.success : Colors.accent }
                ]}>
                  {remainingAmount === 0 ? "مُسدَّد بالكامل" : "المتبقي"}
                </Text>
              </View>
              {remainingAmount > 0 && (
                <Text style={[styles.grandTotalValue, { color: Colors.accent }]}>
                  {remainingAmount.toFixed(2)} ر.س
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* ملخص الإرسال */}
      {(halwaCount > 0 || mawaliCount > 0 || chocolateCount > 0 || cakeCount > 0) && (
        <View style={styles.summaryCard}>
          <Feather name="send" size={15} color={Colors.primary} />
          <Text style={styles.summaryText}>
            سيتم الإرسال إلى:{"  "}
            {halwaCount > 0 && <Text style={{ color: Colors.halwa, fontWeight: "700" }}>حلا زفة ({halwaCount})  </Text>}
            {mawaliCount > 0 && <Text style={{ color: Colors.mawali, fontWeight: "700" }}>معجنات ({mawaliCount})  </Text>}
            {chocolateCount > 0 && <Text style={{ color: Colors.chocolate, fontWeight: "700" }}>شوكولاتة ({chocolateCount})  </Text>}
            {cakeCount > 0 && <Text style={{ color: Colors.cake, fontWeight: "700" }}>كيك ({cakeCount})</Text>}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.85}
      >
        <Feather name="send" size={20} color="#fff" />
        <Text style={styles.submitText}>{isSubmitting ? "جاري الإرسال..." : "إرسال الفاتورة"}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>

    {/* ─── Receipt Modal ──────────────────────────────────────────── */}
    {receiptOrder && (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() => setReceiptOrder(null)}
      >
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptSheet}>
            {/* Handle */}
            <View style={styles.receiptHandle} />

            {/* Success banner */}
            <View style={styles.receiptBanner}>
              <View style={styles.receiptCheckCircle}>
                <Feather name="check" size={28} color="#fff" />
              </View>
              <Text style={styles.receiptBannerTitle}>تم الإرسال بنجاح!</Text>
              <Text style={styles.receiptBannerSub}>فاتورة #{receiptOrder.orderNumber}</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>

              {/* Order type badge */}
              {receiptOrder.orderType && (
                <View style={[styles.receiptTypeBadge, {
                  backgroundColor: receiptOrder.orderType === "delivery" ? Colors.mawali + "18" : Colors.success + "18",
                  borderColor: receiptOrder.orderType === "delivery" ? Colors.mawali + "50" : Colors.success + "50",
                }]}>
                  <Feather
                    name={receiptOrder.orderType === "delivery" ? "truck" : "shopping-bag"}
                    size={15}
                    color={receiptOrder.orderType === "delivery" ? Colors.mawali : Colors.success}
                  />
                  <Text style={[styles.receiptTypeBadgeText, {
                    color: receiptOrder.orderType === "delivery" ? Colors.mawali : Colors.success
                  }]}>
                    {ORDER_TYPE_LABELS[receiptOrder.orderType]}
                  </Text>
                </View>
              )}

              {/* Customer / creator info */}
              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>بيانات العميل ومنشئ الطلب</Text>
                <View style={styles.receiptRow}>
                  <Feather name="user" size={14} color={Colors.textMuted} />
                  <Text style={styles.receiptRowLabel}>العميل</Text>
                  <Text style={styles.receiptRowValue}>{receiptOrder.customerName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Feather name="phone" size={14} color={Colors.textMuted} />
                  <Text style={styles.receiptRowLabel}>الهاتف</Text>
                  <Text style={styles.receiptRowValue}>
                    {receiptOrder.customerPhone}
                    {receiptOrder.customerPhone2 ? `\n${receiptOrder.customerPhone2}` : ""}
                  </Text>
                </View>
                {receiptOrder.cashierEmployee && (
                  <View style={styles.receiptRow}>
                    <Feather name="edit-3" size={14} color={Colors.gold} />
                    <Text style={styles.receiptRowLabel}>منشئ الطلب</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.primary }]}>
                      {receiptOrder.cashierEmployee.name} #{receiptOrder.cashierEmployee.employeeId}
                    </Text>
                  </View>
                )}
              </View>

              {/* Timing */}
              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>التوقيت</Text>
                <View style={styles.receiptRow}>
                  <Feather name="clock" size={14} color={Colors.textMuted} />
                  <Text style={styles.receiptRowLabel}>تاريخ الطلب</Text>
                  <Text style={styles.receiptRowValue}>{receiptOrder.receivedAt}</Text>
                </View>
                {receiptOrder.deliveryTime ? (
                  <View style={styles.receiptRow}>
                    <Feather name="calendar" size={14} color={Colors.success} />
                    <Text style={styles.receiptRowLabel}>موعد التسليم</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.success }]}>{receiptOrder.deliveryTime}</Text>
                  </View>
                ) : null}
                {receiptOrder.paymentMethod ? (
                  <View style={styles.receiptRow}>
                    <Feather name="credit-card" size={14} color={Colors.textMuted} />
                    <Text style={styles.receiptRowLabel}>طريقة الدفع</Text>
                    <Text style={styles.receiptRowValue}>{PAYMENT_LABELS[receiptOrder.paymentMethod]}</Text>
                  </View>
                ) : null}
              </View>

              {/* Items */}
              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>الأصناف والتفاصيل</Text>
                {receiptOrder.items.map((item) => (
                  <View key={item.id}>
                    <View style={styles.receiptItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.receiptItemName}>{item.name}</Text>
                        {item.note ? <Text style={styles.receiptItemNote}>{item.note}</Text> : null}
                        {item.details ? (
                          <Text style={styles.receiptItemDetails} numberOfLines={4}>{item.details}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.receiptItemQty}>×{item.quantity}</Text>
                      {item.price ? (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.receiptItemPrice}>
                            {(item.price * item.quantity).toFixed(2)} ر.س
                          </Text>
                          <Text style={styles.receiptItemUnit}>{item.price} ر.س/وحدة</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
                {receiptOrder.discount && (
                  <View style={styles.receiptItemRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                      <Feather name="tag" size={12} color={Colors.warning} />
                      <Text style={[styles.receiptItemName, { color: Colors.warning }]}>
                        خصم{receiptOrder.discount.reason ? ` (${receiptOrder.discount.reason})` : ""}
                      </Text>
                    </View>
                    <Text style={[styles.receiptItemPrice, { color: Colors.warning }]}>
                      {receiptOrder.discount.type === "percentage"
                        ? `${receiptOrder.discount.value}%`
                        : `-${receiptOrder.discount.value.toFixed(2)} ر.س`}
                    </Text>
                  </View>
                )}
                {receiptOrder.totalAmount ? (
                  <View style={[styles.receiptItemRow, styles.receiptTotalRow]}>
                    <Text style={styles.receiptTotalLabel}>الإجمالي الكلي</Text>
                    <Text style={styles.receiptTotalAmount}>
                      {receiptOrder.totalAmount.toFixed(2)} ر.س
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Insurance */}
              {receiptOrder.insuranceAmount ? (
                <View style={[styles.receiptCard, { borderColor: Colors.gold + "40", borderWidth: 1 }]}>
                  <Text style={styles.receiptSectionTitle}>تأمين الصواني</Text>
                  <View style={styles.receiptRow}>
                    <Feather name="shield" size={14} color={Colors.gold} />
                    <Text style={styles.receiptRowLabel}>المبلغ</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.gold }]}>
                      {receiptOrder.insuranceAmount.toFixed(2)} ر.س ({receiptOrder.insurancePaymentMethod === "card" ? "شبكة" : "كاش"})
                    </Text>
                  </View>
                  <View style={styles.receiptInsNote}>
                    <Feather name="info" size={12} color={Colors.gold} />
                    <Text style={styles.receiptInsNoteText}>مدة التأمين 3 أيام حتى استرجاع الصواني</Text>
                  </View>
                </View>
              ) : null}

              {/* Financial summary */}
              {receiptOrder.amountPaid != null && (
                <View style={styles.receiptCard}>
                  <Text style={styles.receiptSectionTitle}>الحساب</Text>
                  <View style={styles.receiptRow}>
                    <Feather name="dollar-sign" size={14} color={Colors.success} />
                    <Text style={styles.receiptRowLabel}>المبلغ المدفوع</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.success }]}>
                      {receiptOrder.amountPaid.toFixed(2)} ر.س
                    </Text>
                  </View>
                  {receiptOrder.totalAmount != null && (
                    <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                      <Feather
                        name={receiptOrder.amountPaid >= receiptOrder.totalAmount ? "check-circle" : "alert-circle"}
                        size={14}
                        color={receiptOrder.amountPaid >= receiptOrder.totalAmount ? Colors.success : Colors.accent}
                      />
                      <Text style={[styles.receiptTotalLabel, {
                        color: receiptOrder.amountPaid >= receiptOrder.totalAmount ? Colors.success : Colors.accent
                      }]}>
                        {receiptOrder.amountPaid >= receiptOrder.totalAmount ? "مُسدَّد بالكامل" : "المتبقي"}
                      </Text>
                      {receiptOrder.amountPaid < receiptOrder.totalAmount && (
                        <Text style={[styles.receiptTotalAmount, { color: Colors.accent }]}>
                          {(receiptOrder.totalAmount - receiptOrder.amountPaid).toFixed(2)} ر.س
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

            </ScrollView>

            {/* Share buttons */}
            <View style={styles.receiptActions}>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => shareViaWhatsApp(receiptOrder)}
                activeOpacity={0.85}
              >
                <Text style={styles.whatsappBtnText}>📱 إرسال عبر واتساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => shareAsText(receiptOrder)}
                activeOpacity={0.85}
              >
                <Feather name="share-2" size={16} color={Colors.primary} />
                <Text style={styles.shareBtnText}>مشاركة</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeReceiptBtn}
                onPress={() => setReceiptOrder(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeReceiptText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 10,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  label: { fontSize: 12, color: Colors.textSecondary, marginBottom: -4 },
  row: { flexDirection: "row", alignItems: "center" },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14,
    color: Colors.text, backgroundColor: Colors.surfaceSecondary,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary + "15",
    alignItems: "center", justifyContent: "center",
  },
  autoText: { flex: 1, fontSize: 14, color: Colors.primary, fontWeight: "600", textAlign: "right" },
  autoBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  autoBadgeText: { fontSize: 11, color: Colors.success, fontWeight: "600" },
  inlineInput: { flex: 1, fontSize: 14, color: Colors.text, textAlign: "right" },
  currency: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  colHeaders: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -4 },
  colLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "center" },
  deptSummary: { flexDirection: "row", gap: 6 },
  deptPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deptPillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemName: { flex: 1, paddingVertical: 10 },
  qtyBox: {
    flexDirection: "row", alignItems: "center", width: 80,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    overflow: "hidden", backgroundColor: Colors.surfaceSecondary,
  },
  qtyBtn: { width: 26, height: 40, alignItems: "center", justifyContent: "center" },
  qtyVal: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: Colors.text },
  deptToggle: {
    width: 58, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  deptToggleText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  noteInput: { fontSize: 12, paddingVertical: 8 },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addBtn: {
    flexBasis: "47%", flexGrow: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    backgroundColor: Colors.surface,
  },
  addBtnText: { fontSize: 12, fontWeight: "600" },
  imageArea: {
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed",
    borderRadius: 12, overflow: "hidden", minHeight: 120,
  },
  imgPlaceholder: {
    flex: 1, minHeight: 120, alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.surfaceSecondary,
  },
  imgPlaceholderText: { fontSize: 13, color: Colors.textSecondary },
  preview: { width: "100%", height: 170 },
  removeImg: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 14,
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
  },
  summaryCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: Colors.primary + "0D",
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.primary + "25",
  },
  summaryText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  empDisplay: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.success + "10", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.success + "30",
  },
  empDisplayText: { flex: 1, fontSize: 13, color: Colors.text },
  galleryBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.gold + "12",
    borderWidth: 1.5, borderColor: Colors.gold + "50",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 4,
  },
  galleryBtnText: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.gold, textAlign: "right" },
  galleryBtnBadge: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.gold + "20",
    alignItems: "center", justifyContent: "center",
  },

  // price input
  priceInput: { width: 66, paddingVertical: 10, paddingHorizontal: 6, fontSize: 13 },
  lineTotalHint: {
    fontSize: 11, color: Colors.textMuted, textAlign: "right",
    marginTop: -6, marginBottom: 2, paddingRight: 2,
  },

  // offer banner
  offerBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.success + "14",
    borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: Colors.success + "40",
  },
  offerBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.success, alignItems: "center", justifyContent: "center",
    shadowColor: Colors.success, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  offerBannerTitle: { fontSize: 13, fontWeight: "700", color: Colors.success },
  offerBannerSub: { fontSize: 11, color: Colors.success + "CC", marginTop: 2, lineHeight: 16 },
  offerBannerBadge: {
    backgroundColor: Colors.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  offerBannerBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },

  // discount card
  discountToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  discountToggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  discountIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  discountIconActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  discountSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  discountSwitch: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border,
    justifyContent: "center", paddingHorizontal: 2,
  },
  discountSwitchActive: { backgroundColor: Colors.warning },
  discountSwitchThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  discountSwitchThumbActive: { transform: [{ translateX: 18 }] },
  discountTypeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  discountTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
  },
  discountTypeBtnActive: { borderColor: Colors.warning, backgroundColor: Colors.warning + "15" },
  discountTypeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  discountTypeBtnTextActive: { color: Colors.warning },
  discountValueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  discountValueInput: { flex: 1 },
  discountUnit: {
    width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.warning + "18", borderWidth: 1, borderColor: Colors.warning + "40",
  },
  discountUnitText: { fontSize: 15, fontWeight: "700", color: Colors.warning },
  discountPresets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  discountPresetChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  discountPresetChipActive: { borderColor: Colors.warning, backgroundColor: Colors.warning + "18" },
  discountPresetText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  discountPresetTextActive: { color: Colors.warning },

  // payment method
  paymentRow: { flexDirection: "row", gap: 10 },
  paymentBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  paymentBtnActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  paymentBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  paymentBtnTextActive: { color: "#fff" },

  // totals card
  totalCard: {
    backgroundColor: Colors.primary + "08", borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Colors.primary + "20", gap: 8,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: Colors.textSecondary },
  totalValue: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  grandTotalRow: {
    borderTopWidth: 1, borderTopColor: Colors.primary + "30",
    paddingTop: 10, marginTop: 2,
  },
  grandTotalLabel: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  grandTotalValue: { fontSize: 18, fontWeight: "800", color: Colors.primary },

  // receipt modal
  receiptOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end",
  },
  receiptSheet: {
    backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "90%", overflow: "hidden",
  },
  receiptHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: "center", marginTop: 10, marginBottom: 6,
  },
  receiptBanner: {
    backgroundColor: Colors.primary, paddingVertical: 20, paddingHorizontal: 24,
    alignItems: "center", gap: 6,
  },
  receiptCheckCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.success, alignItems: "center", justifyContent: "center",
    marginBottom: 4, shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  receiptBannerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  receiptBannerSub: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  receiptCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 10,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  receiptSectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  receiptRowLabel: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  receiptRowValue: { fontSize: 13, fontWeight: "600", color: Colors.text, textAlign: "left" },
  receiptItemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  receiptItemName: { flex: 1, fontSize: 13, color: Colors.text },
  receiptItemQty: { fontSize: 12, color: Colors.textMuted },
  receiptItemPrice: { fontSize: 13, fontWeight: "600", color: Colors.text, minWidth: 60, textAlign: "left" },
  receiptTotalRow: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4,
  },
  receiptTotalLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.primary },
  receiptTotalAmount: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  receiptActions: {
    padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  whatsappBtn: {
    backgroundColor: "#25D366", borderRadius: 14, paddingVertical: 14,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#25D366", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  whatsappBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 14, paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  shareBtnText: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  closeReceiptBtn: {
    alignItems: "center", paddingVertical: 10,
  },
  closeReceiptText: { color: Colors.textMuted, fontSize: 14 },

  // order type toggle
  orderTypeRow: { flexDirection: "row", gap: 10 },
  orderTypeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  orderTypeBtnActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  orderTypeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  orderTypeBtnTextActive: { color: "#fff" },

  // insurance payment method
  insPayRow: { flexDirection: "row", gap: 10 },
  insPayBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  insPayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  insPayBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  insPayBtnTextActive: { color: "#fff" },
  insNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.gold + "15", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.gold + "35",
  },
  insNoteText: { fontSize: 11, color: Colors.gold, fontWeight: "600", flex: 1 },

  // item details
  detailsInput: {
    height: 80, textAlignVertical: "top", fontSize: 12,
    paddingVertical: 8, lineHeight: 18,
  },
  charCount: { fontSize: 10, color: Colors.textMuted, textAlign: "left", marginTop: 2 },

  // totals extras
  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  paidInputRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10,
  },
  paidInput: {
    fontSize: 15, fontWeight: "700", color: Colors.primary,
    paddingVertical: 8, minWidth: 80, textAlign: "right",
  },
  remainingRow: {
    backgroundColor: Colors.accent + "08", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 2,
  },

  // receipt extras
  receiptTypeBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 10, borderWidth: 1,
    alignSelf: "flex-start",
  },
  receiptTypeBadgeText: { fontSize: 13, fontWeight: "700" },
  receiptItemNote: { fontSize: 11, color: Colors.textMuted, fontStyle: "italic", marginTop: 2 },
  receiptItemDetails: {
    fontSize: 11, color: Colors.textSecondary, marginTop: 3, lineHeight: 16,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 6, padding: 6,
  },
  receiptItemUnit: { fontSize: 10, color: Colors.textMuted },
  receiptInsNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.gold + "12", borderRadius: 8, padding: 8,
  },
  receiptInsNoteText: { fontSize: 11, color: Colors.gold, flex: 1 },
});
