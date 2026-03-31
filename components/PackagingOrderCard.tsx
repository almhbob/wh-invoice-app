import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { Department, Order, OrderStatus, useOrders } from "@/context/OrdersContext";

// ─── constants ────────────────────────────────────────────────────────────────

const DEPT_META: Record<
  Exclude<Department, "packaging">,
  { label: string; color: string; bg: string }
> = {
  halwa:     { label: "حلا زفة و ضيافة",  color: Colors.halwa,     bg: "#FFF5EE" },
  mawali:    { label: "معجنات و موالح",    color: Colors.mawali,    bg: "#EAF4FB" },
  chocolate: { label: "شوكولاتة",          color: Colors.chocolate, bg: "#FDF0E8" },
  cake:      { label: "كيك",               color: Colors.cake,      bg: "#FDE8F5" },
};

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; nextLabel: string; nextStatus: OrderStatus | null; color: string; bg: string; icon: any }
> = {
  pending:     { label: "انتظار",          nextLabel: "بدء التغليف",    nextStatus: "in_progress", color: Colors.statusPending,    bg: "#FEF9EE", icon: "clock" },
  in_progress: { label: "جاري التغليف",   nextLabel: "تم التغليف ✓",  nextStatus: "done",        color: Colors.statusInProgress, bg: "#EAF4FB", icon: "package" },
  done:        { label: "تم التغليف ✓",   nextLabel: "",               nextStatus: null,           color: Colors.statusDone,       bg: "#E9F7EF", icon: "check-circle" },
  cancelled:   { label: "ملغي",           nextLabel: "",               nextStatus: null,           color: Colors.statusCancelled ?? "#E74C3C", bg: "#FDEDEC", icon: "x-circle" },
};

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

function fmtTime(str: string) {
  if (!str) return "";
  if (str.includes("T")) {
    const d = new Date(str);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  }
  return str;
}

function fmtDate(str: string) {
  if (!str) return "";
  if (str.includes("T")) {
    const d = new Date(str);
    return d.toLocaleDateString("ar-SA");
  }
  return str;
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  order: Order;
}

