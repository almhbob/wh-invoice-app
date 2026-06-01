import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useEmployee } from "@/context/EmployeeContext";
import { Order } from "@/context/OrdersContext";
import { useShift } from "@/context/ShiftContext";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return amount.toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateAr(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

function formatTimeAr(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  orders: Order[];
}

// ─── Component ────────────────────────────────────────────────────────────

export function DailyClosingModal({ visible, onClose, orders }: Props) {
  const insets = useSafeAreaInsets();
  const { currentEmployee } = useEmployee();
  const { closeShift } = useShift();

  const [notes, setNotes] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const today = getTodayISO();

  // Compute today's orders and summary
  const todayOrders = useMemo(
    () => orders.filter((o) => !o.deleted && o.createdAt?.slice(0, 10) === today),
    [orders, today]
  );

  const summary = useMemo(() => {
    let totalAmount = 0;
    let cashAmount = 0;
    let cardAmount = 0;
    let transferAmount = 0;
    let deliveryCount = 0;
    let pickupCount = 0;
    let insuranceTotal = 0;
    let discountTotal = 0;

    for (const order of todayOrders) {
      const amount = order.totalAmount ?? 0;
      totalAmount += amount;

      if (order.paymentMethod === "cash") cashAmount += amount;
      else if (order.paymentMethod === "card") cardAmount += amount;
      else if (order.paymentMethod === "transfer") transferAmount += amount;

      if (order.orderType === "delivery") deliveryCount += 1;
      else pickupCount += 1;

      insuranceTotal += order.insuranceAmount ?? 0;

      if (order.discount) {
        const { type, value } = order.discount;
        if (type === "fixed") {
          discountTotal += value;
        } else if (type === "percentage") {
          // amount is already after discount; calculate what was removed
          const beforeDiscount = value > 0 && value < 100 ? amount / (1 - value / 100) : amount;
          discountTotal += beforeDiscount - amount;
        }
      }
    }

    return {
      orderCount: todayOrders.length,
      totalAmount,
      cashAmount,
      cardAmount,
      transferAmount,
      deliveryCount,
      pickupCount,
      insuranceTotal,
      discountTotal,
    };
  }, [todayOrders]);

  // Build shareable text report
  function buildReportText(): string {
    const now = new Date();
    const cashierName = currentEmployee?.name ?? "غير محدد";
    const lines: string[] = [
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "         تقرير إغلاق اليومية         ",
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `📅  التاريخ:  ${formatDateAr(now.toISOString())}`,
      `🕐  وقت الإغلاق:  ${formatTimeAr(now.toISOString())}`,
      `👤  الكاشير:  ${cashierName}`,
      "───────────────────────",
      "📦  ملخص الطلبات",
      `   عدد الطلبات:   ${summary.orderCount} طلب`,
      `   توصيل:  ${summary.deliveryCount}  |  استلام:  ${summary.pickupCount}`,
      "───────────────────────",
      "💰  المبالغ",
      `   الإجمالي:       ${formatCurrency(summary.totalAmount)} ر.س`,
      `   💵 نقداً:       ${formatCurrency(summary.cashAmount)} ر.س`,
      `   💳 بطاقة:      ${formatCurrency(summary.cardAmount)} ر.س`,
      `   🏦 تحويل:      ${formatCurrency(summary.transferAmount)} ر.س`,
      "───────────────────────",
      "📊  تفاصيل إضافية",
      `   تأمينات:       ${formatCurrency(summary.insuranceTotal)} ر.س`,
      `   خصومات:        ${formatCurrency(summary.discountTotal)} ر.س`,
    ];

    if (notes.trim()) {
      lines.push("───────────────────────");
      lines.push("📝  ملاحظات:");
      lines.push(`   ${notes.trim()}`);
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━");
    return lines.join("\n");
  }

  const handleShare = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: buildReportText(),
        title: "تقرير إغلاق اليومية",
      });
    } catch {
      // user cancelled or share failed — ignore
    }
  };

  const handleCloseShift = async () => {
    if (!currentEmployee) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsClosing(true);
    try {
      await closeShift(
        { name: currentEmployee.name, employeeId: currentEmployee.employeeId },
        summary,
        today,
        notes.trim() || undefined
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotes("");
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsClosing(false);
    }
  };

  const bottomInset = Platform.OS === "ios" ? insets.bottom : 16;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dim overlay — tap to dismiss */}
      <Pressable style={styles.overlay} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color={Colors.textLight} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>إغلاق اليومية</Text>
            <Text style={styles.headerDate}>{formatDateAr(new Date().toISOString())}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Feather name="lock" size={14} color={Colors.gold} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cashier row */}
          <View style={styles.cashierRow}>
            <Feather name="user" size={15} color={Colors.gold} />
            <Text style={styles.cashierLabel}>الكاشير: </Text>
            <Text style={styles.cashierName}>
              {currentEmployee?.name ?? "غير محدد"}
            </Text>
          </View>

          {/* Z-Report card */}
          <View style={styles.reportCard}>
            {/* Section: Orders */}
            <View style={styles.sectionHeader}>
              <Feather name="shopping-bag" size={14} color={Colors.gold} />
              <Text style={styles.sectionTitle}>ملخص الطلبات</Text>
            </View>

            <StatRow
              icon="hash"
              label="عدد الطلبات"
              value={`${summary.orderCount} طلب`}
              highlight
            />
            <StatRow
              icon="truck"
              label="توصيل"
              value={`${summary.deliveryCount}`}
            />
            <StatRow
              icon="shopping-bag"
              label="استلام من المحل"
              value={`${summary.pickupCount}`}
            />

            <Divider />

            {/* Section: Revenue */}
            <View style={styles.sectionHeader}>
              <Feather name="dollar-sign" size={14} color={Colors.gold} />
              <Text style={styles.sectionTitle}>المبالغ</Text>
            </View>

            <StatRow
              icon="layers"
              label="الإجمالي"
              value={`${formatCurrency(summary.totalAmount)} ر.س`}
              highlight
              valueColor={Colors.success}
            />
            <StatRow
              icon="dollar-sign"
              label="نقداً"
              value={`${formatCurrency(summary.cashAmount)} ر.س`}
            />
            <StatRow
              icon="credit-card"
              label="بطاقة"
              value={`${formatCurrency(summary.cardAmount)} ر.س`}
            />
            <StatRow
              icon="send"
              label="تحويل"
              value={`${formatCurrency(summary.transferAmount)} ر.س`}
            />

            <Divider />

            {/* Section: Extras */}
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={14} color={Colors.gold} />
              <Text style={styles.sectionTitle}>تفاصيل إضافية</Text>
            </View>

            <StatRow
              icon="shield"
              label="تأمينات"
              value={`${formatCurrency(summary.insuranceTotal)} ر.س`}
            />
            <StatRow
              icon="tag"
              label="خصومات"
              value={`${formatCurrency(summary.discountTotal)} ر.س`}
              valueColor={summary.discountTotal > 0 ? Colors.warning : undefined}
            />
          </View>

          {/* Notes input */}
          <Text style={styles.notesLabel}>
            <Feather name="edit-3" size={13} color={Colors.textSecondary} />
            {"  ملاحظات (اختياري)"}
          </Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="أضف أي ملاحظات على اليومية..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlign="right"
            textAlignVertical="top"
          />

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Feather name="share-2" size={16} color={Colors.primary} />
              <Text style={styles.shareBtnText}>مشاركة التقرير</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeShiftBtn, isClosing && styles.btnDisabled]}
              onPress={handleCloseShift}
              activeOpacity={0.85}
              disabled={isClosing}
            >
              {isClosing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="lock" size={16} color="#fff" />
              )}
              <Text style={styles.closeShiftBtnText}>
                {isClosing ? "جاري الإغلاق..." : "إغلاق اليومية"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

interface StatRowProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}

