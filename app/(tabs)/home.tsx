import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
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
import { usePriceChange } from "@/context/PriceChangeContext";
import { Department, Order, useOrders } from "@/context/OrdersContext";
import { fmtDate } from "@/utils/dateUtils";

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEPARTMENTS: Department[] = ["halwa", "mawali", "chocolate", "cake", "packaging"];

function overallStatus(order: Order): string {
  const statuses = DEPARTMENTS.map(d => order.departmentStatuses?.[d]).filter(Boolean);
  if (statuses.length === 0) return "pending";
  if (statuses.every(s => s === "done")) return "done";
  if (statuses.some(s => s === "cancelled")) return "cancelled";
  if (statuses.some(s => s === "in_progress")) return "in_progress";
  return "pending";
}

// ── Quick-action cards ─────────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  icon: string;
  route: string;
  accent: string;
  badge?: number;
}

function QuickCard({ action, onPress }: { action: QuickAction; onPress: () => void }) {
  return (
    <TouchableOpacity style={[qa.card, { borderColor: action.accent + "40" }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[qa.iconBox, { backgroundColor: action.accent + "20" }]}>
        <Feather name={action.icon as any} size={24} color={action.accent} />
      </View>
      <Text style={[qa.label, { color: action.accent }]} numberOfLines={1}>{action.label}</Text>
      {!!action.badge && (
        <View style={[qa.badge, { backgroundColor: action.accent }]}>
          <Text style={qa.badgeText}>{action.badge > 99 ? "99+" : action.badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <View style={[sc.card, { borderLeftColor: accent }]}>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

// ── Recent order row ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:     { label: "انتظار",    color: Colors.gold },
  in_progress: { label: "جاري",     color: "#2563eb" },
  done:        { label: "مكتمل",    color: "#16a34a" },
  cancelled:   { label: "ملغي",     color: "#dc2626" },
};

function RecentRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const meta = STATUS_META[overallStatus(order)] ?? STATUS_META.pending;
  return (
    <TouchableOpacity style={rr.row} onPress={onPress} activeOpacity={0.7}>
      <View style={rr.numBox}>
        <Text style={rr.num}>#{order.orderNumber}</Text>
      </View>
      <View style={rr.info}>
        <Text style={rr.customer} numberOfLines={1}>{order.customerName || "—"}</Text>
        <Text style={rr.date}>{fmtDate(order.createdAt)}</Text>
      </View>
      <View style={[rr.badge, { backgroundColor: meta.color + "20", borderColor: meta.color + "50" }]}>
        <Text style={[rr.badgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
      <Text style={rr.amount}>{order.totalAmount?.toFixed(0)} ر.س</Text>
    </TouchableOpacity>
  );
}

// ── Alert card ─────────────────────────────────────────────────────────────────

function AlertCard({ text, color, icon, onPress }: { text: string; color: string; icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={[al.card, { borderColor: color + "50", backgroundColor: color + "10" }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <Feather name={icon as any} size={16} color={color} />
      <Text style={[al.text, { color }]} numberOfLines={2}>{text}</Text>
      {onPress && <Feather name="chevron-left" size={14} color={color + "80"} />}
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { company } = useCompany();
  const { currentEmployee } = useEmployee();
  const { orders } = useOrders();
  const { pendingCount } = usePriceChange();

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
  const pendingOrders = useMemo(
    () => orders.filter(o => overallStatus(o) === "pending").length,
    [orders]
  );
  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [orders]
  );

  const quickActions: QuickAction[] = [
    { label: "كاشير",       icon: "file-text",    route: "cashier",          accent: Colors.gold },
    { label: "الأرشيف",     icon: "archive",      route: "archive",          accent: Colors.primaryLight },
    { label: "التقارير",    icon: "pie-chart",    route: "reports",          accent: "#8b5cf6" },
    { label: "حلا",         icon: "coffee",       route: "halwa",            accent: Colors.halwa },
    { label: "مولي",        icon: "package",      route: "mawali",           accent: Colors.mawali },
    { label: "شوكولاتة",    icon: "gift",         route: "chocolate",        accent: Colors.chocolate },
    { label: "كيك",         icon: "layers",       route: "cake",             accent: Colors.cake },
    { label: "التغليف",     icon: "box",          route: "packaging",        accent: Colors.packaging },
    { label: "توصيل",       icon: "truck",        route: "delivery",         accent: "#0d9488" },
    { label: "العملاء",     icon: "users",        route: "customers",        accent: "#0891b2" },
    ...(isAdmin ? [{ label: "الإدارة", icon: "settings", route: "admin", accent: Colors.primaryLight, badge: pendingCount || undefined }] : []),
  ];

  const navigate = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <View>
          <Text style={styles.greetTitle}>
            {currentEmployee ? `مرحباً، ${currentEmployee.name.split(" ")[0]}` : `مرحباً بك`}
          </Text>
          <Text style={styles.greetSub}>{company.name || "فاتورة"}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Feather name="calendar" size={12} color={Colors.gold} />
          <Text style={styles.dateText}>{new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "short" })}</Text>
        </View>
      </View>

      {/* Alerts */}
      {pendingCount > 0 && (
        <View style={styles.section}>
          <AlertCard
            text={`${pendingCount} طلب تغيير سعر معلق — تحتاج موافقة`}
            color="#f59e0b"
            icon="alert-circle"
            onPress={() => navigate("admin")}
          />
        </View>
      )}
      {pendingOrders > 0 && (
        <View style={styles.sectionNoTop}>
          <AlertCard
            text={`${pendingOrders} فاتورة في الانتظار لم تبدأ بعد`}
            color="#3b82f6"
            icon="clock"
            onPress={() => navigate("archive")}
          />
        </View>
      )}

      {/* Stats */}
      <Text style={styles.sectionTitle}>ملخص اليوم</Text>
      <View style={styles.statsRow}>
        <StatCard label="فواتير اليوم"  value={todayOrders.length} accent={Colors.gold} />
        <StatCard label="الإيرادات"      value={`${todayRevenue.toFixed(0)} ﷼`} accent="#16a34a" />
        <StatCard label="في الانتظار"   value={pendingOrders}       accent="#f59e0b" />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>وصول سريع</Text>
      <View style={styles.quickGrid}>
        {quickActions.map((a) => (
          <QuickCard key={a.route} action={a} onPress={() => navigate(a.route)} />
        ))}
      </View>

      {/* Recent orders */}
      <Text style={styles.sectionTitle}>آخر الفواتير</Text>
      {recentOrders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="inbox" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>لا توجد فواتير بعد</Text>
        </View>
      ) : (
        <View style={styles.recentList}>
          {recentOrders.map((o) => (
            <RecentRow key={o.id} order={o} onPress={() => navigate("archive")} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 0 },
  greeting: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.primary, borderRadius: 16, padding: 18, marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  greetTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  greetSub:   { color: Colors.gold, fontSize: 12, fontWeight: "600", marginTop: 2 },
  dateBadge:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  dateText:   { color: "#fff", fontSize: 11, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: Colors.text, marginTop: 20, marginBottom: 10 },
  section:       { marginBottom: 4 },
  sectionNoTop:  { marginBottom: 4 },
  statsRow:   { flexDirection: "row", gap: 10 },
  quickGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  recentList: { borderRadius: 14, backgroundColor: "#fff", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyBox:   { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40, backgroundColor: "#fff", borderRadius: 14 },
  emptyText:  { color: Colors.textMuted, fontSize: 14 },
});

const qa = StyleSheet.create({
  card: {
    width: Platform.OS === "web" ? 110 : "30%",
    minWidth: 90,
    alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 6,
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    position: "relative",
  },
  iconBox:  { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label:    { fontSize: 12, fontWeight: "700", textAlign: "center" },
  badge:    { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

const sc = StyleSheet.create({
  card:  { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  value: { fontSize: 22, fontWeight: "900", color: Colors.text },
  label: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});

const rr = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" },
  numBox:   { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center" },
  num:      { color: Colors.primary, fontSize: 12, fontWeight: "800" },
  info:     { flex: 1, gap: 2 },
  customer: { fontSize: 13, fontWeight: "700", color: Colors.text },
  date:     { fontSize: 10, color: Colors.textMuted },
  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  amount:   { fontSize: 13, fontWeight: "800", color: Colors.text },
});

const al = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  text: { flex: 1, fontSize: 13, fontWeight: "600" },
});
