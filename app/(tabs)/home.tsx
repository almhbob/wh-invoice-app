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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { canDo, ROLE_CAN_ACCESS_ADMIN } from "@/constants/rbac";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
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

function formatDateFull(d: Date) {
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
  pending:     { label: "انتظار",   bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  in_progress: { label: "جاري",    bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  done:        { label: "مكتمل",   bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  cancelled:   { label: "ملغي",    bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, accent, gradient,
}: {
  icon: string; label: string; value: string | number; sub?: string;
  accent: string; gradient: [string, string];
}) {
  return (
    <View style={[kpi.card, { borderTopColor: accent }]}>
      <LinearGradient colors={gradient} style={kpi.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Feather name={icon as any} size={20} color="#fff" />
      </LinearGradient>
      <View style={kpi.body}>
        <Text style={kpi.value} numberOfLines={1}>{value}</Text>
        <Text style={kpi.label}>{label}</Text>
        {!!sub && <Text style={kpi.sub}>{sub}</Text>}
      </View>
    </View>
  );
}

function ActionTile({
  label, icon, accent, gradStart, gradEnd, badge, onPress,
}: {
  label: string; icon: string; accent: string;
  gradStart: string; gradEnd: string;
  badge?: number; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press  = () => { Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start(() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()); onPress(); };
  return (
    <Animated.View style={[at.wrap, { transform: [{ scale }] }]}>
      <TouchableOpacity style={at.touch} onPress={press} activeOpacity={0.85}>
        <LinearGradient colors={[gradStart, gradEnd]} style={at.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={at.iconCircle}>
            <Feather name={icon as any} size={26} color={accent} />
          </View>
          <Text style={[at.label, { color: "#fff" }]} numberOfLines={2}>{label}</Text>
          {!!badge && (
            <View style={at.badgeBox}>
              <Text style={at.badgeText}>{badge > 99 ? "99+" : badge}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const status = overallStatus(order);
  const cfg    = STATUS_CFG[status];
  return (
    <TouchableOpacity style={or.row} onPress={onPress} activeOpacity={0.7}>
      <View style={or.numCol}>
        <Text style={or.num}>#{order.orderNumber}</Text>
      </View>
      <View style={or.nameCol}>
        <Text style={or.name} numberOfLines={1}>{order.customerName || "—"}</Text>
        <Text style={or.ago}>{fmtAgo(order.createdAt)}</Text>
      </View>
      <View style={or.statusCol}>
        <View style={[or.pill, { backgroundColor: cfg.bg }]}>
          <View style={[or.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[or.pillText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={or.amount}>{(order.totalAmount ?? 0).toFixed(0)} ﷼</Text>
    </TouchableOpacity>
  );
}

function AlertBanner({ text, color, icon, onPress }: { text: string; color: string; icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[ab.wrap, { borderColor: color, backgroundColor: color + "12" }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[ab.iconBox, { backgroundColor: color + "25" }]}>
        <Feather name={icon as any} size={15} color={color} />
      </View>
      <Text style={[ab.text, { color }]}>{text}</Text>
      {onPress && <Feather name="chevron-left" size={14} color={color} />}
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

const IS_WEB = Platform.OS === "web";

export default function HomeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useLang();
  const { company }         = useCompany();
  const { currentEmployee } = useEmployee();
  const { orders }          = useOrders();
  const { pendingCount }    = usePriceChange();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isAdmin = canDo(currentEmployee?.role, ROLE_CAN_ACCESS_ADMIN);
  const todayStr = new Date().toDateString();

  const todayOrders = useMemo(
    () => orders.filter(o => new Date(o.createdAt).toDateString() === todayStr),
    [orders, todayStr]
  );
  const todayRevenue = useMemo(
    () => todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    [todayOrders]
  );
  const avgTicket = todayOrders.length ? todayRevenue / todayOrders.length : 0;
  const pendingCnt = useMemo(
    () => orders.filter(o => overallStatus(o) === "pending").length,
    [orders]
  );
  const inProgressCnt = useMemo(
    () => orders.filter(o => overallStatus(o) === "in_progress").length,
    [orders]
  );
  const recentOrders = useMemo(
    () => [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
    [orders]
  );

  const navigate = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  const actions = [
    { label: "كاشير",     icon: "file-text", route: "cashier",   gradStart: "#B8860B", gradEnd: "#8B6914", accent: "#FBBF24" },
    { label: "الأرشيف",   icon: "archive",   route: "archive",   gradStart: "#1E3A5F", gradEnd: "#0F2340", accent: "#93C5FD" },
    { label: "التقارير",  icon: "bar-chart-2", route: "reports", gradStart: "#5B21B6", gradEnd: "#3B0764", accent: "#C4B5FD" },
    { label: "توصيل",     icon: "truck",     route: "delivery",  gradStart: "#0F766E", gradEnd: "#134E4A", accent: "#6EE7B7" },
    { label: "العملاء",   icon: "users",     route: "customers", gradStart: "#0369A1", gradEnd: "#0C4A6E", accent: "#7DD3FC" },
    { label: "حلا",       icon: "coffee",    route: "halwa",     gradStart: "#7C2D12", gradEnd: "#431407", accent: "#FCA5A5" },
    { label: "مولي",      icon: "package",   route: "mawali",    gradStart: "#164E63", gradEnd: "#0C4A6E", accent: "#A5F3FC" },
    { label: "شوكولاتة",  icon: "gift",      route: "chocolate", gradStart: "#3B1A0A", gradEnd: "#1C0A00", accent: "#D4956A" },
    { label: "كيك",       icon: "layers",    route: "cake",      gradStart: "#831843", gradEnd: "#4C0519", accent: "#F9A8D4" },
    { label: "التغليف",   icon: "box",       route: "packaging", gradStart: "#14532D", gradEnd: "#052E16", accent: "#86EFAC" },
    ...(isAdmin ? [{ label: "الإدارة", icon: "settings", route: "admin", gradStart: "#1E3A5F", gradEnd: "#0A1628", accent: "#93C5FD", badge: pendingCount || undefined }] : []),
  ] as { label: string; icon: string; route: string; gradStart: string; gradEnd: string; accent: string; badge?: number }[];

  return (
    <View style={styles.screen}>
      {/* ── POS Header ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#0F1C35", "#1A2E50"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        {/* Left: company */}
        <View style={styles.headerLeft}>
          <View style={styles.logoPlaceholder}>
            <Feather name="shopping-bag" size={18} color={Colors.gold} />
          </View>
          <View>
            <Text style={styles.companyName} numberOfLines={1}>{company.name || "فاتورة"}</Text>
            <Text style={styles.empName} numberOfLines={1}>
              {currentEmployee ? `${currentEmployee.name} · ${currentEmployee.role}` : ""}
            </Text>
          </View>
        </View>

        {/* Center: clock */}
        <View style={styles.clockBox}>
          <Text style={styles.clockTime}>{formatTime(now)}</Text>
          <Text style={styles.clockDate}>{formatDateFull(now)}</Text>
        </View>

        {/* Right: live indicator */}
        <View style={styles.headerRight}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>مباشر</Text>
          <TouchableOpacity style={styles.newOrderBtn} onPress={() => navigate("cashier")}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.newOrderText}>فاتورة جديدة</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts */}
        {(pendingCount > 0 || pendingCnt > 0) && (
          <View style={styles.alertsRow}>
            {pendingCount > 0 && (
              <AlertBanner
                text={`${pendingCount} طلب تغيير سعر يحتاج موافقة`}
                color="#F59E0B" icon="alert-triangle"
                onPress={() => navigate("admin")}
              />
            )}
            {pendingCnt > 0 && (
              <AlertBanner
                text={`${pendingCnt} فاتورة لم تبدأ في التنفيذ بعد`}
                color="#3B82F6" icon="clock"
                onPress={() => navigate("archive")}
              />
            )}
          </View>
        )}

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <KpiCard
            icon="trending-up" label="إيرادات اليوم"
            value={`${todayRevenue.toLocaleString("ar-SA", { minimumFractionDigits: 0 })} ﷼`}
            sub={`متوسط الفاتورة: ${avgTicket.toFixed(0)} ﷼`}
            accent="#10B981" gradient={["#059669", "#065F46"]}
          />
          <KpiCard
            icon="file-text" label="فواتير اليوم"
            value={todayOrders.length}
            sub={`الإجمالي: ${orders.length} فاتورة`}
            accent="#3B82F6" gradient={["#2563EB", "#1E3A8A"]}
          />
          <KpiCard
            icon="clock" label="في الانتظار"
            value={pendingCnt}
            sub={`${inProgressCnt} قيد التنفيذ`}
            accent="#F59E0B" gradient={["#D97706", "#92400E"]}
          />
          <KpiCard
            icon="award" label="متوسط الفاتورة"
            value={`${avgTicket.toFixed(0)} ﷼`}
            sub="متوسط اليوم"
            accent="#8B5CF6" gradient={["#7C3AED", "#4C1D95"]}
          />
        </View>

        {/* Main grid: actions + orders */}
        <View style={IS_WEB ? styles.mainGridWeb : styles.mainGridMobile}>

          {/* Quick Actions */}
          <View style={IS_WEB ? styles.actionsColWeb : styles.actionsColMobile}>
            <View style={styles.sectionHeader}>
              <Feather name="grid" size={16} color={Colors.gold} />
              <Text style={styles.sectionTitle}>الوصول السريع</Text>
            </View>
            <View style={styles.actionsGrid}>
              {actions.map((a) => (
                <ActionTile
                  key={a.route}
                  label={a.label} icon={a.icon} accent={a.accent}
                  gradStart={a.gradStart} gradEnd={a.gradEnd}
                  badge={a.badge}
                  onPress={() => navigate(a.route)}
                />
              ))}
            </View>
          </View>

          {/* Recent Orders */}
          <View style={IS_WEB ? styles.ordersColWeb : styles.ordersColMobile}>
            <View style={styles.sectionHeader}>
              <Feather name="list" size={16} color={Colors.gold} />
              <Text style={styles.sectionTitle}>آخر الفواتير</Text>
              <TouchableOpacity onPress={() => navigate("archive")} style={styles.seeAll}>
                <Text style={styles.seeAllText}>عرض الكل</Text>
                <Feather name="chevron-left" size={13} color={Colors.gold} />
              </TouchableOpacity>
            </View>

            <View style={styles.ordersCard}>
              {/* Table header */}
              <View style={[or.row, or.headerRow]}>
                <Text style={[or.headerCell, or.numCol]}>رقم</Text>
                <Text style={[or.headerCell, or.nameCol]}>العميل</Text>
                <Text style={[or.headerCell, or.statusCol]}>الحالة</Text>
                <Text style={[or.headerCell, { textAlign: "left" }]}>المبلغ</Text>
              </View>

              {recentOrders.length === 0 ? (
                <View style={styles.emptyOrders}>
                  <Feather name="inbox" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>لا توجد فواتير بعد</Text>
                </View>
              ) : (
                recentOrders.map(o => (
                  <OrderRow key={o.id} order={o} onPress={() => navigate("archive")} />
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#EEF2F7" },

  // Header
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  logoPlaceholder: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(201,168,76,0.2)", borderWidth: 1, borderColor: Colors.gold + "40", alignItems: "center", justifyContent: "center" },
  companyName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  empName:     { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  clockBox:    { alignItems: "center", flex: 1.5 },
  clockTime:   { color: "#fff", fontSize: IS_WEB ? 26 : 20, fontWeight: "900", letterSpacing: 1, fontVariant: ["tabular-nums" as any] },
  clockDate:   { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  liveText:    { color: "#10B981", fontSize: 11, fontWeight: "700" },
  newOrderBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.gold, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  newOrderText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  // Body
  body:        { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  // Alerts
  alertsRow:   { gap: 8 },

  // KPI
  kpiRow:      { flexDirection: "row", gap: 12, flexWrap: "wrap" },

  // Section header
  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle:   { fontSize: 15, fontWeight: "800", color: Colors.text, flex: 1 },
  seeAll:         { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText:     { fontSize: 12, color: Colors.gold, fontWeight: "700" },

  // Main grid
  mainGridWeb:    { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  mainGridMobile: { flexDirection: "column", gap: 16 },
  actionsColWeb:  { flex: 1 },
  actionsColMobile: {},
  ordersColWeb:   { width: 400 },
  ordersColMobile: {},

  // Actions grid
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  // Orders card
  ordersCard:  { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },

  // Empty
  emptyOrders: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText:   { color: Colors.textMuted, fontSize: 13 },
});

const kpi = StyleSheet.create({
  card:     { flex: 1, minWidth: IS_WEB ? 180 : 150, backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  body:     { flex: 1 },
  value:    { fontSize: IS_WEB ? 22 : 20, fontWeight: "900", color: Colors.text },
  label:    { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  sub:      { fontSize: 10, color: Colors.textSecondary, marginTop: 3 },
});

const at = StyleSheet.create({
  wrap:      { width: IS_WEB ? 120 : "30%", minWidth: IS_WEB ? 110 : 90 },
  touch:     { borderRadius: 16, overflow: "hidden" },
  gradient:  { paddingVertical: 18, paddingHorizontal: 10, alignItems: "center", gap: 10, minHeight: 110 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  label:     { fontSize: 12, fontWeight: "800", textAlign: "center" },
  badgeBox:  { position: "absolute", top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});

const or = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F1F5F9" },
  headerRow: { backgroundColor: "#F8FAFC", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase" as const },
  numCol:    { width: 50 },
  nameCol:   { flex: 1, paddingHorizontal: 4 },
  statusCol: { width: 90 },
  num:       { fontSize: 13, fontWeight: "800", color: Colors.primary },
  name:      { fontSize: 13, fontWeight: "700", color: Colors.text },
  ago:       { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  pill:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start" },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  pillText:  { fontSize: 11, fontWeight: "700" },
  amount:    { fontSize: 13, fontWeight: "800", color: Colors.text, textAlign: "left", minWidth: 60 },
});

const ab = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  iconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  text:    { flex: 1, fontSize: 13, fontWeight: "600" },
});
