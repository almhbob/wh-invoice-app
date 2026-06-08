import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
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

function fmtTime(d: Date) {
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" });
}

const ROLE_AR: Record<string, string> = {
  cashier: "كاشير", admin: "مدير", branch_supervisor: "مشرف فرع",
  dept_supervisor: "مشرف قسم", halwa: "قسم الحلا", mawali: "قسم الموالح",
  chocolate: "قسم الشوكولاتة", cake: "قسم الكيك", packaging: "قسم التغليف", guest: "زائر",
};

// ── Tile definitions ───────────────────────────────────────────────────────────

const TILES: { label: string; icon: string; route: string; accent: string }[] = [
  { label: "كاشير",      icon: "file-text",   route: "cashier",   accent: Colors.gold },
  { label: "الأرشيف",   icon: "archive",     route: "archive",   accent: "#60A5FA" },
  { label: "التقارير",  icon: "bar-chart-2", route: "reports",   accent: "#A78BFA" },
  { label: "حلا",        icon: "coffee",      route: "halwa",     accent: Colors.halwaLight },
  { label: "موالح",      icon: "package",     route: "mawali",    accent: Colors.mawaliLight },
  { label: "شوكولاتة",   icon: "gift",        route: "chocolate", accent: Colors.chocolateLight },
  { label: "كيك",        icon: "layers",      route: "cake",      accent: Colors.cakeLight },
  { label: "تغليف",      icon: "box",         route: "packaging", accent: Colors.packagingLight },
  { label: "توصيل",      icon: "truck",       route: "delivery",  accent: "#2DD4BF" },
];

const ADMIN_TILE = { label: "الإدارة", icon: "settings", route: "admin", accent: "#94A3B8" };

// ── Sub-components ─────────────────────────────────────────────────────────────

