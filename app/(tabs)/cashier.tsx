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
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
import { ProductGalleryModal } from "@/components/ProductGalleryModal";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
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
import QRCode from "qrcode";

const DEPT_OPTIONS: { value: Department; label: string; color: string }[] = [
  { value: "halwa",     label: "حلويات",    color: Colors.halwa },
  { value: "mawali",   label: "موالح",     color: Colors.mawali },
  { value: "chocolate", label: "شوكولاتة", color: Colors.chocolate },
  { value: "cake",     label: "كيك",       color: Colors.cake },
  { value: "packaging", label: "تغليف",   color: Colors.packaging },
];
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
  const { addOrder } = useOrders();
  const { currentEmployee, setCurrentEmployee } = useEmployee();
  const { getOfferByPhone, incrementUsage } = useOffers();
  const { t } = useLang();
  const { company } = useCompany();
  const isLaviviane = company.id === LAVIVIANE_COMPANY_ID;

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhone2, setCustomerPhone2] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
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
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [receiptQr, setReceiptQr] = useState<string>("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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
    if (status !== "granted") { Alert.alert("إذن مطلوب", "يحتاج التطبيق للوصول إلى الصور"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const addReferenceImage = async () => {
    if (referenceImages.length >= 3) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("إذن مطلوب", "يحتاج التطبيق للوصول إلى الصور"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.75 });
    if (!res.canceled) setReferenceImages((prev) => [...prev, res.assets[0].uri].slice(0, 3));
  };

  const removeReferenceImage = (idx: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx));
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

  const handleSubmit = async () => {
    if (!customerName.trim()) { Alert.alert("خطأ", t("errName")); return; }
    if (!customerPhone.trim()) { Alert.alert("خطأ", t("errPhone")); return; }
    const filteredItems = items.filter((i) => i.name.trim() && i.quantity > 0);
    if (filteredItems.length === 0) { Alert.alert("خطأ", t("errItems")); return; }

    const doSubmit = async () => {
      const insurance = insuranceAmount.trim() ? parseFloat(insuranceAmount) : undefined;
      const total = grandTotal > 0 ? grandTotal : undefined;
      const discountData: Discount | undefined =
        discountEnabled && discountVal > 0
          ? { type: discountType, value: discountVal, reason: discountReason.trim() }
          : undefined;

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
        Alert.alert("خطأ", t("errSend"));
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!currentEmployee) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول أولاً — اضغط على زر تغيير في الأعلى.", [{ text: "حسناً" }]);
      return;
    }

    if (filteredItems.some((i) => i.price <= 0)) {
      Alert.alert("تنبيه", "بعض الأصناف لا تحتوي على سعر — هل تريد المتابعة؟", [
        { text: "تراجع", style: "cancel" },
        { text: "متابعة", onPress: () => { void doSubmit(); } },
      ]);
      return;
    }

    void doSubmit();
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
              <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: "800" }}>تغيير</Text>
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
            <Text style={[styles.cardTitle, { color: Colors.mawali }]}>عنوان التوصيل</Text>
          </View>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: "top" }]}
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
            placeholder="الحي، الشارع، رقم المنزل أو أي تفاصيل مفيدة..."
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />
        </View>
      )}

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
        <View style={styles.quickDateRow}>
          {[
            { label: "اليوم", days: 0 },
            { label: "غداً", days: 1 },
            { label: "+يومان", days: 2 },
            { label: "+أسبوع", days: 7 },
          ].map(({ label, days }) => {
            const d = new Date();
            d.setDate(d.getDate() + days);
            const dayNames = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
            const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} (${dayNames[d.getDay()]})`;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.quickDateBtn, deliveryDate === val && styles.quickDateBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setDeliveryDate(val); }}
              >
                <Text style={[styles.quickDateText, deliveryDate === val && styles.quickDateTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.input, styles.row, { gap: 8 }]}>
          <Feather name="calendar" size={15} color={Colors.textMuted} />
          <TextInput style={styles.inlineInput} value={deliveryDate} onChangeText={setDeliveryDate}
            placeholder="أو اكتب يدوياً..." placeholderTextColor={Colors.textMuted} textAlign="right" />
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
                <Text style={styles.deptPillText}>حلويات {halwaCount}</Text>
              </View>
            )}
            {mawaliCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.mawali }]}>
                <Text style={styles.deptPillText}>موالح {mawaliCount}</Text>
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
            {packagingCount > 0 && (
              <View style={[styles.deptPill, { backgroundColor: Colors.packaging }]}>
                <Text style={styles.deptPillText}>تغليف {packagingCount}</Text>
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
          <Text style={styles.galleryBtnText}>اختر من معرض المنتجات</Text>
          <View style={styles.galleryBtnBadge}>
            <Feather name="arrow-left" size={14} color={Colors.gold} />
          </View>
        </TouchableOpacity>

        {/* Column headers */}
        <View style={styles.colHeaders}>
          <Text style={[styles.colLabel, { flex: 1 }]}>اسم الصنف</Text>
          <Text style={[styles.colLabel, { width: 66 }]}>السعر</Text>
          <Text style={[styles.colLabel, { width: 74 }]}>الكمية</Text>
          <Text style={[styles.colLabel, { width: 52 }]}>القسم</Text>
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
                <TextInput
                  style={[styles.input, styles.itemName]}
                  value={item.name}
                  onChangeText={(v) => updateItem(item.id, "name", v)}
                  placeholder={`صنف ${idx + 1}`}
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                />
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
                      {hasNote ? "ملاحظة ✓" : "ملاحظة"}
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

      {/* صور مرجعية للكيك الإسبشل */}
      {(cakeCount > 0 || referenceImages.length > 0) && (
        <View style={styles.card}>
          <View style={styles.refImgHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>صور مرجعية للكيك</Text>
              <Text style={styles.refImgSub}>للكيك المخصص — حتى 3 صور مرجعية للقسم</Text>
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
      {(halwaCount > 0 || mawaliCount > 0 || chocolateCount > 0 || cakeCount > 0 || packagingCount > 0) && (
        <View style={styles.summaryCard}>
          <Feather name="send" size={15} color={Colors.primary} />
          <Text style={styles.summaryText}>
            سيتم الإرسال إلى:{"  "}
            {halwaCount > 0 && <Text style={{ color: Colors.halwa, fontWeight: "700" }}>حلويات ({halwaCount})  </Text>}
            {mawaliCount > 0 && <Text style={{ color: Colors.mawali, fontWeight: "700" }}>موالح ({mawaliCount})  </Text>}
            {chocolateCount > 0 && <Text style={{ color: Colors.chocolate, fontWeight: "700" }}>شوكولاتة ({chocolateCount})  </Text>}
            {cakeCount > 0 && <Text style={{ color: Colors.cake, fontWeight: "700" }}>كيك ({cakeCount})  </Text>}
            {packagingCount > 0 && <Text style={{ color: Colors.packaging, fontWeight: "700" }}>تغليف ({packagingCount})</Text>}
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
                    {receiptOrder.orderType === "pickup" ? t("pickup") : t("delivery")}
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
                {receiptOrder.deliveryAddress ? (
                  <View style={[styles.receiptRow, { alignItems: "flex-start" }]}>
                    <Feather name="map-pin" size={14} color={Colors.mawali} style={{ marginTop: 2 }} />
                    <Text style={styles.receiptRowLabel}>عنوان التوصيل</Text>
                    <Text style={[styles.receiptRowValue, { color: Colors.mawali, flex: 1.5, flexWrap: "wrap" }]}>{receiptOrder.deliveryAddress}</Text>
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
                style={styles.printBtn}
                onPress={() => void showInlineInvoice(receiptOrder)}
                activeOpacity={0.85}
              >
                <Feather name="printer" size={16} color="#fff" />
                <Text style={styles.printBtnText}>عرض وطباعة الفاتورة</Text>
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
                <Text style={styles.shareBtnText}>مشاركة</Text>
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
