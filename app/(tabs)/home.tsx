import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { canDo, ROLE_CAN_ACCESS_ADMIN } from "@/constants/rbac";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { Department, Order, useOrders } from "@/context/OrdersContext";
import { usePriceChange } from "@/context/PriceChangeContext";

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEPARTMENTS: Department[] = ["halwa", "mawali", "chocolate", "cake", "packaging"];

function overallStatus(order: Order): "pending" | "in_progress" | "done" | "cancelled" {
  const statuses = DEPARTMENTS.map(d => order.departmentStatuses?.[d]).filter(Boolean);
  if (statuses.length === 0) return "pending";
  if (statuses.every(s => s === "done")) return "done";
  if (statuses.some(s => s === "cancelled")) return "cancelled";
  if (statuses.some(s => s === "in_progress")) return "in_progress";
  return "pending";
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)  return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:     { label: "انتظار",  bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  in_progress: { label: "جاري",   bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  done:        { label: "مكتمل",  bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  cancelled:   { label: "ملغي",   bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

// ── Action definitions ─────────────────────────────────────────────────────────

const ACTIONS_BASE = [
  { label: "كاشير",    icon: "file-text",   route: "cashier",   grad: ["#C9A84C", "#8B6508"] as [string, string] },
  { label: "الأرشيف",  icon: "archive",     route: "archive",   grad: ["#2563EB", "#1D4ED8"] as [string, string] },
  { label: "التقارير", icon: "bar-chart-2", route: "reports",   grad: ["#7C3AED", "#6D28D9"] as [string, string] },
  { label: "توصيل",    icon: "truck",       route: "delivery",  grad: ["#0D9488", "#0F766E"] as [string, string] },
  { label: "العملاء",  icon: "users",       route: "customers", grad: ["#0369A1", "#075985"] as [string, string] },
  { label: "حلا",      icon: "coffee",      route: "halwa",     grad: ["#B45309", "#92400E"] as [string, string] },
  { label: "مولي",     icon: "package",     route: "mawali",    grad: ["#0E7490", "#155E75"] as [string, string] },
  { label: "شوكولاتة", icon: "gift",        route: "chocolate", grad: ["#78350F", "#451A03"] as [string, string] },
  { label: "كيك",      icon: "layers",      route: "cake",      grad: ["#9D174D", "#831843"] as [string, string] },
  { label: "تغليف",    icon: "box",         route: "packaging", grad: ["#166534", "#14532D"] as [string, string] },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionTile({
  label, icon, grad, badge, size, onPress,
}: {
  label: string; icon: string; grad: [string, string];
  badge?: number; size: number; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 60 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 60 }),
    ]).start();
    onPress();
  };
  const isWide = size >= 120;
  return (
    <Animated.View style={{ width: size, transform: [{ scale }] }}>
      <TouchableOpacity onPress={press} activeOpacity={0.85} style={{ borderRadius: 16, overflow: "hidden" }}>
        <LinearGradient colors={grad} style={{ height: isWide ? 108 : 88, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={{ width: isWide ? 50 : 42, height: isWide ? 50 : 42, borderRadius: isWide ? 25 : 21, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
            <Feather name={icon as any} size={isWide ? 24 : 20} color="rgba(255,255,255,0.95)" />
          </View>
          <Text style={{ color: "#fff", fontSize: isWide ? 12 : 11, fontWeight: "800", textAlign: "center" }} numberOfLines={1}>{label}</Text>
        </LinearGradient>
        {!!badge && (
          <View style={{ position: "absolute", top: 7, right: 7, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function KpiCard({
  icon, label, value, sub, grad, cardWidth, grow,
}: {
  icon: string; label: string; value: string | number;
  sub?: string; grad: [string, string]; cardWidth?: number; grow?: boolean;
}) {
  return (
    <View style={[kpi.card, grow ? { flex: 1 } : { width: cardWidth }]}>
      <LinearGradient colors={grad} style={kpi.icon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Feather name={icon as any} size={20} color="#fff" />
      </LinearGradient>
      <View style={kpi.body}>
        <Text style={kpi.value} numberOfLines={1}>{value}</Text>
        <Text style={kpi.label} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={kpi.sub} numberOfLines={1}>{sub}</Text>}
      </View>
    </View>
  );
}

function AlertRow({ text, color, icon, onPress }: { text: string; color: string; icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[al.wrap, { borderColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[al.dot, { backgroundColor: color }]} />
      <Feather name={icon as any} size={13} color={color} />
      <Text style={[al.txt, { color }]} numberOfLines={1}>{text}</Text>
      {onPress && <Feather name="chevron-left" size={12} color={color} />}
    </TouchableOpacity>
  );
}

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const cfg = STATUS_CFG[overallStatus(order)];
  return (
    <TouchableOpacity style={or.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={or.num}>#{order.orderNumber}</Text>
      <View style={or.mid}>
        <Text style={or.name} numberOfLines={1}>{order.customerName || "—"}</Text>
        <Text style={or.ago}>{fmtAgo(order.createdAt)}</Text>
      </View>
      <View style={[or.pill, { backgroundColor: cfg.bg }]}>
        <View style={[or.dot, { backgroundColor: cfg.dot }]} />
        <Text style={[or.pillTxt, { color: cfg.text }]}>{cfg.label}</Text>
      </View>
      <Text style={or.amount}>{(order.totalAmount ?? 0).toFixed(0)} ﷼</Text>
    </TouchableOpacity>
  );
}

function SectionHead({ icon, title, cta, onCta }: { icon: string; title: string; cta?: string; onCta?: () => void }) {
  return (
    <View style={sec.row}>
      <View style={sec.left}>
        <View style={sec.iconBox}>
          <Feather name={icon as any} size={13} color={Colors.gold} />
        </View>
        <Text style={sec.title}>{title}</Text>
      </View>
      {!!cta && (
        <TouchableOpacity onPress={onCta} style={sec.cta}>
          <Text style={sec.ctaTxt}>{cta}</Text>
          <Feather name="chevron-left" size={11} color={Colors.gold} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  // Responsive breakpoint — wide enough to show sidebar + side-by-side layout
  const isWide = winW >= 700;
  const PADDING = isWide ? 24 : 16;
  const TILE_GAP = isWide ? 12 : 10;
  const TILE_COLS = isWide ? 4 : 2;
  const TILE_W = isWide
    ? 120
    : Math.floor((winW - PADDING * 2 - TILE_GAP) / 2);
  const KPI_W = isWide
    ? undefined            // flex:1 handled below
    : Math.floor((winW - PADDING * 2 - 10) / 2);

  const { company }         = useCompany();
  const { currentEmployee } = useEmployee();
  const { orders }          = useOrders();
  const { pendingCount }    = usePriceChange();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isAdmin  = canDo(currentEmployee?.role, ROLE_CAN_ACCESS_ADMIN);
  const todayStr = new Date().toDateString();

  const todayOrders = useMemo(
    () => orders.filter(o => new Date(o.createdAt).toDateString() === todayStr),
    [orders, todayStr],
  );
  const todayRevenue = useMemo(
    () => todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    [todayOrders],
  );
  const avgTicket  = todayOrders.length ? todayRevenue / todayOrders.length : 0;
  const pendingCnt = useMemo(() => orders.filter(o => overallStatus(o) === "pending").length,     [orders]);
  const inProgCnt  = useMemo(() => orders.filter(o => overallStatus(o) === "in_progress").length, [orders]);
  const recentOrders = useMemo(
    () => [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12),
    [orders],
  );
  const uniqueCustomers = useMemo(
    () => new Set(todayOrders.map(o => o.customerName).filter(Boolean)).size || todayOrders.length,
    [todayOrders],
  );

  const go = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  const actions = [
    ...ACTIONS_BASE,
    ...(isAdmin
      ? [{ label: "الإدارة", icon: "settings", route: "admin", grad: ["#374151", "#1F2937"] as [string, string], badge: pendingCount || undefined }]
      : []),
  ];

  return (
    <View style={s.screen}>

      {/* ── Wide header (desktop / tablet) ──────────────────────────────────── */}
      {isWide && (
        <LinearGradient
          colors={["#0A1628", "#122044"]}
          style={[s.wideHeader, { paddingTop: insets.top + 14 }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <View style={s.hBrand}>
            <LinearGradient colors={[Colors.gold, "#8B6508"]} style={s.hLogo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Feather name="shopping-bag" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={s.hCompany} numberOfLines={1}>{company?.name || "فاتورة"}</Text>
              {currentEmployee && <Text style={s.hEmp} numberOfLines={1}>{currentEmployee.name}</Text>}
            </View>
          </View>
          <View style={s.hClock}>
            <Text style={s.hTime}>{formatTime(now)}</Text>
            <Text style={s.hDate}>{formatDate(now)}</Text>
          </View>
          <View style={s.hRight}>
            <View style={s.liveChip}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>مباشر</Text>
            </View>
            <TouchableOpacity style={s.newBtn} onPress={() => go("cashier")}>
              <Feather name="plus" size={14} color="#0A1628" />
              <Text style={s.newBtnTxt}>فاتورة جديدة</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}

      {/* ── Narrow top bar (mobile — below _layout header) ────────────────── */}
      {!isWide && (
        <View style={s.narrowBar}>
          <View style={s.nClockRow}>
            <Feather name="clock" size={12} color={Colors.gold} />
            <Text style={s.nTime}>{formatTime(now)}</Text>
          </View>
          <TouchableOpacity style={s.nNewBtn} onPress={() => go("cashier")}>
            <Feather name="plus" size={13} color="#fff" />
            <Text style={s.nNewTxt}>فاتورة جديدة</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView
        style={s.body}
        contentContainerStyle={[s.content, {
          paddingHorizontal: PADDING,
          paddingBottom: insets.bottom + 90,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts */}
        {(pendingCount > 0 || pendingCnt > 0) && (
          <View style={s.alerts}>
            {pendingCount > 0 && (
              <AlertRow text={`${pendingCount} طلب تغيير سعر ينتظر الموافقة`} color="#F59E0B" icon="alert-triangle" onPress={() => go("admin")} />
            )}
            {pendingCnt > 0 && (
              <AlertRow text={`${pendingCnt} فاتورة لم تبدأ بعد`} color="#3B82F6" icon="clock" onPress={() => go("archive")} />
            )}
          </View>
        )}

        {/* KPI cards — 2×2 on narrow, 4-in-row on wide */}
        <View style={[s.kpiRow, { gap: isWide ? 16 : 10 }]}>
          {[
            { icon: "trending-up", label: "إيرادات اليوم",   value: `${todayRevenue.toLocaleString("ar-SA")} ﷼`, sub: `${todayOrders.length} فاتورة`, grad: ["#059669", "#064E3B"] as [string,string] },
            { icon: "clock",       label: "انتظار / تنفيذ",  value: `${pendingCnt} / ${inProgCnt}`,               sub: `${orders.length} إجمالي`,       grad: ["#D97706", "#78350F"] as [string,string] },
            { icon: "award",       label: "متوسط الفاتورة",  value: `${avgTicket.toFixed(0)} ﷼`,                  sub: "اليوم",                          grad: ["#7C3AED", "#4C1D95"] as [string,string] },
            { icon: "users",       label: "عملاء اليوم",     value: uniqueCustomers,                               sub: "زبون",                           grad: ["#0369A1", "#0C4A6E"] as [string,string] },
          ].map(k => (
            <KpiCard key={k.label} {...k} cardWidth={KPI_W ?? undefined} grow={isWide} />
          ))}
        </View>

        {/* Main content — side by side on wide, stacked on narrow */}
        <View style={isWide ? s.mainWide : s.mainNarrow}>

          {/* Quick actions */}
          <View style={isWide ? s.actWide : {}}>
            <SectionHead icon="grid" title="الوصول السريع" />
            <View style={[s.tileGrid, { gap: TILE_GAP }]}>
              {actions.map(a => (
                <ActionTile
                  key={a.route}
                  label={a.label} icon={a.icon} grad={a.grad}
                  badge={(a as any).badge}
                  size={TILE_W}
                  onPress={() => go(a.route)}
                />
              ))}
            </View>
          </View>

          {/* Recent orders */}
          <View style={isWide ? s.ordWide : {}}>
            <SectionHead icon="list" title="آخر الفواتير" cta="عرض الكل" onCta={() => go("archive")} />
            <View style={s.ordCard}>
              <View style={or.header}>
                <Text style={[or.hCell, { width: 54 }]}>رقم</Text>
                <Text style={[or.hCell, { flex: 1 }]}>العميل</Text>
                <Text style={[or.hCell, { width: 76 }]}>الحالة</Text>
                <Text style={[or.hCell, { width: 64, textAlign: "left" }]}>المبلغ</Text>
              </View>
              {recentOrders.length === 0 ? (
                <View style={s.empty}>
                  <Feather name="inbox" size={38} color={Colors.textMuted} />
                  <Text style={s.emptyTxt}>لا توجد فواتير بعد</Text>
                </View>
              ) : (
                recentOrders.map(o => (
                  <OrderRow key={o.id} order={o} onPress={() => go("archive")} />
                ))
              )}
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ── Static styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#EFF3FA" },

  // Wide header
  wideHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 28, paddingBottom: 18, gap: 16 },
  hBrand:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  hLogo:      { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hCompany:   { color: "#fff", fontSize: 15, fontWeight: "800" },
  hEmp:       { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  hClock:     { alignItems: "center", flex: 2 },
  hTime:      { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 1.5, fontVariant: ["tabular-nums" as any] },
  hDate:      { color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 3 },
  hRight:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, justifyContent: "flex-end" },
  liveChip:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.4)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  liveTxt:    { color: "#10B981", fontSize: 11, fontWeight: "700" },
  newBtn:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.gold, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10 },
  newBtnTxt:  { color: "#0A1628", fontSize: 13, fontWeight: "900" },

  // Narrow bar
  narrowBar:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border },
  nClockRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  nTime:      { color: Colors.text, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums" as any] },
  nNewBtn:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.gold, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  nNewTxt:    { color: "#fff", fontSize: 12, fontWeight: "900" },

  // Body
  body:       { flex: 1 },
  content:    { paddingTop: 16, gap: 16 },

  // Alerts
  alerts:     { gap: 8 },

  // KPI row
  kpiRow:     { flexDirection: "row", flexWrap: "wrap" },

  // Main layout
  mainWide:   { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  mainNarrow: { gap: 20 },
  actWide:    { flex: 1 },
  ordWide:    { width: 420 },

  // Tile grid
  tileGrid:   { flexDirection: "row", flexWrap: "wrap" },

  // Orders card
  ordCard:    { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#0A1628", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },

  // Empty state
  empty:      { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTxt:   { color: Colors.textMuted, fontSize: 14 },
});

const kpi = StyleSheet.create({
  card:  {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0A1628",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  icon:  { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  body:  { flex: 1 },
  value: { fontSize: 18, fontWeight: "900", color: Colors.text },
  label: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  sub:   { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
});

const or = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F1F5F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  hCell:  { fontSize: 10, fontWeight: "700", color: Colors.textMuted },
  num:    { width: 54, fontSize: 13, fontWeight: "800", color: Colors.primary },
  mid:    { flex: 1, paddingHorizontal: 4 },
  name:   { fontSize: 12, fontWeight: "700", color: Colors.text },
  ago:    { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  pill:   { width: 76, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  dot:    { width: 5, height: 5, borderRadius: 3 },
  pillTxt:{ fontSize: 10, fontWeight: "700" },
  amount: { width: 64, fontSize: 12, fontWeight: "800", color: Colors.text, textAlign: "left" },
});

const al = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff" },
  dot:  { width: 7, height: 7, borderRadius: 4 },
  txt:  { flex: 1, fontSize: 12, fontWeight: "700" },
});

const sec = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  left:   { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox:{ width: 26, height: 26, borderRadius: 7, backgroundColor: "rgba(201,168,76,0.12)", alignItems: "center", justifyContent: "center" },
  title:  { fontSize: 14, fontWeight: "800", color: Colors.text },
  cta:    { flexDirection: "row", alignItems: "center", gap: 3 },
  ctaTxt: { fontSize: 12, color: Colors.gold, fontWeight: "700" },
});
