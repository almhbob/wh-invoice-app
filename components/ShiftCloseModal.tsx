import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useOrders } from "@/context/OrdersContext";
import { useLang } from "@/context/LanguageContext";
import { fmtCurrency } from "@/utils/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(isoDate: string): boolean {
  return isoDate?.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function formatDateAr(): string {
  return new Date().toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimeAr(): string {
  return new Date().toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Payment method config ────────────────────────────────────────────────────

const PAYMENT_CONFIG = {
  cash:     { label: "💵 نقداً",  color: "#16a34a" },
  card:     { label: "💳 بطاقة",  color: "#2563eb" },
  transfer: { label: "📲 تحويل", color: "#d97706" },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function ShiftCloseModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const { lang } = useLang();

  const bottomPad = Platform.OS === "ios" ? insets.bottom + 8 : 24;

  // ── Today's orders (active only) ────────────────────────────────────────────
  const todayOrders = useMemo(
    () => orders.filter((o) => !o.deleted && isToday(o.createdAt)),
    [orders]
  );

  // ── Aggregated summary ──────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalRevenue   = 0;
    let totalDiscounts = 0;
    let cashAmount     = 0;
    let cardAmount     = 0;
    let transferAmount = 0;
    let cashCount      = 0;
    let cardCount      = 0;
    let transferCount  = 0;

    for (const order of todayOrders) {
      const amount = order.totalAmount ?? 0;
      totalRevenue += amount;

      if (order.paymentMethod === "cash") {
        cashAmount += amount;
        cashCount  += 1;
      } else if (order.paymentMethod === "card") {
        cardAmount += amount;
        cardCount  += 1;
      } else if (order.paymentMethod === "transfer") {
        transferAmount += amount;
        transferCount  += 1;
      }

      if (order.discount) {
        const { type, value } = order.discount;
        if (type === "fixed") {
          totalDiscounts += value;
        } else if (type === "percentage" && value > 0 && value < 100) {
          // amount is already post-discount; recover the removed portion
          const beforeDiscount = amount / (1 - value / 100);
          totalDiscounts += beforeDiscount - amount;
        }
      }
    }

    const orderCount    = todayOrders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      orderCount,
      totalRevenue,
      avgOrderValue,
      totalDiscounts,
      cashAmount,
      cardAmount,
      transferAmount,
      cashCount,
      cardCount,
      transferCount,
    };
  }, [todayOrders]);

  // ── Cashier breakdown ────────────────────────────────────────────────────────
  const cashierBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of todayOrders) {
      const emp = order.cashierEmployee;
      if (!emp) continue;
      const existing = map.get(emp.employeeId);
      if (existing) {
        existing.count   += 1;
        existing.revenue += order.totalAmount ?? 0;
      } else {
        map.set(emp.employeeId, {
          name:    emp.name,
          count:   1,
          revenue: order.totalAmount ?? 0,
        });
      }
    }
    return Array.from(map.values());
  }, [todayOrders]);

  // ── Share report ─────────────────────────────────────────────────────────────
  const handleShare = async () => {
    Haptics.selectionAsync();

    const lines: string[] = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━",
      "      تقرير إغلاق الوردية      ",
      "━━━━━━━━━━━━━━━━━━━━━━━━━",
      `📅  التاريخ:        ${formatDateAr()}`,
      `🕐  وقت التقرير:    ${formatTimeAr()}`,
      "─────────────────────────",
      "📦  ملخص الطلبات",
      `   عدد الطلبات:       ${summary.orderCount} طلب`,
      `   متوسط قيمة الطلب:  ${fmtCurrency(summary.avgOrderValue)}`,
      "─────────────────────────",
      "💰  الإيرادات",
      `   الإجمالي:      ${fmtCurrency(summary.totalRevenue)}`,
      `   💵 نقداً (${summary.cashCount}):    ${fmtCurrency(summary.cashAmount)}`,
      `   💳 بطاقة (${summary.cardCount}):   ${fmtCurrency(summary.cardAmount)}`,
      `   📲 تحويل (${summary.transferCount}):   ${fmtCurrency(summary.transferAmount)}`,
      "─────────────────────────",
      `🏦  الصندوق المتوقع:   ${fmtCurrency(summary.cashAmount)}`,
      `🏷️  إجمالي الخصومات:   ${fmtCurrency(summary.totalDiscounts)}`,
    ];

    if (cashierBreakdown.length > 1) {
      lines.push("─────────────────────────");
      lines.push("👥  توزيع الكاشيرين");
      for (const c of cashierBreakdown) {
        lines.push(`   ${c.name}:  ${c.count} طلب — ${fmtCurrency(c.revenue)}`);
      }
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      await Share.share({
        message: lines.join("\n"),
        title:   "تقرير إغلاق الوردية",
      });
    } catch {
      // user cancelled or share unavailable — ignore
    }
  };

  // ── Percentage helper ────────────────────────────────────────────────────────
  function pct(amount: number): number {
    if (summary.totalRevenue === 0) return 0;
    return Math.round((amount / summary.totalRevenue) * 100);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dark overlay — tap to dismiss */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Close button on the leading (right in RTL) side */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={10}
          >
            <Feather name="x" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Feather name="lock" size={16} color={Colors.primary} />
              <Text style={styles.headerTitle}>إغلاق الوردية</Text>
            </View>
            <Text style={styles.headerDate}>{formatDateAr()}</Text>
          </View>

          {/* Spacer to visually balance the X button */}
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Summary Cards (2×2 grid) ── */}
          <View style={styles.cardsGrid}>
            <SummaryCard
              icon="hash"
              label="عدد الطلبات"
              value={`${summary.orderCount}`}
              unit="طلب"
              accent={Colors.primary}
            />
            <SummaryCard
              icon="trending-up"
              label="إجمالي الإيرادات"
              value={fmtCurrency(summary.totalRevenue)}
              accent={Colors.success}
            />
            <SummaryCard
              icon="bar-chart-2"
              label="متوسط الطلب"
              value={fmtCurrency(summary.avgOrderValue)}
              accent={Colors.info}
            />
            <SummaryCard
              icon="tag"
              label="إجمالي الخصومات"
              value={fmtCurrency(summary.totalDiscounts)}
              accent={Colors.gold}
            />
          </View>

          {/* ── Payment Breakdown ── */}
          <SectionCard title="توزيع طرق الدفع" icon="pie-chart">
            {(["cash", "card", "transfer"] as const).map((method) => {
              const cfg    = PAYMENT_CONFIG[method];
              const amount = method === "cash"
                ? summary.cashAmount
                : method === "card"
                ? summary.cardAmount
                : summary.transferAmount;
              const count  = method === "cash"
                ? summary.cashCount
                : method === "card"
                ? summary.cardCount
                : summary.transferCount;
              const p = pct(amount);

              return (
                <View key={method} style={styles.paymentRow}>
                  <View style={styles.paymentRowTop}>
                    {/* Left side (in RTL = visually trailing): percentage + count */}
                    <View style={styles.paymentMeta}>
                      <Text style={[styles.paymentPct, { color: cfg.color }]}>
                        {p}%
                      </Text>
                      <Text style={[styles.paymentCount, { color: cfg.color }]}>
                        {count} طلب
                      </Text>
                    </View>

                    {/* Right side (in RTL = visually leading): label + amount */}
                    <View style={styles.paymentLabelGroup}>
                      <Text style={styles.paymentLabel}>{cfg.label}</Text>
                      <Text style={styles.paymentAmount}>
                        {fmtCurrency(amount)}
                      </Text>
                    </View>
                  </View>

                  {/* Percentage bar */}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width:           `${p}%` as `${number}%`,
                          backgroundColor: cfg.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </SectionCard>

          {/* ── Cash Drawer Box ── */}
          <View style={styles.cashDrawerBox}>
            <View style={styles.cashDrawerLeft}>
              <View style={styles.cashDrawerIconWrap}>
                <Feather name="archive" size={22} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.cashDrawerTitle}>الصندوق المتوقع</Text>
                <Text style={styles.cashDrawerLabel}>المبلغ المتوقع في الصندوق</Text>
              </View>
            </View>
            <Text style={styles.cashDrawerValue}>
              {fmtCurrency(summary.cashAmount)}
            </Text>
          </View>

          {/* ── Cashier Breakdown (only when multiple cashiers worked today) ── */}
          {cashierBreakdown.length > 1 && (
            <SectionCard title="توزيع الكاشيرين" icon="users">
              {cashierBreakdown.map((c, idx) => (
                <View
                  key={c.name + idx}
                  style={[
                    styles.cashierRow,
                    idx < cashierBreakdown.length - 1 && styles.cashierRowBorder,
                  ]}
                >
                  <Text style={styles.cashierRevenue}>
                    {fmtCurrency(c.revenue)}
                  </Text>
                  <View style={styles.cashierInfo}>
                    <View style={styles.cashierNameRow}>
                      <Feather name="user" size={13} color={Colors.primary} />
                      <Text style={styles.cashierName}>{c.name}</Text>
                    </View>
                    <Text style={styles.cashierCount}>{c.count} طلب</Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          )}

          {/* ── Share / Print button ── */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Feather name="share-2" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>مشاركة تقرير الوردية</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon:   React.ComponentProps<typeof Feather>["name"];
  label:  string;
  value:  string;
  unit?:  string;
  accent: string;
}

function SummaryCard({ icon, label, value, unit, accent }: SummaryCardProps) {
  return (
    <View style={cardStyles.card}>
      <View style={[cardStyles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Feather name={icon} size={16} color={accent} />
      </View>
      <Text style={cardStyles.label}>{label}</Text>
      <View style={cardStyles.valueRow}>
        <Text style={[cardStyles.value, { color: accent }]}>{value}</Text>
        {unit ? <Text style={cardStyles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

interface SectionCardProps {
  title:    string;
  icon:     React.ComponentProps<typeof Feather>["name"];
  children: React.ReactNode;
}

function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.sectionHeader}>
        <Text style={sectionStyles.title}>{title}</Text>
        <Feather name={icon} size={15} color={Colors.primary} />
      </View>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Modal backdrop ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  // ── Bottom sheet ──
  sheet: {
    position:           "absolute",
    bottom:             0,
    left:               0,
    right:              0,
    backgroundColor:    Colors.background,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    maxHeight:          "94%",
    shadowColor:        "#000",
    shadowOffset:       { width: 0, height: -6 },
    shadowOpacity:      0.18,
    shadowRadius:       20,
    elevation:          24,
  },

  dragHandle: {
    alignSelf:       "center",
    width:           44,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.border,
    marginTop:       10,
    marginBottom:    4,
  },

  // ── Header ──
  header: {
    flexDirection:         "row",
    alignItems:            "center",
    justifyContent:        "space-between",
    paddingHorizontal:     20,
    paddingVertical:       14,
    borderBottomWidth:     1,
    borderBottomColor:     Colors.borderLight,
    backgroundColor:       Colors.surface,
    borderTopLeftRadius:   28,
    borderTopRightRadius:  28,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerCenter: {
    alignItems: "center",
    gap:        4,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           7,
  },
  headerTitle: {
    fontSize:      17,
    fontWeight:    "800",
    color:         Colors.text,
    letterSpacing: 0.3,
  },
  headerDate: {
    fontSize:   12,
    color:      Colors.textMuted,
    fontWeight: "500",
  },
  headerSpacer: {
    width: 36,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding:    18,
    gap:        16,
    paddingTop: 20,
  },

  // ── Summary cards grid ──
  cardsGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
  },

  // ── Payment rows ──
  paymentRow: {
    gap:               6,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  paymentRowTop: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  paymentLabelGroup: {
    alignItems: "flex-end",
    gap:        3,
  },
  paymentLabel: {
    fontSize:   15,
    fontWeight: "700",
    color:      Colors.text,
    textAlign:  "right",
  },
  paymentAmount: {
    fontSize:   13,
    fontWeight: "600",
    color:      Colors.textSecondary,
    textAlign:  "right",
  },
  paymentMeta: {
    alignItems: "flex-start",
    gap:        2,
  },
  paymentPct: {
    fontSize:   13,
    fontWeight: "700",
  },
  paymentCount: {
    fontSize:   11,
    fontWeight: "600",
  },
  barTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.borderLight,
    overflow:        "hidden",
  },
  barFill: {
    height:       6,
    borderRadius: 3,
    minWidth:     4,
  },

  // ── Cash drawer ──
  cashDrawerBox: {
    backgroundColor:  "#f0fdf4",
    borderRadius:     16,
    borderWidth:      1.5,
    borderColor:      "#86efac",
    paddingHorizontal: 18,
    paddingVertical:  16,
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    shadowColor:      "#16a34a",
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.1,
    shadowRadius:     6,
    elevation:        3,
  },
  cashDrawerLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  cashDrawerIconWrap: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "#dcfce7",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cashDrawerTitle: {
    fontSize:    15,
    fontWeight:  "800",
    color:       "#15803d",
  },
  cashDrawerLabel: {
    fontSize:   11,
    color:      "#4ade80",
    fontWeight: "500",
    marginTop:  2,
  },
  cashDrawerValue: {
    fontSize:      18,
    fontWeight:    "900",
    color:         "#16a34a",
    letterSpacing: 0.5,
  },

  // ── Cashier breakdown ──
  cashierRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  cashierRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cashierInfo: {
    alignItems: "flex-end",
    gap:        3,
  },
  cashierNameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },
  cashierName: {
    fontSize:   14,
    fontWeight: "700",
    color:      Colors.text,
  },
  cashierCount: {
    fontSize:   12,
    color:      Colors.textMuted,
    fontWeight: "500",
  },
  cashierRevenue: {
    fontSize:   15,
    fontWeight: "700",
    color:      Colors.primary,
  },

  // ── Share button ──
  shareBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    backgroundColor: Colors.primary,
    borderRadius:   16,
    paddingVertical: 16,
    marginTop:      4,
    shadowColor:    Colors.primary,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.3,
    shadowRadius:   10,
    elevation:      6,
  },
  shareBtnText: {
    fontSize:      16,
    fontWeight:    "800",
    color:         "#fff",
    letterSpacing: 0.3,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    flex:            1,
    minWidth:        "45%",
    backgroundColor: Colors.surface,
    borderRadius:    14,
    padding:         14,
    alignItems:      "flex-end",
    gap:             6,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   1,
    shadowRadius:    4,
    elevation:       2,
  },
  iconWrap: {
    width:         34,
    height:        34,
    borderRadius:  10,
    alignItems:    "center",
    justifyContent: "center",
  },
  label: {
    fontSize:   11,
    color:      Colors.textMuted,
    fontWeight: "500",
    textAlign:  "right",
  },
  valueRow: {
    flexDirection: "row",
    alignItems:    "baseline",
    gap:           3,
  },
  value: {
    fontSize:   15,
    fontWeight: "800",
    textAlign:  "right",
  },
  unit: {
    fontSize:   11,
    color:      Colors.textMuted,
    fontWeight: "500",
  },
});

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    overflow:        "hidden",
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   1,
    shadowRadius:    4,
    elevation:       2,
  },
  // RTL section header: icon on left visually (flex-end), title right-aligned
  sectionHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor:   Colors.surfaceSecondary,
  },
  title: {
    fontSize:   14,
    fontWeight: "700",
    color:      Colors.text,
    flex:       1,
    textAlign:  "right",
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom:     4,
  },
});