function Tile({
  label, icon, accent, badge, size, onPress,
}: {
  label: string; icon: string; accent: string;
  badge?: number; size: number; onPress: () => void;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(sc, { toValue: 0.91, useNativeDriver: true, speed: 120 }),
      Animated.spring(sc, { toValue: 1.00, useNativeDriver: true, speed: 80 }),
    ]).start();
    onPress();
  };
  const r = Math.round(size * 0.16);
  const iconSz = size >= 100 ? 26 : 22;
  const fz     = size >= 100 ? 12 : 10;

  return (
    <Animated.View style={[{ width: size, height: size }, { transform: [{ scale: sc }] }]}>
      <TouchableOpacity style={[ti.outer, { borderRadius: r }]} onPress={press} activeOpacity={0.82}>
        {/* accent strip at top */}
        <View style={[ti.strip, { backgroundColor: accent, borderTopLeftRadius: r, borderTopRightRadius: r }]} />
        <View style={ti.body}>
          <Feather name={icon as any} size={iconSz} color="rgba(255,255,255,0.9)" />
          <Text style={[ti.lbl, { fontSize: fz }]} numberOfLines={1}>{label}</Text>
        </View>
        {!!badge && (
          <View style={[ti.badge, { backgroundColor: accent }]}>
            <Text style={ti.badgeTxt}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function StatRow({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <View style={st.row}>
      <View style={[st.dot, { backgroundColor: color }]} />
      <Text style={st.label}>{label}</Text>
      <Text style={[st.value, { color }]}>{value}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const isWide  = winW >= 700;

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
  const isLavi   = company.id === LAVIVIANE_COMPANY_ID;

  const todayOrders = useMemo(
    () => orders.filter(o => new Date(o.createdAt).toDateString() === todayStr),
    [orders, todayStr],
  );
  const todayRevenue  = useMemo(() => todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0), [todayOrders]);
  const pendingCnt    = useMemo(() => todayOrders.filter(o => overallStatus(o) === "pending").length,     [todayOrders]);
  const inProgressCnt = useMemo(() => todayOrders.filter(o => overallStatus(o) === "in_progress").length, [todayOrders]);
  const doneCnt       = useMemo(() => todayOrders.filter(o => overallStatus(o) === "done").length,        [todayOrders]);

  const tiles = useMemo(
    () => isAdmin ? [...TILES, ADMIN_TILE] : TILES,
    [isAdmin],
  );

  const go = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  // Tile size calculation
  const SIDEBAR_W = winW >= 768 ? 220 : 0;
  const INFO_W    = isWide ? 260 : 0;
  const TILE_GAP  = isWide ? 12 : 10;
  const TILE_PAD  = isWide ? 24 : 16;
  const gridAvail = winW - SIDEBAR_W - INFO_W - TILE_PAD * 2 - TILE_GAP * 2;
  const tileSize  = isWide
    ? Math.min(148, Math.max(88, Math.floor(gridAvail / 3)))
    : Math.floor((winW - 32 - TILE_GAP * 2) / 3);

  // ── Wide layout ────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={s.screen}>
        <View style={s.wideLayout}>

          {/* ── Left: Tile grid ───────────────────────────────────────────── */}
          <ScrollView
            style={s.gridPanel}
            contentContainerStyle={[s.gridContent, { padding: TILE_PAD, gap: TILE_GAP }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.gridTitle}>الوصول السريع</Text>
            <View style={[s.tileGrid, { gap: TILE_GAP }]}>
              {tiles.map((t, i) => (
                <Tile
                  key={t.route}
                  label={t.label}
                  icon={t.icon}
                  accent={t.accent}
                  badge={t.route === "cashier" ? undefined : t.route === "admin" ? pendingCount || undefined : undefined}
                  size={tileSize}
                  onPress={() => go(t.route)}
                />
              ))}
            </View>
          </ScrollView>

          {/* ── Right: Info panel ─────────────────────────────────────────── */}
          <LinearGradient
            colors={["#0D1E38", "#1A2744"]}
            style={[s.infoPanel, { width: INFO_W }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <ScrollView
              contentContainerStyle={s.infoPanelContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Brand */}
              {isLavi ? (
                <View style={s.laviLogoWrap}>
                  <Image
                    source={{ uri: "/laviviane-logo.png" }}
                    style={s.laviLogo}
                    contentFit="contain"
                  />
                </View>
              ) : (
                <View style={s.brandBlock}>
                  <View style={[s.brandBadge, { backgroundColor: Colors.gold }]}>
                    <Text style={s.brandBadgeTxt}>
                      {(company.name || "ف").charAt(0)}
                    </Text>
                  </View>
                  <Text style={s.brandName} numberOfLines={2}>{company.name}</Text>
                </View>
              )}

              <View style={s.divider} />

              {/* Live + employee */}
              <View style={s.liveRow}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>متصل</Text>
              </View>

              {currentEmployee ? (
                <View style={s.empBlock}>
                  <View style={s.empAvatar}>
                    <Text style={s.empAvatarTxt}>{currentEmployee.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.empName} numberOfLines={1}>{currentEmployee.name}</Text>
                    <Text style={s.empRole}>
                      {ROLE_AR[currentEmployee.role] ?? currentEmployee.role}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={s.noEmp}>لم يسجل أحد دخوله</Text>
              )}

              <View style={s.divider} />

              {/* Today stats */}
              <Text style={s.statsTitle}>إحصائيات اليوم</Text>
              <View style={s.statsCard}>
                <StatRow icon="list"         label="الطلبات"    value={todayOrders.length} color={Colors.gold} />
                <StatRow icon="clock"         label="انتظار"     value={pendingCnt}          color="#F59E0B" />
                <StatRow icon="zap"           label="قيد التنفيذ" value={inProgressCnt}       color="#60A5FA" />
                <StatRow icon="check-circle"  label="جاهز"       value={doneCnt}             color="#34D399" />
              </View>

              <View style={[s.revenueRow]}>
                <Text style={s.revenueLabel}>إيرادات اليوم</Text>
                <Text style={s.revenueValue}>{todayRevenue.toLocaleString("ar-SA")} ﷼</Text>
              </View>

              <View style={s.divider} />

              {/* Clock */}
              <Text style={s.clock}>{fmtTime(now)}</Text>
              <Text style={s.dateStr}>{fmtDate(now)}</Text>
            </ScrollView>
          </LinearGradient>

        </View>
      </View>
    );
  }

  // ── Narrow layout ─────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      {/* Stats strip */}
      <View style={s.statsStrip}>
        <View style={s.stripItem}>
          <Text style={[s.stripNum, { color: Colors.gold }]}>{todayOrders.length}</Text>
          <Text style={s.stripLbl}>اليوم</Text>
        </View>
        <View style={s.stripDivider} />
        <View style={s.stripItem}>
          <Text style={[s.stripNum, { color: "#F59E0B" }]}>{pendingCnt}</Text>
          <Text style={s.stripLbl}>انتظار</Text>
        </View>
        <View style={s.stripDivider} />
        <View style={s.stripItem}>
          <Text style={[s.stripNum, { color: "#60A5FA" }]}>{inProgressCnt}</Text>
          <Text style={s.stripLbl}>تنفيذ</Text>
        </View>
        <View style={s.stripDivider} />
        <View style={s.stripItem}>
          <Text style={[s.stripNum, { color: "#34D399" }]}>{doneCnt}</Text>
          <Text style={s.stripLbl}>جاهز ✓</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={s.stripClock}>{fmtTime(now)}</Text>
      </View>

      {/* Tile grid */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.gridContent, { padding: 16, gap: TILE_GAP, paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.tileGrid, { gap: TILE_GAP }]}>
          {tiles.map(t => (
            <Tile
              key={t.route}
              label={t.label}
              icon={t.icon}
              accent={t.accent}
              badge={t.route === "admin" ? pendingCount || undefined : undefined}
              size={tileSize}
              onPress={() => go(t.route)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F0F4FB" },

  // Wide layout
  wideLayout: { flex: 1, flexDirection: "row" },

  // Tile grid panel
  gridPanel:   { flex: 1, backgroundColor: "#F0F4FB" },
  gridContent: { gap: 12 },
  gridTitle:   { fontSize: 13, fontWeight: "800", color: Colors.textMuted, letterSpacing: 0.5 },
  tileGrid:    { flexDirection: "row", flexWrap: "wrap" },

  // Info panel
  infoPanel:        { flexShrink: 0, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.07)" },
  infoPanelContent: { padding: 20, gap: 14 },

  // Laviviane logo
  laviLogoWrap: { alignItems: "center", paddingVertical: 8 },
  laviLogo:     { width: 180, height: 68 },

  // Generic brand
  brandBlock:    { alignItems: "center", gap: 10, paddingVertical: 4 },
  brandBadge:    { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  brandBadgeTxt: { fontSize: 26, fontWeight: "900", color: "#0A1628" },
  brandName:     { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" },

  // Divider
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)" },

  // Live indicator
  liveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  liveTxt: { color: "#34D399", fontSize: 12, fontWeight: "700" },

  // Employee
  empBlock:      { flexDirection: "row", alignItems: "center", gap: 10 },
  empAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.gold + "30", borderWidth: 2, borderColor: Colors.gold, alignItems: "center", justifyContent: "center" },
  empAvatarTxt:  { color: Colors.gold, fontSize: 16, fontWeight: "900" },
  empName:       { color: "#fff", fontSize: 13, fontWeight: "700" },
  empRole:       { color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 },
  noEmp:         { color: "rgba(255,255,255,0.35)", fontSize: 11, fontStyle: "italic" },

  // Stats
  statsTitle: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" as any },
  statsCard:  { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  // Revenue
  revenueRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  revenueLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "600" },
  revenueValue: { color: Colors.gold, fontSize: 16, fontWeight: "900" },

  // Clock
  clock:   { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", fontVariant: ["tabular-nums" as any] },
  dateStr: { color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center" },

  // Narrow stats strip
  statsStrip:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  stripItem:    { alignItems: "center", gap: 1 },
  stripNum:     { fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  stripLbl:     { fontSize: 9, color: Colors.textMuted, fontWeight: "600" },
  stripDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: Colors.border },
  stripClock:   { color: Colors.textMuted, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums" as any] },
});

const ti = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#1A2744", overflow: "hidden", position: "relative" },
  strip: { height: 3, width: "100%" },
  body:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 6 },
  lbl:   { color: "rgba(255,255,255,0.88)", fontWeight: "800", textAlign: "center" },
  badge: { position: "absolute", top: 7, right: 7, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#1A2744" },
  badgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900" },
});

const st = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8 },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  label: { flex: 1, color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  value: { fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
});
