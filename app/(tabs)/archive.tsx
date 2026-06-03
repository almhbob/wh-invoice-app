import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { EmptyState } from "@/components/EmptyState";
import EditOrderModal from "@/components/EditOrderModal";
import { Colors } from "@/constants/colors";
import { canDo, ROLE_CAN_DELETE_ORDERS, ROLE_CAN_EDIT_ORDERS } from "@/constants/rbac";
import { useLang } from "@/context/LanguageContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useCompany } from "@/context/CompanyContext";
import { Department, Order, OrderStatus, PAYMENT_LABELS, useOrders } from "@/context/OrdersContext";
import { fmtDate } from "@/utils/dateUtils";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPT_META: Record<string, { label: string; shortLabel: string; color: string }> = {
  halwa:     { label: "قسم الحلا",      shortLabel: "حلا",      color: Colors.halwa },
  mawali:    { label: "قسم الموالح",    shortLabel: "موالح",    color: Colors.mawali },
  chocolate: { label: "قسم الشوكولاتة", shortLabel: "شوكولاتة", color: Colors.chocolate },
  cake:      { label: "قسم الكيك",      shortLabel: "كيك",      color: Colors.cake },
  packaging: { label: "قسم التغليف",    shortLabel: "تغليف",    color: Colors.packaging },
};

const DEPT_FILTERS: { value: Department | "all"; label: string }[] = [
  { value: "all",       label: "الكل" },
  { value: "halwa",     label: "حلا" },
  { value: "mawali",    label: "موالح" },
  { value: "chocolate", label: "شوكولاتة" },
  { value: "cake",      label: "كيك" },
  { value: "packaging", label: "تغليف" },
];

const PAYMENT_AR: Record<string, string> = { cash: "نقداً", card: "بطاقة", transfer: "تحويل" };

// ── Invoice HTML builder ──────────────────────────────────────────────────────

