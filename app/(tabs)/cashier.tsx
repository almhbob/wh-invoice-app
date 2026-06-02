import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
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
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
import { ProductGalleryModal } from "@/components/ProductGalleryModal";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";
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
import { DeliveryDateTimePicker } from "@/components/DeliveryDateTimePicker";
import { DailyClosingModal } from "@/components/DailyClosingModal";
import { canDo, ROLE_CAN_CLOSE_SHIFT } from "@/constants/rbac";
import { useShift } from "@/context/ShiftContext";
import { consumePendingClone } from "@/stores/cloneOrder";
import QRCode from "qrcode";


const DEPT_CYCLE: Partial<Record<Department, Department>> = {
  halwa: "mawali", mawali: "chocolate", chocolate: "cake", cake: "packaging", packaging: "halwa",
};
// Display order for cashier items — most important depts first
const DEPT_DISPLAY_ORDER: Department[] = ["cake", "halwa", "chocolate", "mawali", "packaging"];

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
    id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
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
  const { addOrder, orders } = useOrders();
  const { currentEmployee, setCurrentEmployee } = useEmployee();
  const { getOfferByPhone, incrementUsage } = useOffers();
  const { t } = useLang();
  const DEPT_OPTIONS = useMemo(() => [
    { value: "halwa" as Department,     label: t("deptHalwaShort"),     color: Colors.halwa },
    { value: "mawali" as Department,    label: t("deptMawaliShort"),    color: Colors.mawali },
    { value: "chocolate" as Department, label: t("deptChocolateShort"), color: Colors.chocolate },
    { value: "cake" as Department,      label: t("deptCakeShort"),      color: Colors.cake },
    { value: "packaging" as Department, label: t("deptPackagingShort"), color: Colors.packaging },
  ], [t]);
  const { company } = useCompany();
  const isLaviviane = company.id === LAVIVIANE_COMPANY_ID;
  const { products } = useProducts();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhone2, setCustomerPhone2] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [receivedAt, setReceivedAt] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [dateTimePickerOpen, setDateTimePickerOpen] = useState(false);
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [insurancePaymentMethod, setInsurancePaymentMethod] = useState<"cash" | "card">("cash");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [items, setItems] = useState<OrderItem[]>([newItem("halwa")]);
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [receiptQr, setReceiptQr] = useState<string>("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [autoItemId, setAutoItemId] = useState<string | null>(null);

  // Daily closing modal
  const [showClosing, setShowClosing] = useState(false);
  const canCloseShift = canDo(currentEmployee?.role, ROLE_CAN_CLOSE_SHIFT);
  const { lastClosed } = useShift();

  // Today's summary (for cashier strip)
  const todayOrders = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return orders.filter((o) => o.createdAt?.slice(0, 10) === today);
  }, [orders]);
  const todayTotal = todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);

  // Product autocomplete suggestions for item name input
  const autoSuggestions = useMemo(() => {
    if (!autoItemId) return [];
    const item = items.find((i) => i.id === autoItemId);
    if (!item || !item.name.trim()) return [];
    const q = item.name.trim().toLowerCase();
    return products
      .filter((p) => p.isAvailable && (
        p.name.toLowerCase().includes(q) || (p.nameEn ?? "").toLowerCase().includes(q)
      ))
      .slice(0, 6);
  }, [autoItemId, items, products]);

  // Customer auto-fill: find a previous order matching the entered phone
  const suggestedCustomer = useMemo(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 9) return null;
    if (customerName.trim()) return null; // already has a name
    const match = orders.find((o) => o.customerPhone.replace(/\D/g, "") === digits);
    return match ? { name: match.customerName, phone2: match.customerPhone2, address: match.deliveryAddress } : null;
  }, [customerPhone, customerName, orders]);

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
    const clone = consumePendingClone();
    if (clone) {
      setCustomerName(clone.customerName ?? "");
      setCustomerPhone(clone.customerPhone ?? "");
      if (clone.customerPhone2) setCustomerPhone2(clone.customerPhone2);
      if (clone.deliveryAddress) setDeliveryAddress(clone.deliveryAddress);
      setOrderType(clone.orderType ?? "pickup");
      setItems(clone.items.map((i) => ({
        ...i,
        id: Date.now().toString() + Math.random().toString(36).slice(2),
      })));
      if (clone.notes) setNotes(clone.notes);
      if (clone.paymentMethod) setPaymentMethod(clone.paymentMethod);
    }
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
  }, [customerPhone, getOfferByPhone, detectedOffer, discountEnabled, appliedOfferId]);

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
    if (status !== "granted") { Alert.alert(t("permRequired"), "يحتاج التطبيق للوصول إلى الصور"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const addReferenceImage = async () => {
    if (referenceImages.length >= 3) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert(t("permRequired"), "يحتاج التطبيق للوصول إلى الصور"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.75 });
    if (!res.canceled) setReferenceImages((prev) => [...prev, res.assets[0].uri].slice(0, 3));
  };

  const removeReferenceImage = (idx: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert(t("permRequired"), "يحتاج التطبيق للوصول إلى الكاميرا"); return; }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const handleImagePress = () => {
    if (Platform.OS === "web") { pickImage(); return; }
    Alert.alert(t("addPhotoLabel"), t("chooseSource"), [
      { text: t("camera"), onPress: takePhoto },
      { text: t("photoGallery"), onPress: pickImage },
      { text: "إلغاء", style: "cancel" },
    ]);
  };

  const resetForm = () => {
    setCustomerName(""); setCustomerPhone(""); setCustomerPhone2(""); setDeliveryAddress(""); setReceivedAt(formatNow());
    setOrderType("pickup"); setDeliveryDate(""); setDeliveryTime("");
    setInsuranceAmount(""); setInsurancePaymentMethod("cash");
    setPaymentMethod("cash"); setAmountPaid("");
    setItems([newItem("halwa")]); setNotes(""); setImageUri(null); setReferenceImages([]);
    setDiscountEnabled(false); setDiscountType("percentage");
    setDiscountValue(""); setDiscountReason("");
    setDetectedOffer(null); setAppliedOfferId(null);
  };

  // ── Totals ──────────────────────────────────────────────────────────────
  const validItems = items.filter((i) => i.name.trim() && i.quantity > 0);
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
    const addr = order.deliveryAddress ? `\nعنوان التوصيل: ${order.deliveryAddress}` : "";
    const pm = order.paymentMethod ? `\nطريقة الدفع: ${PAYMENT_LABELS[order.paymentMethod]}` : "";
    const otype = order.orderType ? `\nنوع الطلب: ${ORDER_TYPE_LABELS[order.orderType]}` : "";
    const paid = order.amountPaid != null
      ? `\nالمبلغ المدفوع: ${order.amountPaid.toFixed(2)} ر.س` : "";
    const remaining = order.amountPaid != null && order.totalAmount
      ? `\nالمتبقي: ${Math.max(0, order.totalAmount - order.amountPaid).toFixed(2)} ر.س` : "";
    const cashier = order.cashierEmployee ? `\nمنشئ الطلب: ${order.cashierEmployee.name} #${order.cashierEmployee.employeeId}` : "";
    const brandHeader = isLaviviane
      ? `🏰 Laviviane — Maison de Pâtisserie\n`
      : `🎂 فاتورة W&H كيك وشوكولاتة\n`;
    const brandFooter = isLaviviane
      ? `Laviviane · Fondée en 2010 🌹`
      : `شكراً لثقتكم 🙏`;
    return (
      `${brandHeader}` +
      `━━━━━━━━━━━━━━━━\n` +
      `رقم الفاتورة: #${order.orderNumber}\n` +
      `العميل: ${order.customerName}\n` +
      `الهاتف: ${order.customerPhone}${order.customerPhone2 ? ` / ${order.customerPhone2}` : ""}${otype}\n` +
      `تاريخ الطلب: ${order.receivedAt}${deliv}${addr}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `الأصناف:\n${itemLines}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      (order.totalAmount ? `الإجمالي: ${order.totalAmount.toFixed(2)} ر.س${disc}${ins}` : "") +
      `${pm}${paid}${remaining}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${cashier}\n` +
      (order.insuranceAmount ? `⚠️ ملاحظة: مدة التأمين 3 أيام حتى استرجاع الصواني\n` : "") +
      `${brandFooter}`
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

  const handleAIAnalysis = async (order: Order) => {
    setIsAiLoading(true);
    const aiBase = process.env.EXPO_PUBLIC_AI_ENDPOINT ?? "http://127.0.0.1:3000";
    try {
      const response = await fetch(`${aiBase}/analyze-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceData: order }),
      });
      const data = await response.json();
      if (data.result) {
        Alert.alert("💡 تحليل الذكاء الاصطناعي", data.result);
      } else {
        Alert.alert("⚠️ تنبيه", "لم نتمكن من الحصول على تحليل، تأكد من تشغيل الخادم.");
      }
    } catch {
      Alert.alert("⚠️ فشل الاتصال", "تعذّر الاتصال بخادم Termux. تأكد أنه يعمل في الخلفية.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const buildInvoiceHtml = (order: Order, qrDataUrl?: string) => {
    const itemRows = order.items.map((item) => {
      const lineTotal = item.price ? `${(item.price * item.quantity).toFixed(2)} ر.س` : "—";
      const unitPrice = item.price ? `${item.price} ر.س` : "—";
      const details = item.details ? `<div style="font-size:8px;color:#555;margin-top:2px">${item.details}</div>` : "";
      const note = item.note ? `<div style="font-size:8px;color:#777">${item.note}</div>` : "";
      return `<tr>
        <td style="padding:4px 3px;border-bottom:1px dashed #ccc;vertical-align:top">
          <div style="font-weight:700">${item.name}</div>${details}${note}
        </td>
        <td style="padding:4px 3px;border-bottom:1px dashed #ccc;text-align:center;white-space:nowrap">${item.quantity}</td>
        <td style="padding:4px 3px;border-bottom:1px dashed #ccc;text-align:left;white-space:nowrap">${unitPrice}</td>
        <td style="padding:4px 3px;border-bottom:1px dashed #ccc;text-align:left;white-space:nowrap;font-weight:700">${lineTotal}</td>
      </tr>`;
    }).join("");

    const discountHtml = order.discount ? `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>خصم${order.discount.reason ? ` (${order.discount.reason})` : ""}</span>
        <span>${order.discount.type === "percentage" ? `${order.discount.value}%` : `${order.discount.value.toFixed(2)} ر.س`}</span>
      </div>` : "";

    const insuranceHtml = order.insuranceAmount ? `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>تأمين الصواني (${order.insurancePaymentMethod === "card" ? "شبكة" : "كاش"})</span>
        <span>${order.insuranceAmount.toFixed(2)} ر.س</span>
      </div>` : "";

    const paymentHtml = order.paymentMethod ? `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>طريقة الدفع</span><span>${PAYMENT_LABELS[order.paymentMethod]}</span>
      </div>` : "";

    const paidHtml = order.amountPaid != null ? `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>المبلغ المدفوع</span><span style="font-weight:700">${order.amountPaid.toFixed(2)} ر.س</span>
      </div>
      ${order.totalAmount && order.amountPaid < order.totalAmount ? `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>المتبقي</span><span style="font-weight:900">${(order.totalAmount - order.amountPaid).toFixed(2)} ر.س</span>
      </div>` : ""}` : "";

    const deliveryHtml = order.deliveryTime ? `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>موعد التسليم</span><span style="font-weight:700">${order.deliveryTime}</span>
      </div>` : "";

    const addressHtml = order.deliveryAddress ? `
      <div style="margin:3px 0;font-size:10px">
        <span style="color:#555">عنوان التوصيل: </span><span style="font-weight:700">${order.deliveryAddress}</span>
      </div>` : "";

    const insuranceNote = order.insuranceAmount
      ? `<div style="font-size:9px;border:1px dashed #000;padding:4px 6px;margin-top:6px;border-radius:3px">⚠️ ملاحظة: مدة التأمين 3 أيام حتى استرجاع الصواني</div>` : "";

    const cashierHtml = order.cashierEmployee
      ? `${order.cashierEmployee.name} #${order.cashierEmployee.employeeId}` : "—";

    const isLavivianeOrder = isLaviviane;
    const logoBlock = isLavivianeOrder
      ? `<img src="/laviviane-logo.png" alt="Laviviane" style="height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px" />
         <div style="font-size:8px;letter-spacing:2px;color:#555;text-align:center">MAISON DE PÂTISSERIE · FONDÉE EN 2010</div>`
      : `<div style="font-size:18px;font-weight:900">فاتورة</div>`;

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة #${order.orderNumber}</title>
<style>
  @page { size: auto; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11px; color: #000; background: #fff; direction: rtl; }
  .center { text-align: center; }
  .divider-solid { border: none; border-top: 1.5px solid #000; margin: 6px 0; }
  .divider-dash { border: none; border-top: 1px dashed #888; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { padding: 4px 3px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; text-align: right; font-size: 9px; }
  th:last-child, td:last-child { text-align: left; }
  th:nth-child(2), td:nth-child(2) { text-align: center; }
  .total-line { display: flex; justify-content: space-between; margin: 4px 0; }
  .grand-total { font-size: 14px; font-weight: 900; border-top: 2px solid #000; padding-top: 5px; margin-top: 4px; }
  .footer { font-size: 9px; text-align: center; margin-top: 8px; color: #333; }
  .badge { display: inline-block; border: 1px solid #000; border-radius: 3px; padding: 1px 7px; font-size: 9px; font-weight: 900; }
  @media print { body { font-size: 10px; } }
</style>
</head>
<body>
  <div class="center" style="padding-bottom:7px;border-bottom:2px solid #000;margin-bottom:7px">
    ${logoBlock}
  </div>

  <div class="center" style="margin:5px 0">
    <div style="font-size:13px;font-weight:900">فاتورة #${order.orderNumber}</div>
    ${order.orderType ? `<span class="badge">${order.orderType === "delivery" ? "توصيل" : "استلام"}</span>` : ""}
  </div>

  <hr class="divider-dash">

  <div class="total-line"><span style="color:#555">العميل</span><span style="font-weight:700">${order.customerName}</span></div>
  <div class="total-line"><span style="color:#555">الهاتف</span><span>${order.customerPhone}${order.customerPhone2 ? ` / ${order.customerPhone2}` : ""}</span></div>
  <div class="total-line"><span style="color:#555">تاريخ الطلب</span><span>${order.receivedAt}</span></div>
  ${deliveryHtml}
  ${addressHtml}
  <div class="total-line"><span style="color:#555">منشئ الطلب</span><span>${cashierHtml}</span></div>

  <hr class="divider-solid">

  <table>
    <thead>
      <tr>
        <th>الصنف</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="divider-dash">

  ${discountHtml}
  ${insuranceHtml}
  ${order.totalAmount ? `<div class="total-line grand-total"><span>الإجمالي الكلي</span><span>${order.totalAmount.toFixed(2)} ر.س</span></div>` : ""}
  ${paymentHtml}
  ${paidHtml}

  ${insuranceNote}

  <hr class="divider-solid" style="margin-top:8px">
  <div class="footer">
    شكراً لثقتكم · طُبع بتاريخ ${new Date().toLocaleDateString("ar-SA")}
  </div>
</body>
</html>`;

    const qrBlock = qrDataUrl
      ? `<div style="text-align:center;margin:10px 0 4px">
           <img src="${qrDataUrl}" alt="QR" style="width:90px;height:90px;" />
           <div style="font-size:8px;color:#888;margin-top:2px">فاتورة #${order.orderNumber}</div>
         </div>`
      : "";

    return html.replace("</body>", `${qrBlock}</body>`);
  };

  const showInlineInvoice = async (order: Order) => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(
        `فاتورة #${order.orderNumber}\n${order.customerName}\n${order.customerPhone}\n${order.receivedAt}${order.totalAmount ? `\nالإجمالي: ${order.totalAmount.toFixed(2)} ر.س` : ""}`,
        { width: 140, margin: 1, color: { dark: "#2f241d", light: "#ffffff" } }
      );
    } catch { /* skip QR on failure */ }

    const html = buildInvoiceHtml(order, qrDataUrl);

    document.getElementById("__inv_overlay__")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "__inv_overlay__";
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;";

    const bar = document.createElement("div");
    bar.style.cssText = "background:#1a1a1a;padding:10px 16px;display:flex;align-items:center;gap:10px;direction:rtl;flex-shrink:0;";

    const title = document.createElement("span");
    title.textContent = `فاتورة #${order.orderNumber} · ${order.customerName}`;
    title.style.cssText = "color:#fff;font-size:14px;font-weight:700;flex:1;font-family:sans-serif;";

    const printBtn = document.createElement("button");
    printBtn.textContent = "🖨 طباعة";
    printBtn.style.cssText = "background:#2f241d;color:#d6b56d;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700;font-family:sans-serif;";
    printBtn.onclick = () => frame.contentWindow?.print();

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ إغلاق";
    closeBtn.style.cssText = "background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-family:sans-serif;";
    closeBtn.onclick = () => overlay.remove();

    bar.appendChild(title);
    bar.appendChild(printBtn);
    bar.appendChild(closeBtn);

    const frame = document.createElement("iframe");
    frame.style.cssText = "flex:1;border:none;background:#fff;";
    frame.srcdoc = html;

    overlay.appendChild(bar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
  };

  const doSubmit = async () => {
    const filteredItems = items.filter((i) => i.name.trim() && i.quantity > 0);
    const insurance = insuranceAmount.trim() ? parseFloat(insuranceAmount) : undefined;
    const total = grandTotal > 0 ? grandTotal : undefined;
    const discountData: Discount | undefined =
      discountEnabled && discountVal > 0
        ? { type: discountType, value: discountVal, reason: discountReason.trim() }
        : undefined;

    setShowPreview(false);
    setIsSubmitting(true);
    try {
      const paidNum = amountPaidVal > 0 ? amountPaidVal : undefined;
      const created = await addOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerPhone2: customerPhone2.trim() || undefined,
        orderType,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() || undefined : undefined,
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
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        cashierEmployee: {
          name: currentEmployee!.name,
          employeeId: currentEmployee!.employeeId,
          timestamp: new Date().toISOString(),
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (appliedOfferId) incrementUsage(appliedOfferId).catch(() => {});
      QRCode.toDataURL(
        `فاتورة #${created.orderNumber}\n${created.customerName}\n${created.customerPhone}\n${created.receivedAt}${created.totalAmount ? `\nالإجمالي: ${created.totalAmount.toFixed(2)} ر.س` : ""}`,
        { width: 160, margin: 1, color: { dark: "#2f241d", light: "#ffffff" } }
      ).then(setReceiptQr).catch(() => setReceiptQr(""));
      resetForm();
      setExpandedItems(new Set());
      setReceiptOrder(created);
    } catch {
      Alert.alert(t("errTitle"), t("errSend"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!customerName.trim()) { Alert.alert(t("errTitle"), t("errName")); return; }
    if (!customerPhone.trim()) { Alert.alert(t("errTitle"), t("errPhone")); return; }
    if (orderType === "delivery" && !deliveryAddress.trim()) { Alert.alert(t("errTitle"), t("errDelivAddress")); return; }
    const filteredItems = items.filter((i) => i.name.trim() && i.quantity > 0);
    if (filteredItems.length === 0) { Alert.alert(t("errTitle"), t("errItems")); return; }
    if (!currentEmployee) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول أولاً — اضغط على زر تغيير في الأعلى.", [{ text: "حسناً" }]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPreview(true);
  };

  // Items sorted by department display order (cake → halwa → chocolate → mawali → packaging)
  const displayItems = [...items].sort(
    (a, b) => DEPT_DISPLAY_ORDER.indexOf(a.department) - DEPT_DISPLAY_ORDER.indexOf(b.department)
  );

  // Group items preview by dept
  const halwaCount = items.filter((i) => i.department === "halwa" && i.name.trim()).length;
  const mawaliCount = items.filter((i) => i.department === "mawali" && i.name.trim()).length;
  const chocolateCount = items.filter((i) => i.department === "chocolate" && i.name.trim()).length;
  const cakeCount = items.filter((i) => i.department === "cake" && i.name.trim()).length;
  const packagingCount = items.filter((i) => i.department === "packaging" && i.name.trim()).length;

  return (
    <>
    {/* Daily closing modal */}
    <DailyClosingModal
      visible={showClosing}
      onClose={() => setShowClosing(false)}
      orders={orders}
    />

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
      {/* Today's summary strip + close shift */}
      <View style={styles.todayStrip}>
        <View style={styles.todayStripLeft}>
          <Text style={styles.todayStripCount}>{todayOrders.length}</Text>
          <Text style={styles.todayStripLabel}>طلب اليوم</Text>
        </View>
        <View style={styles.todayStripDivider} />
        <View style={styles.todayStripLeft}>
          <Text style={[styles.todayStripCount, { color: Colors.success }]}>
            {todayTotal.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.todayStripLabel}>ر.س اليوم</Text>
        </View>
        {lastClosed && (
          <>
            <View style={styles.todayStripDivider} />
            <View style={styles.todayStripLeft}>
              <Feather name="moon" size={11} color="rgba(255,255,255,0.6)" />
              <Text style={styles.todayStripLastShiftTime}>
                {new Date(lastClosed.closedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={styles.todayStripLabel}>{t("shiftLastClosed")}</Text>
            </View>
          </>
        )}
        {canCloseShift && (
          <TouchableOpacity
            style={styles.closeShiftBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowClosing(true); }}
            activeOpacity={0.85}
          >
            <Feather name="moon" size={14} color="#fff" />
            <Text style={styles.closeShiftBtnText}>{t("shiftClose")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* بيانات العميل */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("customerData")}</Text>

        <Text style={styles.label}>{t("customerName")} *</Text>
        <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName}
          placeholder="أدخل اسم العميل" placeholderTextColor={Colors.textMuted} textAlign="right" />

        <Text style={styles.label}>{t("customerPhone")} *</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={customerPhone}
            onChangeText={setCustomerPhone} placeholder="05XXXXXXXX"
            placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" textAlign="right" />
          <View style={styles.iconBox}>
            <Feather name="phone" size={18} color={Colors.primary} />
          </View>
        </View>

        {/* Customer auto-fill suggestion */}
        {suggestedCustomer && (
          <TouchableOpacity
            style={styles.autoFillChip}
            onPress={() => {
              Haptics.selectionAsync();
              setCustomerName(suggestedCustomer.name);
              if (suggestedCustomer.phone2) setCustomerPhone2(suggestedCustomer.phone2);
              if (suggestedCustomer.address) setDeliveryAddress(suggestedCustomer.address);
            }}
            activeOpacity={0.8}
          >
            <Feather name="user-check" size={13} color={Colors.primary} />
            <Text style={styles.autoFillText}>
              استخدم: <Text style={{ fontWeight: "800" }}>{suggestedCustomer.name}</Text>
            </Text>
            <Feather name="chevron-left" size={13} color={Colors.primary} />
          </TouchableOpacity>
        )}

        <Text style={styles.label}>{t("customerPhone2")} {t("optional")}</Text>
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
              <Text style={styles.offerBannerTitle}>{t("autoActivatedOffer")}</Text>
              <Text style={styles.offerBannerSub}>
                {detectedOffer.discountType === "percentage"
                  ? `خصم ${detectedOffer.discountValue}%`
                  : `خصم ${detectedOffer.discountValue.toFixed(2)} ر.س`}
                {detectedOffer.reason ? `  ·  ${detectedOffer.reason}` : ""}
                {detectedOffer.customerName ? `\n${detectedOffer.customerName}` : ""}
              </Text>
            </View>
            <View style={styles.offerBannerBadge}>
              <Text style={styles.offerBannerBadgeText}>{t("activatedLabel")}</Text>
            </View>
          </View>
        )}

        {/* Current employee display */}
        {currentEmployee ? (
          <View style={[styles.empDisplay, { justifyContent: "space-between" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="user-check" size={14} color={Colors.success} />
              <Text style={styles.empDisplayText}>
                الكاشير: <Text style={{ fontWeight: "700" }}>{currentEmployee.name}</Text>
                {"  "}
                <Text style={{ color: Colors.textMuted }}>#{currentEmployee.employeeId}</Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCurrentEmployee(null)}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: Colors.accent + "18" }}
            >
              <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: "800" }}>{t("switchBtn")}</Text>
            </TouchableOpacity>
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
        <Text style={styles.cardTitle}>{t("orderType")}</Text>
        <View style={styles.orderTypeRow}>
          {(["pickup", "delivery"] as OrderType[]).map((ot) => (
            <TouchableOpacity
              key={ot}
              style={[styles.orderTypeBtn, orderType === ot && styles.orderTypeBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setOrderType(ot); }}
              activeOpacity={0.8}
            >
              <Feather
                name={ot === "pickup" ? "shopping-bag" : "truck"}
                size={18}
                color={orderType === ot ? "#fff" : Colors.textSecondary}
              />
              <Text style={[styles.orderTypeBtnText, orderType === ot && styles.orderTypeBtnTextActive]}>
                {ot === "pickup" ? t("pickup") : t("delivery")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* عنوان التوصيل — يظهر فقط عند اختيار توصيل */}
      {orderType === "delivery" && (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -2 }}>
            <Feather name="map-pin" size={16} color={Colors.mawali} />
            <Text style={[styles.cardTitle, { color: Colors.mawali }]}>{t("deliveryAddressLabel")}</Text>
          </View>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: "top" }]}
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
            placeholder={t("addressPh")}
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />
        </View>
      )}

      {/* التوقيت */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("timingAndInsurance")}</Text>

        {/* Order date/time (auto) */}
        <Text style={styles.label}>{t("orderDateTime")}</Text>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Feather name="clock" size={15} color={Colors.primary} />
          <Text style={styles.autoText}>{receivedAt}</Text>
          <View style={styles.autoBadge}>
            <Feather name="zap" size={11} color={Colors.success} />
            <Text style={styles.autoBadgeText}>{t("autoLabel")}</Text>
          </View>
        </View>

        {/* Delivery date + time — compact modal picker */}
        <Text style={styles.label}>{t("delivDateLabel")}</Text>
        <DeliveryDateTimePicker
          dateValue={deliveryDate}
          timeValue={deliveryTime}
          onDateChange={setDeliveryDate}
          onTimeChange={setDeliveryTime}
          accentColor={Colors.primary}
          open={dateTimePickerOpen}
          onOpen={() => setDateTimePickerOpen(true)}
          onClose={() => setDateTimePickerOpen(false)}
        />

        {/* Insurance */}
        <Text style={styles.label}>{t("trayInsAmount")}</Text>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Text style={styles.currency}>{t("sar")}</Text>
          <TextInput style={[styles.inlineInput, { fontWeight: "600", color: Colors.primary }]}
            value={insuranceAmount} onChangeText={setInsuranceAmount}
            placeholder="0.00" placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" textAlign="right" />
        </View>

        {/* Insurance payment method (only when insurance > 0) */}
        {insuranceVal > 0 && (
          <>
            <Text style={styles.label}>{t("insPayMethod")}</Text>
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
                    {m === "cash" ? t("paidCash") : t("paidCard")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.insNote}>
              <Feather name="info" size={12} color={Colors.gold} />
              <Text style={styles.insNoteText}>{t("trayInsNote")}</Text>
            </View>
          </>
        )}
      </View>

      {/* الأصناف */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("itemsSection")}</Text>
          {/* dept summary */}
          <View style={styles.deptSummary}>
            {halwaCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.halwa }]}>
                <Text style={styles.deptPillText}>{t("deptHalwaShort")} {halwaCount}</Text>
              </View>
            )}
            {mawaliCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.mawali }]}>
                <Text style={styles.deptPillText}>{t("deptMawaliShort")} {mawaliCount}</Text>
              </View>
            )}
            {chocolateCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.chocolate }]}>
                <Text style={styles.deptPillText}>{t("deptChocolateShort")} {chocolateCount}</Text>
              </View>
            )}
            {cakeCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.cake }]}>
                <Text style={styles.deptPillText}>{t("deptCakeShort")} {cakeCount}</Text>
              </View>
            )}
            {packagingCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.packaging }]}>
                <Text style={styles.deptPillText}>{t("deptPackagingShort")} {packagingCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Browse gallery button — top for speed */}
        <TouchableOpacity
          style={styles.galleryBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowGallery(true); }}
          activeOpacity={0.85}
        >
          <Feather name="grid" size={16} color={Colors.gold} />
          <Text style={styles.galleryBtnText}>{t("browseProductGallery")}</Text>
          <View style={styles.galleryBtnBadge}>
            <Feather name="arrow-left" size={14} color={Colors.gold} />
          </View>
        </TouchableOpacity>

        {/* Column headers */}
        <View style={styles.colHeaders}>
          <Text style={[styles.colLabel, { flex: 1 }]}>{t("itemNameCol")}</Text>
          <Text style={[styles.colLabel, { width: 66 }]}>{t("priceCol")}</Text>
          <Text style={[styles.colLabel, { width: 74 }]}>{t("qtyCol")}</Text>
          <Text style={[styles.colLabel, { width: 52 }]}>{t("deptCol")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {(() => {
          let lastDept = "";
          return displayItems.map((item, idx) => {
          const deptConf = DEPT_OPTIONS.find((d) => d.value === item.department)!;
          const lineTotal = (item.price || 0) * item.quantity;
          const isExpanded = expandedItems.has(item.id);
          const hasNote = !!(item.note?.trim());
          const showDeptSep = item.name.trim() && item.department !== lastDept;
          if (item.name.trim()) lastDept = item.department;
          return (
            <View key={item.id} style={styles.itemBlock}>
              {showDeptSep && cakeCount + halwaCount + chocolateCount + mawaliCount + packagingCount > 1 && (
                <View style={[styles.deptSepLine, { borderColor: deptConf.color + "60" }]}>
                  <View style={[styles.deptSepDot, { backgroundColor: deptConf.color }]} />
                  <Text style={[styles.deptSepLabel, { color: deptConf.color }]}>{deptConf.label}</Text>
                </View>
              )}
              {/* ── Main row ── */}
              <View style={styles.itemRow}>
                <View style={styles.itemNameWrap}>
                  <TextInput
                    style={[styles.input, styles.itemName]}
                    value={item.name}
                    onChangeText={(v) => { updateItem(item.id, "name", v); setAutoItemId(item.id); }}
                    onFocus={() => setAutoItemId(item.id)}
                    onBlur={() => setTimeout(() => setAutoItemId(null), 200)}
                    placeholder={`صنف ${idx + 1}`}
                    placeholderTextColor={Colors.textMuted}
                    textAlign="right"
                  />
                  {autoItemId === item.id && autoSuggestions.length > 0 && (
                    <View style={styles.autoList}>
                      {autoSuggestions.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.autoItem}
                          onPress={() => {
                            updateItem(item.id, "name", p.name);
                            updateItem(item.id, "price", p.price);
                            updateItem(item.id, "department", p.department as any);
                            setAutoItemId(null);
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.autoItemName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.autoItemPrice}>{p.price} ر.س</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
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
                <TouchableOpacity
                  style={[styles.deptToggle, { backgroundColor: deptConf.color }]}
                  onPress={() => toggleDept(item.id)}
                >
                  <Text style={styles.deptToggleText}>{deptConf.label}</Text>
                </TouchableOpacity>
                {items.length > 1 ? (
                  <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Feather name="x" size={16} color={Colors.accent} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 16 }} />
                )}
              </View>

              {/* ── Sub-row: total + note toggle ── */}
              <View style={styles.itemSubRow}>
                {lineTotal > 0 ? (
                  <Text style={styles.lineTotalHint}>{item.quantity} × {item.price} = {lineTotal.toFixed(2)} ر.س</Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {item.name.trim() ? (
                  <TouchableOpacity
                    style={styles.itemNoteToggle}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setExpandedItems((prev) => {
                        const next = new Set(prev);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={isExpanded ? "chevron-up" : "message-square"}
                      size={12}
                      color={hasNote ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={[styles.itemNoteToggleText, hasNote && { color: Colors.primary }]}>
                      {hasNote ? `${t("noteLabel")} ✓` : t("noteLabel")}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* ── Inline note (expanded or has content) ── */}
              {item.name.trim() && (isExpanded || hasNote) && (
                <TextInput
                  style={[styles.input, styles.noteInput, { marginTop: 2 }]}
                  value={item.note || ""}
                  onChangeText={(v) => updateItem(item.id, "note", v)}
                  placeholder={`ملاحظة على "${item.name.trim()}"...`}
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                  autoFocus={isExpanded && !hasNote}
                />
              )}
            </View>
          );
          });
        })()}

        {/* add buttons */}
        {isLaviviane ? (
          <TouchableOpacity
            style={styles.addBtnSingle}
            onPress={() => { Haptics.selectionAsync(); addItemRow("cake"); }}
          >
            <Feather name="plus" size={14} color={Colors.primary} />
            <Text style={styles.addBtnSingleText}>إضافة صنف يدوياً</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addRow}>
            {DEPT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.addBtn, { borderColor: opt.color }]}
                onPress={() => { Haptics.selectionAsync(); addItemRow(opt.value); }}
              >
                <Feather name="plus" size={14} color={opt.color} />
                <Text style={[styles.addBtnText, { color: opt.color }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Gallery modal */}
      <ProductGalleryModal
        visible={showGallery}
        onClose={() => setShowGallery(false)}
        onConfirm={addItemsFromGallery}
      />

      {/* صورة */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("orderImageLabel")}</Text>
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
              <Text style={styles.imgPlaceholderText}>{t("tapToAddImage")}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* صور مرجعية للكيك الإسبشل */}
      {(cakeCount > 0 || referenceImages.length > 0) && (
        <View style={styles.card}>
          <View style={styles.refImgHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t("refImagesLabel")}</Text>
              <Text style={styles.refImgSub}>{t("refImagesSub")}</Text>
            </View>
            <View style={[styles.deptPill, { backgroundColor: Colors.cake }]}>
              <Text style={styles.deptPillText}>{referenceImages.length}/3</Text>
            </View>
          </View>

          <View style={styles.refImgRow}>
            {referenceImages.map((uri, idx) => (
              <View key={idx} style={styles.refImgBox}>
                <Image source={{ uri }} style={styles.refImgPreview} contentFit="cover" />
                <Pressable style={styles.refImgRemove} onPress={() => removeReferenceImage(idx)} hitSlop={8}>
                  <Feather name="x" size={13} color="#fff" />
                </Pressable>
                <View style={styles.refImgNum}>
                  <Text style={styles.refImgNumText}>{idx + 1}</Text>
                </View>
              </View>
            ))}

            {referenceImages.length < 3 && (
              <TouchableOpacity style={styles.refImgAdd} onPress={addReferenceImage} activeOpacity={0.8}>
                <Feather name="camera" size={20} color={Colors.cake} />
                <Text style={styles.refImgAddText}>إضافة{"\n"}صورة</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ملاحظات */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("generalNotes")}</Text>
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
              <Text style={styles.cardTitle}>{t("discountsOffers")}</Text>
              <Text style={styles.discountSubtitle}>
                {discountEnabled
                  ? (discountAmount > 0 ? `${t("discount")} ${discountAmount.toFixed(2)} ر.س` : t("setDiscountVal"))
                  : t("tapToDiscount")}
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
                <Text style={styles.discountUnitText}>{discountType === "percentage" ? "%" : t("sar")}</Text>
              </View>
            </View>

            {/* Reason presets */}
            <Text style={[styles.label, { marginTop: 4 }]}>{t("discountReason")}</Text>
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
        <Text style={styles.cardTitle}>{t("paymentMethod")}</Text>
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
            <Text style={styles.totalLabel}>{t("subtotal")}</Text>
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
                  {t("trayInsurance")} ({insurancePaymentMethod === "cash" ? t("paidCash") : t("paidCard")})
                </Text>
              </View>
              <Text style={[styles.totalValue, { color: Colors.gold }]}>
                +{insuranceVal.toFixed(2)} ر.س
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>{t("grandTotalAll")}</Text>
            <Text style={styles.grandTotalValue}>{grandTotal.toFixed(2)} ر.س</Text>
          </View>

          {/* Divider */}
          <View style={styles.totalDivider} />

          {/* Amount paid */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("paidAmount")}</Text>
            <View style={styles.paidInputRow}>
              <Text style={styles.currency}>{t("sar")}</Text>
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
                  {remainingAmount === 0 ? t("fullyPaid") : t("remaining")}
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
      {(halwaCount > 0 || mawaliCount > 0 || chocolateCount > 0 || cakeCount > 0 || packagingCount > 0) && (
        <View style={styles.summaryCard}>
          <Feather name="send" size={15} color={Colors.primary} />
          <Text style={styles.summaryText}>
            {t("willSendTo")}{"  "}
            {halwaCount > 0 && <Text style={{ color: Colors.halwa, fontWeight: "700" }}>{t("deptHalwaShort")} ({halwaCount})  </Text>}
            {mawaliCount > 0 && <Text style={{ color: Colors.mawali, fontWeight: "700" }}>{t("deptMawaliShort")} ({mawaliCount})  </Text>}
            {chocolateCount > 0 && <Text style={{ color: Colors.chocolate, fontWeight: "700" }}>{t("deptChocolateShort")} ({chocolateCount})  </Text>}
            {cakeCount > 0 && <Text style={{ color: Colors.cake, fontWeight: "700" }}>{t("deptCakeShort")} ({cakeCount})  </Text>}
            {packagingCount > 0 && <Text style={{ color: Colors.packaging, fontWeight: "700" }}>{t("deptPackagingShort")} ({packagingCount})</Text>}
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
        <Text style={styles.submitText}>{isSubmitting ? t("sending") : t("submitInvoice")}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>

    {/* ─── Preview Modal ──────────────────────────────────────────── */}
    {showPreview && (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewSheet}>
            <View style={styles.previewHandle} />

            {/* Header */}
            <View style={styles.previewHeader}>
              <TouchableOpacity style={styles.previewBackBtn} onPress={() => setShowPreview(false)}>
                <Feather name="arrow-right" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.previewTitle}>{t("previewOrder")}</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

              {/* بيانات العميل */}
              <View style={styles.previewSection}>
                <View style={styles.previewSectionHeader}>
                  <Feather name="user" size={14} color={Colors.primary} />
                  <Text style={styles.previewSectionTitle}>{t("customerData")}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t("nameLabel")}</Text>
                  <Text style={styles.previewValue}>{customerName.trim()}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t("phoneLabel")}</Text>
                  <Text style={styles.previewValue}>{customerPhone.trim()}</Text>
                </View>
                {customerPhone2.trim() ? (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{t("phone2Label")}</Text>
                    <Text style={styles.previewValue}>{customerPhone2.trim()}</Text>
                  </View>
                ) : null}
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t("orderTypeLabel")}</Text>
                  <View style={[styles.previewTypeBadge, orderType === "delivery" && { backgroundColor: Colors.info + "18", borderColor: Colors.info + "50" }]}>
                    <Text style={[styles.previewTypeBadgeText, orderType === "delivery" && { color: Colors.info }]}>
                      {ORDER_TYPE_LABELS[orderType]}
                    </Text>
                  </View>
                </View>
                {orderType === "delivery" && deliveryAddress.trim() ? (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{t("addressLabel")}</Text>
                    <Text style={[styles.previewValue, { flex: 1, textAlign: "left", marginLeft: 8 }]}>{deliveryAddress.trim()}</Text>
                  </View>
                ) : null}
                {deliveryDateTime ? (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{t("delivSchedule")}</Text>
                    <Text style={[styles.previewValue, { color: Colors.primary, fontWeight: "700" }]}>{deliveryDateTime}</Text>
                  </View>
                ) : null}
              </View>

              {/* الأصناف */}
              {(() => {
                const previewItems = items.filter((i) => i.name.trim() && i.quantity > 0);
                return (
                  <View style={styles.previewSection}>
                    <View style={styles.previewSectionHeader}>
                      <Feather name="shopping-bag" size={14} color={Colors.primary} />
                      <Text style={styles.previewSectionTitle}>{t("itemsSection")} ({previewItems.length})</Text>
                    </View>
                    {previewItems.map((item) => {
                      const deptConf = DEPT_OPTIONS.find((d) => d.value === item.department)!;
                      const lineTotal = item.price ? (item.price * item.quantity).toFixed(2) : null;
                      return (
                        <View key={item.id} style={styles.previewItemRow}>
                          <View style={[styles.previewDeptDot, { backgroundColor: deptConf.color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewItemName}>{item.name}</Text>
                            {item.note ? <Text style={styles.previewItemNote}>{item.note}</Text> : null}
                          </View>
                          <Text style={styles.previewItemQty}>×{item.quantity}</Text>
                          <Text style={[styles.previewItemPrice, !item.price && { color: Colors.accent }]}>
                            {lineTotal ? `${lineTotal} ر.س` : t("noPrice")}
                          </Text>
                        </View>
                      );
                    })}
                    {previewItems.some((i) => !i.price) && (
                      <View style={styles.previewWarning}>
                        <Feather name="alert-triangle" size={13} color={Colors.warning} />
                        <Text style={styles.previewWarningText}>{t("someNoPriceWarn")}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* الإجمالي */}
              {(grandTotal > 0 || discountEnabled || insuranceVal > 0) && (
                <View style={styles.previewSection}>
                  <View style={styles.previewSectionHeader}>
                    <Feather name="dollar-sign" size={14} color={Colors.primary} />
                    <Text style={styles.previewSectionTitle}>{t("previewTotalLabel")}</Text>
                  </View>
                  {subtotal > 0 && (discountAmount > 0 || insuranceVal > 0) ? (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{t("previewSubtotal")}</Text>
                      <Text style={styles.previewValue}>{subtotal.toFixed(2)} ر.س</Text>
                    </View>
                  ) : null}
                  {discountAmount > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewLabel, { color: Colors.success }]}>
                        خصم{discountReason.trim() ? ` (${discountReason.trim()})` : ""}
                      </Text>
                      <Text style={[styles.previewValue, { color: Colors.success }]}>- {discountAmount.toFixed(2)} ر.س</Text>
                    </View>
                  )}
                  {insuranceVal > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{t("trayInsurance")}</Text>
                      <Text style={styles.previewValue}>{insuranceVal.toFixed(2)} ر.س</Text>
                    </View>
                  )}
                  {grandTotal > 0 && (
                    <View style={[styles.previewRow, styles.previewTotalRow]}>
                      <Text style={styles.previewTotalLabel}>{t("grandTotalAll")}</Text>
                      <Text style={styles.previewTotalValue}>{grandTotal.toFixed(2)} ر.س</Text>
                    </View>
                  )}
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{t("paymentMethod")}</Text>
                    <Text style={styles.previewValue}>{PAYMENT_LABELS[paymentMethod]}</Text>
                  </View>
                  {amountPaidVal > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{t("paidShort")}</Text>
                      <Text style={styles.previewValue}>{amountPaidVal.toFixed(2)} ر.س</Text>
                    </View>
                  )}
                  {remainingAmount > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewLabel, { color: Colors.accent }]}>{t("remaining")}</Text>
                      <Text style={[styles.previewValue, { color: Colors.accent, fontWeight: "800" }]}>{remainingAmount.toFixed(2)} ر.س</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ملاحظات */}
              {notes.trim() ? (
                <View style={styles.previewSection}>
                  <View style={styles.previewSectionHeader}>
                    <Feather name="file-text" size={14} color={Colors.primary} />
                    <Text style={styles.previewSectionTitle}>{t("notesSection")}</Text>
                  </View>
                  <Text style={styles.previewNotes}>{notes.trim()}</Text>
                </View>
              ) : null}

              {/* الصور المرفقة */}
              {(imageUri || referenceImages.length > 0) && (
                <View style={styles.previewSection}>
                  <View style={styles.previewSectionHeader}>
                    <Feather name="image" size={14} color={Colors.primary} />
                    <Text style={styles.previewSectionTitle}>{t("attachedImages")}</Text>
                  </View>
                  <View style={styles.previewImgsRow}>
                    {imageUri && (
                      <View style={{ alignItems: "center" }}>
                        <Image source={{ uri: imageUri }} style={styles.previewThumb} contentFit="cover" />
                        <Text style={styles.previewThumbLabel}>{t("orderImageLabel")}</Text>
                      </View>
                    )}
                    {referenceImages.map((uri, i) => (
                      <View key={i} style={{ alignItems: "center" }}>
                        <Image source={{ uri }} style={styles.previewThumb} contentFit="cover" />
                        <Text style={styles.previewThumbLabel}>{t("refThumbLabel")} {i + 1}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* منشئ الطلب */}
              {currentEmployee && (
                <View style={styles.previewCashierRow}>
                  <Feather name="user-check" size={13} color={Colors.textMuted} />
                  <Text style={styles.previewCashierText}>
                    المنشئ: {currentEmployee.name} #{currentEmployee.employeeId}
                  </Text>
                </View>
              )}

              <View style={{ height: 8 }} />
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewEditBtn} onPress={() => setShowPreview(false)} activeOpacity={0.8}>
                <Feather name="edit-2" size={16} color={Colors.primary} />
                <Text style={styles.previewEditBtnText}>{t("edit")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewConfirmBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={() => void doSubmit()}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={styles.previewConfirmBtnText}>{isSubmitting ? t("sending") : t("confirmSend")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}

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

            {/* Tenant logo header */}
            {isLaviviane && (
              <View style={styles.receiptLogoHeader}>
                <Image
                  source={{ uri: "/laviviane-logo.png" }}
                  style={styles.receiptLogoImg}
                  contentFit="contain"
                />
                <Text style={styles.receiptLogoSub}>Maison de Pâtisserie</Text>
              </View>
            )}

            {/* Success banner */}
            <View style={[styles.receiptBanner, isLaviviane && { backgroundColor: "#2f241d" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, width: "100%" }}>
                <View style={[styles.receiptCheckCircle, isLaviviane && { backgroundColor: "#d6b56d" }]}>
                  <Feather name="check" size={28} color="#fff" />
                </View>
                {receiptQr ? (
                  <Image source={{ uri: receiptQr }} style={styles.receiptQrImg} contentFit="contain" />
                ) : null}
              </View>
              <Text style={styles.receiptBannerTitle}>{t("sentSuccess")}</Text>
              <Text style={styles.receiptBannerSub}>{t("invoiceNum")}{receiptOrder.orderNumber}</Text>
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
                    {receiptOrder.orderType === "pickup" ? t("pickup") : t("delivery")}
                  </Text>
                </View>
              )}

              {/* Customer / creator info */}
              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>{t("customerAndCreator")}</Text>
                <View style={styles.receiptRow}>
                  <Feather name="user" size={14} color={Colors.textMuted} />
                  <Text style={styles.receiptRowLabel}>{t("customerLabel")}</Text>
                  <Text style={styles.receiptRowValue}>{receiptOrder.customerName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Feather name="phone" size={14} color={Colors.textMuted} />
                  <Text style={styles.receiptRowLabel}>{t("phoneLabel")}</Text>
                  <Text style={styles.receiptRowValue}>
                    {receiptOrder.customerPhone}
                    {receiptOrder.customerPhone2 ? `\n${receiptOrder.customerPhone2}` : ""}
                  </Text>
                </View>
                {receiptOrder.cashierEmployee && (
                  <View style={styles.receiptRow}>
                    <Feather name="edit-3" size={14} color={Colors.gold} />
                    <Text style={styles.receiptRowLabel}>{t("creatorLabel")}</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.primary }]}>
                      {receiptOrder.cashierEmployee.name} #{receiptOrder.cashierEmployee.employeeId}
                    </Text>
                  </View>
                )}
              </View>

              {/* Timing */}
              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>{t("timingSection")}</Text>
                <View style={styles.receiptRow}>
                  <Feather name="clock" size={14} color={Colors.textMuted} />
                  <Text style={styles.receiptRowLabel}>{t("orderDateLabel")}</Text>
                  <Text style={styles.receiptRowValue}>{receiptOrder.receivedAt}</Text>
                </View>
                {receiptOrder.deliveryTime ? (
                  <View style={styles.receiptRow}>
                    <Feather name="calendar" size={14} color={Colors.success} />
                    <Text style={styles.receiptRowLabel}>{t("delivSchedule")}</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.success }]}>{receiptOrder.deliveryTime}</Text>
                  </View>
                ) : null}
                {receiptOrder.deliveryAddress ? (
                  <View style={[styles.receiptRow, { alignItems: "flex-start" }]}>
                    <Feather name="map-pin" size={14} color={Colors.mawali} style={{ marginTop: 2 }} />
                    <Text style={styles.receiptRowLabel}>{t("deliveryAddressLabel")}</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.mawali, flex: 1.5, flexWrap: "wrap" }]}>{receiptOrder.deliveryAddress}</Text>
                  </View>
                ) : null}
                {receiptOrder.paymentMethod ? (
                  <View style={styles.receiptRow}>
                    <Feather name="credit-card" size={14} color={Colors.textMuted} />
                    <Text style={styles.receiptRowLabel}>{t("paymentMethod")}</Text>
                    <Text style={styles.receiptRowValue}>{PAYMENT_LABELS[receiptOrder.paymentMethod]}</Text>
                  </View>
                ) : null}
              </View>

              {/* Items */}
              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>{t("itemsDetails")}</Text>
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
                    <Text style={styles.receiptTotalLabel}>{t("grandTotalAll")}</Text>
                    <Text style={styles.receiptTotalAmount}>
                      {receiptOrder.totalAmount.toFixed(2)} ر.س
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Insurance */}
              {receiptOrder.insuranceAmount ? (
                <View style={[styles.receiptCard, { borderColor: Colors.gold + "40", borderWidth: 1 }]}>
                  <Text style={styles.receiptSectionTitle}>{t("trayInsurance")}</Text>
                  <View style={styles.receiptRow}>
                    <Feather name="shield" size={14} color={Colors.gold} />
                    <Text style={styles.receiptRowLabel}>{t("amountLabel")}</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.gold }]}>
                      {receiptOrder.insuranceAmount.toFixed(2)} {t("sar")} ({receiptOrder.insurancePaymentMethod === "card" ? t("paidCard") : t("paidCash")})
                    </Text>
                  </View>
                  <View style={styles.receiptInsNote}>
                    <Feather name="info" size={12} color={Colors.gold} />
                    <Text style={styles.receiptInsNoteText}>{t("trayInsNote")}</Text>
                  </View>
                </View>
              ) : null}

              {/* Financial summary */}
              {receiptOrder.amountPaid != null && (
                <View style={styles.receiptCard}>
                  <Text style={styles.receiptSectionTitle}>{t("accountSection")}</Text>
                  <View style={styles.receiptRow}>
                    <Feather name="dollar-sign" size={14} color={Colors.success} />
                    <Text style={styles.receiptRowLabel}>{t("paidAmount")}</Text>
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
                        {receiptOrder.amountPaid >= receiptOrder.totalAmount ? t("fullyPaid") : t("remaining")}
                      </Text>
                      {receiptOrder.amountPaid < receiptOrder.totalAmount && (
                        <Text style={[styles.receiptTotalAmount, { color: Colors.accent }]}>
                          {(receiptOrder.totalAmount - receiptOrder.amountPaid).toFixed(2)} {t("sar")}
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
                style={styles.printBtn}
                onPress={() => void showInlineInvoice(receiptOrder)}
                activeOpacity={0.85}
              >
                <Feather name="printer" size={16} color="#fff" />
                <Text style={styles.printBtnText}>{t("printInvoice")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => shareViaWhatsApp(receiptOrder)}
                activeOpacity={0.85}
              >
                <Text style={styles.whatsappBtnText}>📱 واتساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => shareAsText(receiptOrder)}
                activeOpacity={0.85}
              >
                <Feather name="share-2" size={16} color={Colors.primary} />
                <Text style={styles.shareBtnText}>{t("shareLabel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aiBtn, isAiLoading && { opacity: 0.7 }]}
                onPress={() => handleAIAnalysis(receiptOrder)}
                activeOpacity={0.85}
                disabled={isAiLoading}
              >
                <Text style={styles.aiBtnText}>
                  {isAiLoading ? "⏳ جارٍ التحليل..." : "🤖 تحليل بالذكاء الاصطناعي"}
                </Text>
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
  // Today summary strip
  todayStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.primary, borderRadius: 14,
    marginHorizontal: 16, marginBottom: 4, marginTop: 8,
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  todayStripLeft: { alignItems: "center", gap: 1 },
  todayStripCount: { fontSize: 18, fontWeight: "900", color: "#fff" },
  todayStripLabel: { fontSize: 10, color: "rgba(255,255,255,0.65)" },
  todayStripLastShiftTime: { fontSize: 13, fontWeight: "700", color: "#fff" },
  todayStripDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  autoFillChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.primary + "12",
    borderWidth: 1.5, borderColor: Colors.primary + "40",
    marginBottom: 4,
  },
  autoFillText: { flex: 1, fontSize: 13, color: Colors.primary },
  closeShiftBtn: {
    marginLeft: "auto" as any, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  closeShiftBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },

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
  selectedValueRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8,
    backgroundColor: Colors.primary + "12", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  selectedValueText: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.primary, textAlign: "right" },
  inlineInput: { flex: 1, fontSize: 14, color: Colors.text, textAlign: "right" },
  currency: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  colHeaders: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -4 },
  colLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "center" },
  deptSummary: { flexDirection: "row", gap: 6 },
  deptPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deptPillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  itemBlock: { gap: 0 },
  deptSepLine: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderTopWidth: 1, paddingTop: 8, marginTop: 4, marginBottom: 4,
  },
  deptSepDot: { width: 7, height: 7, borderRadius: 4 },
  deptSepLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" as const },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemSubRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 2, marginTop: 2, marginBottom: 4,
  },
  itemNoteToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  itemNoteToggleText: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  itemNameWrap: { flex: 1, position: "relative", zIndex: 10 },
  itemName: { flex: 1, paddingVertical: 10 },
  autoList: {
    position: "absolute", top: "100%", left: 0, right: 0,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
    zIndex: 100, overflow: "hidden",
  },
  autoItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  autoItemName: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: "600", textAlign: "right" },
  autoItemPrice: { fontSize: 12, color: Colors.gold, fontWeight: "700", marginLeft: 8 },
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
    flexBasis: "30%", flexGrow: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5,
    backgroundColor: Colors.surface,
  },
  addBtnText: { fontSize: 12, fontWeight: "600" },
  addBtnSingle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "08",
  },
  addBtnSingleText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
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
  receiptLogoHeader: {
    backgroundColor: "#2f241d", alignItems: "center", justifyContent: "center",
    paddingTop: 18, paddingBottom: 10, paddingHorizontal: 20, gap: 4,
  },
  receiptLogoImg: { width: 160, height: 60 },
  receiptLogoSub: { color: "#d6b56d", fontSize: 10, fontWeight: "600", letterSpacing: 1.5 },
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
  printBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#1f2937", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18,
  },
  printBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
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
  aiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#6C3FC5", borderRadius: 14, paddingVertical: 12,
    shadowColor: "#6C3FC5", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  aiBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
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

  // quick date presets
  quickDateRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  quickDateBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
  },
  quickDateBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "14" },
  quickDateText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  quickDateTextActive: { color: Colors.primary },

  // collapsible item extras
  itemExpandBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 5, paddingHorizontal: 4,
  },
  itemExpandText: { fontSize: 12, color: Colors.textMuted, flex: 1 },

  // receipt QR
  receiptQrImg: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },

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

  // order preview modal
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" },
  previewSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  previewHandle: {
    width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2,
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  previewHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  previewBackBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  previewTitle: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  previewSection: {
    marginHorizontal: 14, marginTop: 10,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 14,
  },
  previewSectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  previewSectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  previewRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4,
  },
  previewLabel: { fontSize: 12, color: Colors.textSecondary },
  previewValue: { fontSize: 12, fontWeight: "600", color: Colors.text },
  previewTypeBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    backgroundColor: Colors.success + "18", borderWidth: 1, borderColor: Colors.success + "50",
  },
  previewTypeBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.success },
  previewItemRow: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  previewDeptDot: { width: 9, height: 9, borderRadius: 5 },
  previewItemName: { fontSize: 13, fontWeight: "600", color: Colors.text },
  previewItemNote: { fontSize: 11, color: Colors.textMuted, fontStyle: "italic" },
  previewItemQty: { fontSize: 12, color: Colors.textSecondary, minWidth: 26, textAlign: "center" },
  previewItemPrice: { fontSize: 12, fontWeight: "700", color: Colors.text, minWidth: 72, textAlign: "left" },
  previewWarning: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: Colors.warning + "15", borderRadius: 8, padding: 8,
  },
  previewWarningText: { fontSize: 11, color: Colors.warning, fontWeight: "600" },
  previewTotalRow: {
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 8,
  },
  previewTotalLabel: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  previewTotalValue: { fontSize: 17, fontWeight: "900", color: Colors.primary },
  previewNotes: { fontSize: 12, color: Colors.text, lineHeight: 18 },
  previewImgsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  previewThumb: { width: 72, height: 72, borderRadius: 10 },
  previewThumbLabel: { fontSize: 10, color: Colors.textMuted, textAlign: "center", marginTop: 3 },
  previewCashierRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 14, marginTop: 10,
  },
  previewCashierText: { fontSize: 11, color: Colors.textMuted },
  previewActions: {
    flexDirection: "row", gap: 12, padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  previewEditBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primary + "08",
  },
  previewEditBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  previewConfirmBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.success,
    shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  previewConfirmBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  // reference images for special cake
  refImgHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  refImgSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  refImgRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  refImgBox: { width: 96, height: 96, borderRadius: 12, overflow: "hidden", position: "relative" },
  refImgPreview: { width: 96, height: 96 },
  refImgRemove: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, padding: 3,
  },
  refImgNum: {
    position: "absolute", bottom: 4, left: 4,
    backgroundColor: Colors.cake + "cc", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
  },
  refImgNumText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  refImgAdd: {
    width: 96, height: 96, borderRadius: 12, borderWidth: 2, borderStyle: "dashed",
    borderColor: Colors.cake + "80", alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.cake + "08", gap: 4,
  },
  refImgAddText: { fontSize: 11, color: Colors.cake, fontWeight: "600", textAlign: "center" },
});