function StatRow({ icon, label, value, highlight = false, valueColor }: StatRowProps) {
  return (
    <View style={[statStyles.row, highlight && statStyles.rowHighlight]}>
      <Text style={[statStyles.value, valueColor ? { color: valueColor } : highlight && statStyles.valueHighlight]}>
        {value}
      </Text>
      <View style={statStyles.labelGroup}>
        <Text style={[statStyles.label, highlight && statStyles.labelHighlight]}>{label}</Text>
        <Feather name={icon} size={13} color={highlight ? Colors.gold : Colors.textMuted} />
      </View>
    </View>
  );
}

function Divider() {
  return <View style={dividerStyle} />;
}

const dividerStyle: import("react-native").ViewStyle = {
  height: 1,
  backgroundColor: Colors.primaryLight,
  marginVertical: 10,
  marginHorizontal: 4,
};

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textLight,
    letterSpacing: 0.3,
  },
  headerDate: {
    fontSize: 11,
    color: Colors.gold,
    fontWeight: "600",
  },
  headerBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(201,168,76,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  cashierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.2)",
  },
  cashierLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  cashierName: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  reportCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 0.2,
  },
  notesLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textLight,
    minHeight: 80,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
  closeShiftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  closeShiftBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

const statStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  rowHighlight: {
    backgroundColor: "rgba(201,168,76,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  labelHighlight: {
    color: Colors.textLight,
    fontWeight: "700",
  },
  value: {
    fontSize: 14,
    color: Colors.textLight,
    fontWeight: "600",
  },
  valueHighlight: {
    fontSize: 15,
    color: Colors.gold,
    fontWeight: "800",
  },
});