function buildInvoiceHtml(order: Order, brandName = "فاتورة", brandSub = ""): string {
  const DEPT_AR: Record<string, string> = {
    halwa: "حلا زفة", mawali: "معجنات وموالح",
    chocolate: "شوكولاتة", cake: "كيك", packaging: "تغليف",
  };

  const itemRows = order.items.map((item) =>
    `<tr>
      <td style="padding:5px 3px;border-bottom:1px solid #eee">${item.name}${item.note ? ` <span style="color:#888;font-size:9px">(${item.note})</span>` : ""}</td>
      <td style="padding:5px 3px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:5px 3px;border-bottom:1px solid #eee;text-align:center">${DEPT_AR[item.department] ?? item.department}</td>
      <td style="padding:5px 3px;border-bottom:1px solid #eee;text-align:left;font-weight:700">${item.price != null ? (item.price * item.quantity).toFixed(2) + " ر.س" : "—"}</td>
    </tr>`
  ).join("");

  const discountHtml = order.discount && order.discount.value > 0
    ? `<div style="display:flex;justify-content:space-between;color:#d97706;margin:3px 0;font-size:11px">
        <span>خصم${order.discount.reason ? ` (${order.discount.reason})` : ""}</span>
        <span>- ${order.discount.type === "percentage" ? order.discount.value + "%" : order.discount.value.toFixed(2) + " ر.س"}</span>
      </div>` : "";

  const insuranceHtml = order.insuranceAmount
    ? `<div style="display:flex;justify-content:space-between;color:#b45309;margin:3px 0;font-size:11px">
        <span>تأمين الصواني</span><span>${order.insuranceAmount.toFixed(2)} ر.س</span>
      </div>` : "";

  const paymentHtml = order.paymentMethod
    ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0">
        <span style="color:#555">طريقة الدفع</span><span style="font-weight:700">${PAYMENT_AR[order.paymentMethod] ?? order.paymentMethod}</span>
      </div>` : "";

  const deliveryHtml = order.deliveryTime
    ? `<div style="display:flex;justify-content:space-between;font-size:10px;margin:3px 0">
        <span>موعد التسليم</span><span style="font-weight:700">${order.deliveryTime}</span>
      </div>` : "";

  const addressHtml = order.deliveryAddress
    ? `<div style="margin:3px 0;font-size:10px"><span style="color:#555">عنوان التوصيل: </span><span style="font-weight:700">${order.deliveryAddress}</span></div>` : "";

  const cashierHtml = order.cashierEmployee
    ? `${order.cashierEmployee.name} #${order.cashierEmployee.employeeId}` : "—";

  const notesHtml = order.notes
    ? `<div style="background:#f0f7ff;border-right:3px solid #2980b9;padding:6px 10px;margin:4px 0;font-size:10px;border-radius:3px">
        <span style="color:#1a5276;font-weight:700">ملاحظات: </span><span>${order.notes}</span>
      </div>` : "";

  const logoBlock = brandSub
    ? `<div style="font-size:17px;font-weight:900;margin-bottom:2px">${brandName}</div>
       <div style="font-size:8px;letter-spacing:2px;color:#555">${brandSub}</div>`
    : `<div style="font-size:18px;font-weight:900">فاتورة</div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة #${order.orderNumber}</title>
<style>
  @page { size: auto; margin: 8mm 10mm; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; font-size:11px; color:#000; background:#fff; direction:rtl; }
  .center { text-align:center; }
  .divider-solid { border:none; border-top:1.5px solid #000; margin:6px 0; }
  .divider-dash { border:none; border-top:1px dashed #888; margin:5px 0; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { padding:4px 3px; border-top:1.5px solid #000; border-bottom:1.5px solid #000; text-align:right; font-size:9px; }
  th:last-child, td:last-child { text-align:left; }
  th:nth-child(2), td:nth-child(2) { text-align:center; }
  th:nth-child(3), td:nth-child(3) { text-align:center; }
  .total-line { display:flex; justify-content:space-between; margin:4px 0; }
  .grand-total { font-size:14px; font-weight:900; border-top:2px solid #000; padding-top:5px; margin-top:4px; }
  .footer { font-size:9px; text-align:center; margin-top:8px; color:#333; }
  .badge { display:inline-block; border:1px solid #000; border-radius:3px; padding:1px 7px; font-size:9px; font-weight:900; }
  @media print { body { font-size:10px; } }
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
  ${notesHtml}
  <hr class="divider-solid">
  <table>
    <thead>
      <tr>
        <th>الصنف</th><th>الكمية</th><th>القسم</th><th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="divider-dash">
  ${discountHtml}
  ${insuranceHtml}
  ${order.totalAmount != null ? `<div class="total-line grand-total"><span>الإجمالي الكلي</span><span>${order.totalAmount.toFixed(2)} ر.س</span></div>` : ""}
  ${paymentHtml}
  ${order.insuranceAmount ? `<div style="font-size:9px;border:1px dashed #000;padding:4px 6px;margin-top:6px;border-radius:3px">⚠️ مدة التأمين 3 أيام حتى استرجاع الصواني</div>` : ""}
  <hr class="divider-solid" style="margin-top:8px">
  <div class="footer">شكراً لثقتكم · طُبع بتاريخ ${new Date().toLocaleDateString("ar-SA")}</div>
</body>
</html>`;
}

// ── Print / Send helpers ──────────────────────────────────────────────────────

function showPrintOverlay(html: string, orderNum: number, customerName: string) {
  if (typeof document === "undefined") return;
  document.getElementById("__archive_inv__")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "__archive_inv__";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;";

  const bar = document.createElement("div");
  bar.style.cssText = "background:#1a1a1a;padding:10px 16px;display:flex;align-items:center;gap:10px;direction:rtl;flex-shrink:0;";

  const title = document.createElement("span");
  title.textContent = `فاتورة #${orderNum} · ${customerName}`;
  title.style.cssText = "color:#fff;font-size:14px;font-weight:700;flex:1;font-family:sans-serif;";

  const frame = document.createElement("iframe");
  frame.style.cssText = "flex:1;border:none;background:#fff;";
  frame.srcdoc = html;

  const printBtn = document.createElement("button");
  printBtn.textContent = "🖨 طباعة";
  printBtn.style.cssText = "background:#1A2744;color:#C9A84C;border:none;padding:8px 20px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700;font-family:sans-serif;";
  printBtn.onclick = () => frame.contentWindow?.print();

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ إغلاق";
  closeBtn.style.cssText = "background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-family:sans-serif;";
  closeBtn.onclick = () => overlay.remove();

  bar.appendChild(title);
  bar.appendChild(printBtn);
  bar.appendChild(closeBtn);
  overlay.appendChild(bar);
  overlay.appendChild(frame);
  document.body.appendChild(overlay);
}

