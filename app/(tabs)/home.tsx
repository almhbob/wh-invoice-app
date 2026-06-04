import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { Department, Order, useOrders } from "@/context/OrdersContext";

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEPARTMENTS: Department[] = ["halwa", "mawali", "chocolate", "cake", "packaging"];

const DEPT_LABELS: Record<Department, string> = {
  halwa: "حلا", mawali: "مولي", chocolate: "شوكو", cake: "كيك", packaging: "تغليف",
};

function overallStatus(order: Order): "pending" | "in_progress" | "done" | "cancelled" {
  const statuses = DEPARTMENTS.map(d => order.departmentStatuses?.[d]).filter(Boolean);
  if (statuses.length === 0) return "pending";
  if (statuses.every(s => s === "done")) return "done";
  if (statuses.some(s => s === "cancelled")) return "cancelled";
  if (statuses.some(s => s === "in_progress")) return "in_progress";
  return "pending";
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  return `${Math.floor(h / 24)}ي`;
}

function formatClock(d: Date) {
  return d.toLocaleTimeString("ar-SA", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

// ── Column configs ─────────────────────────────────────────────────────────────

const COLS = [
  {
    key:       "pending" as const,
    label:     "انتظار",
    icon:      "clock" as const,
    color:     "#F59E0B",
    textColor: "#92400E",
    headerBg:  "#FEF3C7",
    cardBorder:"#FCD34D",
    cardBg:    "#FFFBEB",
  },
  {
    key:       "in_progress" as const,
    label:     "قيد التنفيذ",
    icon:      "zap" as const,
    color:     "#3B82F6",
    textColor: "#1E40AF",
    headerBg:  "#DBEAFE",
    cardBorder:"#93C5FD",
    cardBg:    "#EFF6FF",
  },
  {
    key:       "done" as const,
    label:     "جاهز للاستلام",
    icon:      "check-circle" as const,
    color:     "#10B981",
    textColor: "#065F46",
    headerBg:  "#D1FAE5",
    cardBorder:"#6EE7B7",
    cardBg:    "#F0FDF4",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function DeptDots({ order }: { order: Order }) {
  const depts = DEPARTMENTS.filter(d => order.departmentStatuses?.[d]);
  if (depts.length === 0) return null;
  return (
    <View style={dd.row}>
      {depts.map(d => {
        const st = order.departmentStatuses[d];
        const c = st === "done" ? "#10B981" : st === "in_progress" ? "#F59E0B" : st === "cancelled" ? "#EF4444" : "#CBD5E1";
        return (
          <View key={d} style={dd.item}>
            <View style={[dd.dot, { backgroundColor: c }]} />
            <Text style={[dd.lbl, { color: c }]}>{DEPT_LABELS[d]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderCard({ order, col, onPress }: {
  order: Order; col: typeof COLS[0]; onPress: () => void;
}) {
  const isDone = col.key === "done";
  const itemsText = order.items
    .filter(i => i.name.trim())
    .slice(0, 3)
    .map(i => `${i.name} ×${i.quantity}`)
    .join(" · ");

  return (
    <TouchableOpacity
      style={[oc.wrap, { backgroundColor: col.cardBg, borderColor: col.cardBorder }, isDone && oc.doneGlow]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {/* Row 1: order number + time */}
      <View style={oc.topRow}>
        <View style={[oc.numBadge, { backgroundColor: col.color + "25" }]}>
          <Text style={[oc.numText, { color: col.textColor }]}>#{order.orderNumber}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={oc.ago}>{fmtAgo(order.createdAt)}</Text>
        {isDone && (
          <View style={oc.readyPill}>
            <Feather name="check" size={9} color="#065F46" />
            <Text style={oc.readyText}>جاهز</Text>
          </View>
        )}
      </View>

      {/* Row 2: customer */}
      <Text style={oc.customer} numberOfLines={1}>
        {order.customerName || "— بدون اسم"}
      </Text>
      {!!order.customerPhone && (
        <Text style={oc.phone} numberOfLines={1}>{order.customerPhone}</Text>
      )}

      {/* Row 3: items summary */}
      {!!itemsText && (
        <Text style={oc.items} numberOfLines={2}>{itemsText}</Text>
      )}

      {/* Row 4: dept dots + amount */}
      <View style={oc.bottomRow}>
        <DeptDots order={order} />
        <Text style={[oc.amount, { color: col.textColor }]}>
          {(order.totalAmount ?? 0).toFixed(0)} ﷼
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ColumnHeader({ col, count, totalAmount }: {
  col: typeof COLS[0]; count: number; totalAmount: number;
}) {
  return (
    <View style={[ch.wrap, { backgroundColor: col.headerBg }]}>
      <View style={[ch.bar, { backgroundColor: col.color }]} />
      <Feather name={col.icon} size={13} color={col.color} />
      <Text style={[ch.label, { color: col.textColor }]}>{col.label}</Text>
      <View style={{ flex: 1 }} />
      {count > 0 && (
        <Text style={[ch.amt, { color: col.textColor }]}>
          {totalAmount.toFixed(0)} ﷼
        </Text>
      )}
      <View style={[ch.badge, { backgroundColor: col.color }]}>
        <Text style={ch.badgeNum}>{count}</Text>
      </View>
    </View>
  );
}

function EmptyCol({ col }: { col: typeof COLS[0] }) {
  const msgs = {
    pending:     "لا توجد طلبات جديدة",
    in_progress: "لا توجد طلبات جارية",
    done:        "لا توجد طلبات جاهزة",
  } as const;
  return (
    <View style={ec.wrap}>
      <View style={[ec.circle, { backgroundColor: col.color + "18" }]}>
        <Feather name={col.icon} size={26} color={col.color + "90"} />
      </View>
      <Text style={[ec.txt, { color: col.color + "AA" }]}>{msgs[col.key]}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function LiveOrdersBoard() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const isWide  = winW >= 700;
  const { orders } = useOrders();

  const [now, setNow]           = useState(new Date());
  const [activeTab, setActiveTab] = useState<"pending" | "in_progress" | "done">("in_progress");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayStr = new Date().toDateString();

  const activeOrders = useMemo(
    () => orders.filter(o => {
      if (overallStatus(o) === "cancelled") return false;
      return new Date(o.createdAt).toDateString() === todayStr;
    }),
    [orders, todayStr],
  );

  const buckets = useMemo(() => ({
    pending:     activeOrders.filter(o => overallStatus(o) === "pending")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    in_progress: activeOrders.filter(o => overallStatus(o) === "in_progress")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    done:        activeOrders.filter(o => overallStatus(o) === "done")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  }), [activeOrders]);

  const colTotals = useMemo(() => ({
    pending:     buckets.pending.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    in_progress: buckets.in_progress.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    done:        buckets.done.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
  }), [buckets]);

  const go = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  return (
    <View style={s.screen}>

      {/* ── Board header ─────────────────────────────────────────────────────── */}
      {isWide ? (
        <LinearGradient
          colors={["#0A1628", "#122044"]}
          style={s.wideHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={s.hLeft}>
            <View style={s.liveChip}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>مباشر</Text>
            </View>
            <Text style={s.clock}>{formatClock(now)}</Text>
          </View>

          <View style={s.hCenter}>
            <Text style={s.hTitle}>لوحة الطلبات الحية</Text>
            <Text style={s.hSub}>
              {activeOrders.length} طلب اليوم
              {buckets.done.length > 0 ? ` · ${buckets.done.length} جاهز للاستلام` : ""}
            </Text>
          </View>

          <TouchableOpacity style={s.newBtn} onPress={() => go("cashier")}>
            <Feather name="plus" size={14} color="#0A1628" />
            <Text style={s.newBtnTxt}>فاتورة جديدة</Text>
          </TouchableOpacity>
        </LinearGradient>
      ) : (
        <View style={s.narrowBar}>
          <View style={s.nLeft}>
            <View style={s.liveChipSm}>
              <View style={s.liveDotSm} />
              <Text style={s.liveTxtSm}>مباشر</Text>
            </View>
            <Text style={s.clockSm}>{formatClock(now)}</Text>
          </View>
          <Text style={s.narrowStats}>
            {activeOrders.length} طلب{buckets.done.length > 0 ? ` · ${buckets.done.length} جاهز` : ""}
          </Text>
        </View>
      )}

      {/* ── Wide: 3-column kanban ─────────────────────────────────────────────── */}
      {isWide ? (
        <View style={s.boardWide}>
          {COLS.map((col, ci) => (
            <View
              key={col.key}
              style={[s.colWide, ci < COLS.length - 1 && s.colDivider]}
            >
              <ColumnHeader
                col={col}
                count={buckets[col.key].length}
                totalAmount={colTotals[col.key]}
              />
              <ScrollView
                style={s.colScroll}
                contentContainerStyle={s.colContent}
                showsVerticalScrollIndicator={false}
              >
                {buckets[col.key].length === 0 ? (
                  <EmptyCol col={col} />
                ) : (
                  buckets[col.key].map(o => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      col={col}
                      onPress={() => go("archive")}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          ))}
        </View>
      ) : (
        /* ── Narrow: tab switcher + single column ────────────────────────────── */
        <View style={s.boardNarrow}>
          {/* Tab switcher */}
          <View style={s.tabRow}>
            {COLS.map(col => {
              const isActive = activeTab === col.key;
              const cnt = buckets[col.key].length;
              return (
                <TouchableOpacity
                  key={col.key}
                  style={[s.tab, isActive && { borderBottomColor: col.color, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(col.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabLabel, isActive && { color: col.color, fontWeight: "800" }]}>
                    {col.label}
                  </Text>
                  {cnt > 0 && (
                    <View style={[s.tabBadge, { backgroundColor: col.color }]}>
                      <Text style={s.tabBadgeNum}>{cnt}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Active column content */}
          {COLS.filter(c => c.key === activeTab).map(col => (
            <ScrollView
              key={col.key}
              style={s.colScroll}
              contentContainerStyle={[s.colContent, { paddingBottom: insets.bottom + 90 }]}
              showsVerticalScrollIndicator={false}
            >
              {buckets[col.key].length === 0 ? (
                <EmptyCol col={col} />
              ) : (
                buckets[col.key].map(o => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    col={col}
                    onPress={() => go("archive")}
                  />
                ))
              )}
            </ScrollView>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Static styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F1F5F9" },

  // Wide header
  wideHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
  hLeft:      { flexDirection: "row", alignItems: "center", gap: 10 },
  liveChip:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.35)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  liveTxt:    { color: "#10B981", fontSize: 11, fontWeight: "700" },
  clock:      { color: "#fff", fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  hCenter:    { flex: 1, alignItems: "center" },
  hTitle:     { color: "#fff", fontSize: 15, fontWeight: "900" },
  hSub:       { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  newBtn:     { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: Colors.gold, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10 },
  newBtnTxt:  { color: "#0A1628", fontSize: 13, fontWeight: "900" },

  // Narrow bar
  narrowBar:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  nLeft:       { flexDirection: "row", alignItems: "center", gap: 8 },
  liveChipSm:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3 },
  liveDotSm:   { width: 5, height: 5, borderRadius: 3, backgroundColor: "#10B981" },
  liveTxtSm:   { color: "#10B981", fontSize: 9, fontWeight: "700" },
  clockSm:     { color: Colors.text, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums" as any] },
  narrowStats: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },

  // Wide board
  boardWide:  { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  colWide:    { flex: 1, overflow: "hidden" as any },
  colDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#CBD5E1" },

  // Narrow board
  boardNarrow: { flex: 1 },
  tabRow:      { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tab:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel:    { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
  tabBadge:    { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeNum: { color: "#fff", fontSize: 10, fontWeight: "900" },

  // Shared column
  colScroll:  { flex: 1 },
  colContent: { padding: 10, gap: 8 },
});

const oc = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  doneGlow: {
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 5,
  },
  topRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  numBadge:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  numText:   { fontSize: 13, fontWeight: "900" },
  ago:       { fontSize: 10, color: Colors.textMuted, fontVariant: ["tabular-nums" as any] },
  readyPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#D1FAE5", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  readyText: { fontSize: 9, fontWeight: "800", color: "#065F46" },
  customer:  { fontSize: 13, fontWeight: "800", color: "#1E293B" },
  phone:     { fontSize: 10, color: Colors.textMuted },
  items:     { fontSize: 11, color: "#64748B", lineHeight: 16 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  amount:    { fontSize: 13, fontWeight: "900" },
});

const ch = StyleSheet.create({
  wrap:     { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  bar:      { width: 3, height: 18, borderRadius: 2 },
  label:    { fontSize: 13, fontWeight: "800" },
  badge:    { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeNum: { color: "#fff", fontSize: 11, fontWeight: "900" },
  amt:      { fontSize: 11, fontWeight: "700", opacity: 0.7 },
});

const ec = StyleSheet.create({
  wrap:   { alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 12 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  txt:    { fontSize: 12, fontWeight: "600", textAlign: "center" },
});

const dd = StyleSheet.create({
  row:  { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  item: { flexDirection: "row", alignItems: "center", gap: 2 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  lbl:  { fontSize: 9, fontWeight: "700" },
});