export function PackagingOrderCard({ order }: Props) {
  const { updateDepartmentStatus } = useOrders();
  const { currentEmployee } = useEmployee();

  const packStatus: OrderStatus = order.departmentStatuses["packaging"] ?? "pending";
  const cfg = STATUS_CONFIG[packStatus];

  const [busy, setBusy] = useState(false);

  const handleNext = async () => {
    if (!cfg.nextStatus) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const receiverRef = currentEmployee
      ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId, timestamp: new Date().toISOString() }
      : undefined;
    await updateDepartmentStatus(order.id, "packaging", cfg.nextStatus, receiverRef);
    setBusy(false);
  };

  // group items by department (skip packaging)
  const deptGroups = Object.entries(DEPT_META).reduce<
    Record<string, { meta: typeof DEPT_META[keyof typeof DEPT_META]; items: Order["items"] }>
  >((acc, [dept, meta]) => {
    const items = order.items.filter((i) => i.department === dept);
    if (items.length > 0) acc[dept] = { meta, items };
    return acc;
  }, {});

  const subtotal = order.items.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);
  const discount = order.discount
    ? order.discount.type === "percentage"
      ? subtotal * (order.discount.value / 100)
      : order.discount.value
    : 0;
  const insurance = order.insuranceAmount ?? 0;
  const total = subtotal - discount + insurance;
  const paid = order.amountPaid ?? 0;
  const remaining = Math.max(0, total - paid);

  return (
    <View style={[styles.card, { borderTopColor: cfg.color }]}>
      {/* ── status stripe ─────────────────────────────────────────────────── */}
      <View style={[styles.statusStripe, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon} size={14} color={cfg.color} />
        <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.orderNum}>#{order.orderNumber}</Text>
      </View>

      {/* ── customer info ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Feather name="user" size={14} color={Colors.primary} />
          <Text style={styles.customerName}>{order.customerName}</Text>
          <View style={styles.orderTypeBadge}>
            <Text style={styles.orderTypeTxt}>
              {order.orderType === "delivery" ? "🚚 توصيل" : "🏪 استلام"}
            </Text>
          </View>
        </View>

        {/* phones */}
        <View style={styles.phonesRow}>
          {order.customerPhone && (
            <View style={styles.phoneChip}>
              <Feather name="phone" size={12} color={Colors.textSecondary} />
              <Text style={styles.phoneText}>{order.customerPhone}</Text>
            </View>
          )}
          {order.customerPhone2 && (
            <View style={styles.phoneChip}>
              <Feather name="phone" size={12} color={Colors.textSecondary} />
              <Text style={styles.phoneText}>{order.customerPhone2}</Text>
            </View>
          )}
        </View>

        {/* delivery date/time */}
        {order.deliveryTime && (
          <View style={styles.deliveryRow}>
            <Feather name="calendar" size={12} color={Colors.packaging} />
            <Text style={styles.deliveryText}>{fmtDate(order.deliveryTime)}</Text>
            <Text style={styles.deliveryText}>{fmtTime(order.deliveryTime)}</Text>
          </View>
        )}
      </View>

      {/* ── divider ───────────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── items grouped by department ───────────────────────────────────── */}
      {Object.entries(deptGroups).map(([dept, { meta, items }]) => (
        <View key={dept} style={[styles.deptGroup, { backgroundColor: meta.bg }]}>
          <View style={[styles.deptHeader, { backgroundColor: meta.color }]}>
            <Text style={styles.deptHeaderLabel}>{meta.label}</Text>
            <Text style={styles.deptHeaderCount}>{items.length} صنف</Text>
          </View>

          {items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.details ? (
                  <Text style={styles.itemDetails} numberOfLines={3}>{item.details}</Text>
                ) : null}
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>× {item.quantity ?? 1}</Text>
                <Text style={styles.itemPrice}>{fmtCurrency((item.price ?? 0) * (item.quantity ?? 1))}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      {/* ── financial summary ─────────────────────────────────────────────── */}
      <View style={styles.financialBox}>
        <View style={styles.finRow}>
          <Text style={styles.finLabel}>المجموع الجزئي</Text>
          <Text style={styles.finValue}>{fmtCurrency(subtotal)}</Text>
        </View>
        {discount > 0 && (
          <View style={styles.finRow}>
            <Text style={[styles.finLabel, { color: Colors.statusDone }]}>الخصم</Text>
            <Text style={[styles.finValue, { color: Colors.statusDone }]}>- {fmtCurrency(discount)}</Text>
          </View>
        )}
        {insurance > 0 && (
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>
              {"التأمين" + (order.insurancePaymentMethod ? ` (${order.insurancePaymentMethod === "cash" ? "نقداً" : "شبكة"})` : "")}
            </Text>
            <Text style={styles.finValue}>+ {fmtCurrency(insurance)}</Text>
          </View>
        )}
        <View style={[styles.finRow, styles.finTotalRow]}>
          <Text style={styles.finTotalLabel}>الإجمالي</Text>
          <Text style={styles.finTotalValue}>{fmtCurrency(total)}</Text>
        </View>
        {paid > 0 && (
          <View style={styles.finRow}>
            <Text style={[styles.finLabel, { color: Colors.statusDone }]}>المدفوع</Text>
            <Text style={[styles.finValue, { color: Colors.statusDone }]}>{fmtCurrency(paid)}</Text>
          </View>
        )}
        {remaining > 0 && (
          <View style={styles.finRow}>
            <Text style={[styles.finLabel, { color: Colors.statusPending }]}>المتبقي</Text>
            <Text style={[styles.finValue, { color: Colors.statusPending }]}>{fmtCurrency(remaining)}</Text>
          </View>
        )}
      </View>

      {/* ── insurance note ────────────────────────────────────────────────── */}
      {insurance > 0 && order.insurancePaymentMethod && (
        <View style={styles.insuranceNoteBox}>
          <Feather name="shield" size={13} color={Colors.gold} />
          <Text style={styles.insuranceNoteText}>
            {"التأمين: " + fmtCurrency(insurance) + " — " +
              (order.insurancePaymentMethod === "cash" ? "سيُدفع نقداً" : "سيُدفع بالشبكة")}
          </Text>
        </View>
      )}

      {/* ── general notes ─────────────────────────────────────────────────── */}
      {order.notes ? (
        <View style={styles.notesBox}>
          <Feather name="message-square" size={13} color={Colors.textMuted} />
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      {/* ── action button ─────────────────────────────────────────────────── */}
      {cfg.nextStatus && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: cfg.nextStatus === "done" ? Colors.statusDone : Colors.packaging }]}
          onPress={handleNext}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name={cfg.nextStatus === "done" ? "check-circle" : "package"} size={16} color="#fff" />
              <Text style={styles.actionBtnText}>{cfg.nextLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* done stamp */}
      {packStatus === "done" && (
        <View style={styles.doneStamp}>
          <Feather name="check-circle" size={13} color={Colors.statusDone} />
          <Text style={styles.doneStampText}>تم التغليف</Text>
        </View>
      )}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
    borderTopWidth: 4,
  },
  statusStripe: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusLabel: { fontSize: 13, fontWeight: "700" },
  orderNum: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  section: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" },
  customerName: { fontSize: 16, fontWeight: "800", color: Colors.text, flex: 1, textAlign: "right" },
  orderTypeBadge: {
    backgroundColor: Colors.primary + "18",
    borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  orderTypeTxt: { fontSize: 11, color: Colors.primary, fontWeight: "600" },
  phonesRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  phoneChip: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: Colors.background,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  phoneText: { fontSize: 12, color: Colors.textSecondary },
  deliveryRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    backgroundColor: Colors.packaging + "18", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-end",
  },
  deliveryText: { fontSize: 12, color: Colors.packaging, fontWeight: "600" },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
  deptGroup: { marginVertical: 6, marginHorizontal: 10, borderRadius: 10, overflow: "hidden" },
  deptHeader: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 6,
  },
  deptHeaderLabel: { fontSize: 13, fontWeight: "700", color: "#fff" },
  deptHeaderCount: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  itemRow: {
    flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.06)",
  },
  itemLeft: { flex: 1, gap: 2, alignItems: "flex-end" },
  itemName: { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right" },
  itemDetails: { fontSize: 11, color: Colors.textSecondary, textAlign: "right" },
  itemRight: { alignItems: "flex-end", gap: 1, minWidth: 70 },
  itemQty: { fontSize: 12, color: Colors.textMuted },
  itemPrice: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  financialBox: {
    margin: 10, backgroundColor: Colors.background,
    borderRadius: 10, padding: 12, gap: 5,
  },
  finRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  finLabel: { fontSize: 13, color: Colors.textSecondary },
  finValue: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  finTotalRow: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 6, marginTop: 2,
  },
  finTotalLabel: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  finTotalValue: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  insuranceNoteBox: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 6,
    marginHorizontal: 12, marginBottom: 6,
    backgroundColor: Colors.gold + "18", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  insuranceNoteText: { flex: 1, fontSize: 12, color: Colors.text, textAlign: "right" },
  notesBox: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 6,
    marginHorizontal: 12, marginBottom: 10,
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  notesText: { flex: 1, fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  actionBtn: {
    margin: 12, marginTop: 4,
    borderRadius: 12, paddingVertical: 12,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  doneStamp: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 10, paddingBottom: 14,
  },
  doneStampText: { fontSize: 13, color: Colors.statusDone, fontWeight: "700" },
});