async function handleSendWhatsApp(order: Order) {
  const phone = order.customerPhone.replace(/\D/g, "");
  const intl = phone.startsWith("0") ? "966" + phone.slice(1) : phone;
  const items = order.items.map((i) => `• ${i.quantity}× ${i.name}`).join("\n");
  const msg = [
    `مرحباً ${order.customerName} 👋`,
    `هذا ملخص طلبك رقم #${order.orderNumber}:`,
    "",
    items,
    "",
    order.totalAmount ? `💰 الإجمالي: ${order.totalAmount.toFixed(2)} ر.س` : "",
    order.paymentMethod ? `💳 الدفع: ${PAYMENT_AR[order.paymentMethod] ?? order.paymentMethod}` : "",
    order.deliveryTime ? `⏰ موعد التسليم: ${order.deliveryTime}` : "",
    "",
    "شكراً لثقتكم 🌟",
  ].filter(Boolean).join("\n");

  const waUrl = `whatsapp://send?phone=${intl}&text=${encodeURIComponent(msg)}`;
  Linking.openURL(waUrl).catch(() =>
    Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`)
  );
}

async function handleShareInvoiceText(order: Order) {
  const items = order.items.map((i) => `• ${i.quantity}× ${i.name}`).join("\n");
  const text = [
    `📄 فاتورة #${order.orderNumber}`,
    `👤 ${order.customerName} | 📞 ${order.customerPhone}`,
    `📅 ${order.receivedAt}`,
    "",
    items,
    "",
    order.totalAmount ? `💰 الإجمالي: ${order.totalAmount.toFixed(2)} ر.س` : "",
    order.paymentMethod ? `💳 ${PAYMENT_AR[order.paymentMethod] ?? order.paymentMethod}` : "",
  ].filter(Boolean).join("\n");
  try { await Share.share({ message: text }); } catch (_) {}
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusRow({ status }: { status?: OrderStatus }) {
  const conf: Record<OrderStatus, { label: string; color: string }> = {
    pending:     { label: "انتظار",         color: Colors.statusPending },
    in_progress: { label: "جاري التحضير",   color: Colors.statusInProgress },
    done:        { label: "تم التسليم",     color: Colors.statusDone },
    cancelled:   { label: "ملغي",           color: Colors.statusCancelled },
  };
  if (!status) return null;
  const c = conf[status];
  return (
    <View style={[styles.statusRow, { backgroundColor: c.color + "18" }]}>
      <View style={[styles.statusDot, { backgroundColor: c.color }]} />
      <Text style={[styles.statusLabel, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function ArchiveCard({
  order,
  canDelete,
  canEdit,
  brandName,
  brandSub,
  onDelete,
  onEdit,
}: {
  order: Order;
  canDelete?: boolean;
  canEdit?: boolean;
  brandName?: string;
  brandSub?: string;
  onDelete?: (o: Order) => void;
  onEdit?: (o: Order) => void;
}) {
  const { lang } = useLang();
  const depts = [...new Set(order.items.map((i) => i.department))] as Department[];

  function handlePrint() {
    Haptics.selectionAsync();
    if (Platform.OS === "web") {
      showPrintOverlay(buildInvoiceHtml(order, brandName, brandSub), order.orderNumber, order.customerName);
    } else {
      // Native: use Share to send HTML as text (expo-print not imported to avoid dependency issues)
      const text = `فاتورة #${order.orderNumber}\n${order.customerName}\n${order.totalAmount?.toFixed(2) ?? ""} ر.س`;
      Share.share({ message: text }).catch(() => {});
    }
  }

  function handleSend() {
    Haptics.selectionAsync();
    Alert.alert(
      "إرسال الفاتورة",
      "اختر طريقة الإرسال",
      [
        {
          text: "واتساب",
          onPress: () => handleSendWhatsApp(order),
        },
        {
          text: "مشاركة نص",
          onPress: () => handleShareInvoiceText(order),
        },
        { text: "إلغاء", style: "cancel" },
      ]
    );
  }

  return (
    <View style={styles.archiveCard}>
      {/* Header */}
      <View style={styles.archiveHeader}>
        <View style={styles.archiveHeaderLeft}>
          <Text style={styles.archiveNum}>#{order.orderNumber}</Text>
          <Text style={styles.archiveDate}>{fmtDate(order.createdAt, lang)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <View style={styles.deptTags}>
            {Object.entries(DEPT_META).map(([key, meta]) =>
              depts.includes(key as Department) ? (
                <View key={key} style={[styles.deptTag, { backgroundColor: meta.color }]}>
                  <Text style={styles.deptTagText}>{meta.shortLabel}</Text>
                </View>
              ) : null
            )}
          </View>
          {/* Print button */}
          <TouchableOpacity
            onPress={handlePrint}
            style={[styles.actionBtn, { backgroundColor: Colors.primary + "12" }]}
            activeOpacity={0.7}
          >
            <Feather name="printer" size={14} color={Colors.primary} />
          </TouchableOpacity>
          {/* Send/WhatsApp button */}
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.actionBtn, { backgroundColor: "#25D36618" }]}
            activeOpacity={0.7}
          >
            <Feather name="send" size={14} color="#25D366" />
          </TouchableOpacity>
          {canEdit && onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(order)}
              style={[styles.actionBtn, { backgroundColor: Colors.gold + "18" }]}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={14} color={Colors.gold} />
            </TouchableOpacity>
          )}
          {canDelete && onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(order)}
              style={[styles.actionBtn, { backgroundColor: Colors.accent + "12" }]}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={15} color={Colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Customer */}
      <View style={styles.customerBlock}>
        <View style={styles.customerRow}>
          <Feather name="user" size={13} color={Colors.primary} />
          <Text style={styles.customerName}>{order.customerName}</Text>
        </View>
        <View style={styles.customerRow}>
          <Feather name="phone" size={12} color={Colors.textMuted} />
          <Text style={styles.customerPhone}>{order.customerPhone}</Text>
        </View>
      </View>

      {/* Notes */}
      {!!order.notes && (
        <View style={styles.notesBox}>
          <Feather name="file-text" size={12} color={Colors.info} />
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      )}

      {/* Items grouped by dept */}
      {Object.entries(DEPT_META).map(([key, meta]) => {
        const deptItems = order.items.filter((i) => i.department === key);
        if (deptItems.length === 0) return null;
        return (
          <View key={key} style={[styles.deptSection, { borderLeftColor: meta.color }]}>
            <Text style={[styles.deptSectionTitle, { color: meta.color }]}>{meta.label}</Text>
            {deptItems.map((item, i) => (
              <Text key={i} style={styles.archiveItem}>
                • {item.quantity}× {item.name}{item.note ? ` (${item.note})` : ""}
              </Text>
            ))}
            <StatusRow status={order.departmentStatuses?.[key as Department]} />
          </View>
        );
      })}

      {/* Employee accountability trail */}
      <View style={styles.trailBox}>
        {order.cashierEmployee && (
          <View style={styles.trailRow}>
            <Feather name="edit-3" size={11} color={Colors.gold} />
            <Text style={styles.trailLabel}>أدخله:</Text>
            <Text style={styles.trailName}>{order.cashierEmployee.name}</Text>
            <Text style={styles.trailId}>#{order.cashierEmployee.employeeId}</Text>
          </View>
        )}
        {order.departmentReceivers && Object.entries(DEPT_META).map(([key, meta]) => {
          const receiver = order.departmentReceivers?.[key as Department];
          if (!receiver) return null;
          return (
            <View key={key} style={styles.trailRow}>
              <Feather name="check-square" size={11} color={meta.color} />
              <Text style={[styles.trailLabel, { color: meta.color }]}>استلم {meta.shortLabel}:</Text>
              <Text style={[styles.trailName, { color: meta.color }]}>{receiver.name}</Text>
              <Text style={styles.trailId}>#{receiver.employeeId}</Text>
            </View>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.archiveFooter}>
        <View style={styles.footerItem}>
          <Feather name="download" size={11} color={Colors.textMuted} />
          <Text style={styles.footerText}>{order.receivedAt}</Text>
        </View>
        {order.deliveryTime && (
          <View style={styles.footerItem}>
            <Feather name="clock" size={11} color={Colors.success} />
            <Text style={[styles.footerText, { color: Colors.success }]}>{order.deliveryTime}</Text>
          </View>
        )}
        {order.totalAmount != null && (
          <View style={styles.footerItem}>
            <Feather name="dollar-sign" size={11} color={Colors.success} />
            <Text style={[styles.footerText, { color: Colors.success, fontWeight: "700" }]}>
              {order.totalAmount.toFixed(2)} ر.س
            </Text>
          </View>
        )}
        {order.paymentMethod && (
          <View style={styles.footerItem}>
            <Feather name="credit-card" size={11} color={Colors.info} />
            <Text style={[styles.footerText, { color: Colors.info }]}>
              {PAYMENT_LABELS[order.paymentMethod]}
            </Text>
          </View>
        )}
        {order.discount && order.discount.value > 0 && (
          <View style={styles.footerItem}>
            <Feather name="tag" size={11} color={Colors.warning} />
            <Text style={[styles.footerText, { color: Colors.warning, fontWeight: "700" }]}>
              {order.discount.type === "percentage"
                ? `خصم ${order.discount.value}%`
                : `خصم ${order.discount.value.toFixed(2)} ر.س`}
              {order.discount.reason ? ` · ${order.discount.reason}` : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function DeletedCard({ order, onRestore }: { order: Order; onRestore: (id: string) => void }) {
  const { lang } = useLang();
  return (
    <View style={[styles.archiveCard, { borderLeftWidth: 3, borderLeftColor: Colors.accent }]}>
      <View style={styles.archiveHeader}>
        <View style={styles.archiveHeaderLeft}>
          <Text style={styles.archiveNum}>#{order.orderNumber}</Text>
          <Text style={styles.archiveDate}>{fmtDate(order.createdAt, lang)}</Text>
        </View>
        <View style={[styles.deptTag, { backgroundColor: Colors.accent + "18", borderRadius: 8 }]}>
          <Text style={[styles.deptTagText, { color: Colors.accent }]}>محذوف</Text>
        </View>
      </View>
      <View style={styles.customerBlock}>
        <View style={styles.customerRow}>
          <Feather name="user" size={13} color={Colors.primary} />
          <Text style={styles.customerName}>{order.customerName}</Text>
        </View>
        <View style={styles.customerRow}>
          <Feather name="phone" size={12} color={Colors.textMuted} />
          <Text style={styles.customerPhone}>{order.customerPhone}</Text>
        </View>
      </View>
      {order.deletedAt && (
        <View style={styles.trailRow}>
          <Feather name="trash-2" size={11} color={Colors.accent} />
          <Text style={styles.trailLabel}>حُذف:</Text>
          <Text style={[styles.trailName, { color: Colors.accent }]}>{fmtDate(order.deletedAt, lang)}</Text>
          {order.deletedBy && (
            <Text style={styles.trailId}>· {order.deletedBy.name}</Text>
          )}
        </View>
      )}
      <TouchableOpacity
        style={styles.restoreBtn}
        onPress={() => onRestore(order.id)}
        activeOpacity={0.8}
      >
        <Feather name="rotate-ccw" size={14} color="#fff" />
        <Text style={styles.restoreBtnText}>استرجاع الفاتورة</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ArchiveScreen() {
  const { orders, deletedOrders, deleteOrder, restoreOrder, updateOrder, purgeAllOrders } = useOrders();
  const { currentEmployee } = useEmployee();
  const { company } = useCompany();
  const isAdmin = canDo(currentEmployee?.role, ROLE_CAN_DELETE_ORDERS);
  const canEdit = canDo(currentEmployee?.role, ROLE_CAN_EDIT_ORDERS);
  const [activeTab, setActiveTab] = useState<"archive" | "trash">("archive");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (deptFilter !== "all") {
          if (!o.items.some((i) => i.department === deptFilter)) return false;
        }
        if (dateFilter && !o.createdAt.includes(dateFilter)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !o.orderNumber.toString().includes(q) &&
            !o.customerName?.toLowerCase().includes(q) &&
            !o.customerPhone?.includes(q) &&
            !o.items.some((i) => i.name.toLowerCase().includes(q))
          ) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, deptFilter, dateFilter, search]);

  const handleDelete = (order: Order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const doDelete = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      deleteOrder(
        order.id,
        currentEmployee
          ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId }
          : undefined
      );
    };
    if (Platform.OS === "web") {
      if (window.confirm(`حذف الفاتورة #${order.orderNumber}\n\nهل تريد حذف فاتورة "${order.customerName}"؟`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        `حذف الفاتورة #${order.orderNumber}`,
        `هل تريد حذف فاتورة "${order.customerName}"؟ يمكن استرجاعها لاحقاً من سلة المحذوفات.`,
        [
          { text: "إلغاء", style: "cancel" },
          { text: "حذف", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const handlePurgeAll = () => {
    const totalCount = orders.length + deletedOrders.length;
    const doPurge = async () => {
      setIsPurging(true);
      try {
        await purgeAllOrders();
        if (Platform.OS === "web") {
          window.alert("تم حذف جميع الطلبات والفواتير بنجاح.");
        } else {
          Alert.alert("تم", "تم حذف جميع الطلبات والفواتير بنجاح.");
        }
      } catch {
        if (Platform.OS === "web") {
          window.alert("حدث خطأ أثناء الحذف. حاول مرة أخرى.");
        } else {
          Alert.alert("خطأ", "حدث خطأ أثناء الحذف. حاول مرة أخرى.");
        }
      } finally {
        setIsPurging(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`⚠️ حذف ${totalCount} فاتورة نهائياً؟\n\nهذا الإجراء لا يمكن التراجع عنه.`)) {
        if (window.confirm("تأكيد نهائي: سيتم حذف جميع الفواتير من قاعدة البيانات بشكل دائم. متأكد؟")) {
          doPurge();
        }
      }
    } else {
      Alert.alert(
        "⚠️ حذف جميع الطلبات نهائياً",
        `سيتم حذف ${totalCount} فاتورة بشكل دائم لا يمكن التراجع عنه. هل أنت متأكد تماماً؟`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "نعم، احذف الكل",
            style: "destructive",
            onPress: () =>
              Alert.alert(
                "تأكيد نهائي",
                "هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع الفواتير من قاعدة البيانات نهائياً.",
                [
                  { text: "إلغاء", style: "cancel" },
                  { text: "حذف نهائي", style: "destructive", onPress: doPurge },
                ]
              ),
          },
        ]
      );
    }
  };

  const totalCount = orders.length + deletedOrders.length;

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "archive" && styles.tabItemActive]}
          onPress={() => setActiveTab("archive")}
        >
          <Feather name="archive" size={14} color={activeTab === "archive" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabLabel, activeTab === "archive" && styles.tabLabelActive]}>
            الأرشيف {orders.length > 0 ? `(${orders.length})` : ""}
          </Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.tabItem, activeTab === "trash" && styles.tabItemActive]}
            onPress={() => setActiveTab("trash")}
          >
            <Feather name="trash-2" size={14} color={activeTab === "trash" ? Colors.accent : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === "trash" && { color: Colors.accent, fontWeight: "700" }]}>
              المحذوفات {deletedOrders.length > 0 ? `(${deletedOrders.length})` : ""}
            </Text>
          </TouchableOpacity>
        )}
        {isAdmin && totalCount > 0 && (
          <TouchableOpacity
            style={[styles.tabItem, { maxWidth: 80 }]}
            onPress={handlePurgeAll}
            disabled={isPurging}
          >
            <Feather name="x-circle" size={14} color={isPurging ? Colors.textMuted : Colors.accent} />
            <Text style={[styles.tabLabel, { color: Colors.accent, fontSize: 10 }]}>
              {isPurging ? "جاري..." : "حذف الكل"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === "trash" && isAdmin ? (
        /* ── Trash tab ── */
        <FlatList
          data={deletedOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, deletedOrders.length === 0 && { flex: 1 }]}
          renderItem={({ item }) => <DeletedCard order={item} onRestore={restoreOrder} />}
          ListEmptyComponent={
            <EmptyState icon="trash-2" title="سلة المحذوفات فارغة"
              subtitle="لا توجد فواتير محذوفة حالياً" />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        /* ── Archive tab ── */
        <>
          <View style={styles.searchRow}>
            <Feather name="search" size={17} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="بحث بالرقم أو الاسم أو الهاتف أو الصنف..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filterBar}>
            <View style={styles.filterGroup}>
              {DEPT_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.chip, deptFilter === f.value && styles.chipActive]}
                  onPress={() => setDeptFilter(f.value as any)}
                >
                  <Text style={[styles.chipText, deptFilter === f.value && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.searchRow, { marginHorizontal: 0, marginTop: 6 }]}>
              <Feather name="calendar" size={14} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={dateFilter}
                onChangeText={setDateFilter}
                placeholder="تصفية بالتاريخ (مثال: 2025-01-15)"
                placeholderTextColor={Colors.textMuted}
                textAlign="right"
              />
              {dateFilter ? (
                <TouchableOpacity onPress={() => setDateFilter("")}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.countRow}>
            <Feather name="file-text" size={13} color={Colors.textMuted} />
            <Text style={styles.countText}>{filtered.length} فاتورة</Text>
          </View>

          <EditOrderModal
            order={editingOrder}
            visible={editingOrder !== null}
            onClose={() => setEditingOrder(null)}
            onSave={(id: string, patch: Parameters<typeof updateOrder>[1]) => {
              updateOrder(id, patch);
              setEditingOrder(null);
            }}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
            renderItem={({ item }) => (
              <ArchiveCard
                order={item}
                canDelete={isAdmin}
                canEdit={canEdit}
                brandName={company.name || "فاتورة"}
                onDelete={handleDelete}
                onEdit={setEditingOrder}
              />
            )}
            ListEmptyComponent={
              <EmptyState icon="archive" title="لا توجد فواتير"
                subtitle="لم يتم العثور على فواتير تطابق البحث" />
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  tabItem: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
  },
  tabItemActive: {
    backgroundColor: Colors.primary + "12",
    borderBottomWidth: 2, borderBottomColor: Colors.primary,
  },
  tabLabel: { fontSize: 13, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: "700" },
  actionBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  restoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, marginTop: 4,
  },
  restoreBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  filterBar: { marginHorizontal: 16, marginTop: 10 },
  filterGroup: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  countRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  countText: { fontSize: 13, color: Colors.textMuted },
  list: { padding: 16, paddingTop: 4 },
  archiveCard: {
    backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 14, padding: 14,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, gap: 10,
  },
  archiveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  archiveHeaderLeft: { gap: 2 },
  archiveNum: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  archiveDate: { fontSize: 12, color: Colors.textMuted },
  deptTags: { flexDirection: "row", gap: 6 },
  deptTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deptTagText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  customerBlock: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  customerName: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  customerPhone: { fontSize: 13, color: Colors.textSecondary },
  deptSection: { borderLeftWidth: 3, paddingLeft: 12, gap: 4, paddingVertical: 6 },
  deptSectionTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  archiveItem: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  statusRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 4, alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: "600" },
  trailBox: {
    backgroundColor: Colors.primary + "07", borderRadius: 10,
    padding: 10, gap: 6, borderWidth: 1, borderColor: Colors.primary + "15",
  },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  trailLabel: { fontSize: 11, color: Colors.textSecondary },
  trailName: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  trailId: { fontSize: 11, color: Colors.textMuted },
  notesBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.info + "10", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.info + "25",
  },
  notesText: { flex: 1, fontSize: 13, color: Colors.info, lineHeight: 20 },
  archiveFooter: {
    flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: Colors.textMuted },
});
