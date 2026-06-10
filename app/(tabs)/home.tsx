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

function fmtClock(d: Date) {
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtSecs(d: Date) {
  return d.toLocaleTimeString("ar-SA", { second: "2-digit", hour12: false });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" });
}

// ── Dept meta for cashier tracker ──────────────────────────────────────────────
const DEPT_META_TRACKER = {
  halwa:     { short: "حلا",       color: Colors.halwa },
  mawali:    { short: "موالح",     color: Colors.mawali },
  chocolate: { short: "شوكولاتة", color: Colors.chocolate },
  cake:      { short: "كيك",       color: Colors.cake },
  packaging: { short: "تغليف",    color: Colors.packaging },
} as const;

const STATUS_COLORS = {
  pending:     "#6B7280",
  in_progress: "#60A5FA",
  done:        "#34D399",
  cancelled:   "#F87171",
};

function CashierOrderTracker({ orders, isDark }: { orders: Order[]; isDark?: boolean }) {
  const todayStr = new Date().toDateString();
  const myOrders = orders
    .filter(o => !o.deleted && new Date(o.createdAt).toDateString() === todayStr)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25);

  const textColor = isDark ? "rgba(255,255,255,0.85)" : Colors.text;
  const subColor  = isDark ? "rgba(255,255,255,0.45)" : Colors.textMuted;
  const cardBg    = isDark ? "rgba(255,255,255,0.06)" : Colors.surface;
  const cardBorder= isDark ? "rgba(255,255,255,0.1)"  : Colors.border;

  if (myOrders.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 20 }}>
        <Feather name="inbox" size={28} color={subColor} />
        <Text style={[ct.emptyTxt, { color: subColor }]}>لا توجد طلبات اليوم</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {myOrders.map(order => {
        const depts = DEPARTMENTS.filter(d => order.items.some(i => i.department === d));
        const allDone = depts.length > 0 && depts.every(d => order.departmentStatuses?.[d] === "done");
        const anyInProg = depts.some(d => order.departmentStatuses?.[d] === "in_progress");

        return (
          <View key={order.id} style={[ct.card, { backgroundColor: cardBg, borderColor: allDone ? "#34D39940" : cardBorder }]}>
            {allDone && <View style={ct.doneLine} />}
            <View style={ct.cardHead}>
              <Text style={[ct.orderNum, { color: allDone ? "#34D399" : textColor }]}>#{order.orderNumber}</Text>
              <Text style={[ct.custName, { color: textColor }]} numberOfLines={1}>{order.customerName}</Text>
              <View style={[ct.statusBadge, {
                backgroundColor: allDone ? "#34D39918" : anyInProg ? "#60A5FA18" : "#6B728018",
              }]}>
                <View style={[ct.statusDot, { backgroundColor: allDone ? "#34D399" : anyInProg ? "#60A5FA" : "#6B7280" }]} />
                <Text style={[ct.statusTxt, { color: allDone ? "#34D399" : anyInProg ? "#60A5FA" : "#6B7280" }]}>
                  {allDone ? "جاهز" : anyInProg ? "يُحضَّر" : "انتظار"}
                </Text>
              </View>
            </View>
            <View style={ct.chips}>
              {depts.map(d => {
                const status = order.departmentStatuses?.[d] ?? "pending";
                const col = STATUS_COLORS[status] ?? "#6B7280";
                const dm = DEPT_META_TRACKER[d];
                return (
                  <View key={d} style={[ct.chip, { backgroundColor: col + "18", borderColor: col + "35" }]}>
                    <View style={[ct.chipDot, { backgroundColor: col }]} />
                    <Text style={[ct.chipTxt, { color: col }]}>{dm.short}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const ROLE_AR: Record<string, string> = {
  cashier: "كاشير", admin: "مدير", branch_supervisor: "مشرف فرع",
  dept_supervisor: "مشرف قسم", halwa: "قسم الحلا", mawali: "قسم الموالح",
  chocolate: "قسم الشوكولاتة", cake: "قسم الكيك", packaging: "قسم التغليف", guest: "زائر",
};

const ROLE_COLOR: Record<string, string> = {
  cashier: Colors.gold, admin: "#7C3AED", branch_supervisor: "#0D9488",
  dept_supervisor: "#0891B2", halwa: Colors.halwa, mawali: Colors.mawali,
  chocolate: Colors.chocolate, cake: Colors.cake, packaging: Colors.packaging,
};

// ── Tile definitions ───────────────────────────────────────────────────────────

const TILES = [
  { label: "كاشير",      icon: "file-text",   route: "cashier",   accent: Colors.gold,            primary: true  },
  { label: "الأرشيف",   icon: "archive",     route: "archive",   accent: "#60A5FA",              primary: false },
  { label: "التقارير",  icon: "bar-chart-2", route: "reports",   accent: "#A78BFA",              primary: false },
  { label: "حلا",        icon: "coffee",      route: "halwa",     accent: Colors.halwaLight,      primary: false },
  { label: "موالح",      icon: "package",     route: "mawali",    accent: Colors.mawaliLight,     primary: false },
  { label: "شوكولاتة",   icon: "gift",        route: "chocolate", accent: Colors.chocolateLight,  primary: false },
  { label: "كيك",        icon: "layers",      route: "cake",      accent: Colors.cakeLight,       primary: false },
  { label: "تغليف",      icon: "box",         route: "packaging", accent: Colors.packagingLight,  primary: false },
  { label: "توصيل",      icon: "truck",       route: "delivery",  accent: "#2DD4BF",              primary: false },
] as const;

const ADMIN_TILE = { label: "الإدارة", icon: "settings", route: "admin", accent: "#94A3B8", primary: false } as const;

// ── Tile component ─────────────────────────────────────────────────────────────

function Tile({ label, icon, accent, primary, badge, size, onPress }: {
  label: string; icon: string; accent: string; primary?: boolean;
  badge?: number; size: number; onPress: () => void;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(sc, { toValue: 0.93, useNativeDriver: true, speed: 120 }),
      Animated.spring(sc, { toValue: 1.00, useNativeDriver: true, speed: 90 }),
    ]).start();
    onPress();
  };

  const r      = Math.round(size * 0.14);
  const iconSz = size >= 120 ? 32 : size >= 90 ? 26 : 22;
  const fz     = size >= 120 ? 13 : size >= 90 ? 11 : 10;

  const bg1 = primary ? "#2A1A00" : "#162038";
  const bg2 = primary ? "#1A0F00" : "#0C1525";

  return (
    <Animated.View style={[{ width: size, height: size }, { transform: [{ scale: sc }] }]}>
      <TouchableOpacity style={{ flex: 1, borderRadius: r, overflow: "hidden" }} onPress={press} activeOpacity={0.8}>
        <LinearGradient
          colors={[bg1, bg2]}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: size >= 90 ? 10 : 7 }}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          {/* Accent strip */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: accent }} />

          {/* Icon container */}
          <View style={{
            width: iconSz + 20, height: iconSz + 20, borderRadius: (iconSz + 20) / 2,
            backgroundColor: accent + "22", alignItems: "center", justifyContent: "center",
          }}>
            <Feather name={icon as any} size={iconSz} color={primary ? Colors.gold : "rgba(255,255,255,0.92)"} />
          </View>

          <Text
            style={{ color: primary ? Colors.gold : "rgba(255,255,255,0.88)", fontSize: fz, fontWeight: "800", textAlign: "center" }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </LinearGradient>

        {!!badge && (
          <View style={{
            position: "absolute", top: 8, right: 8,
            minWidth: 18, height: 18, borderRadius: 9,
            backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
            paddingHorizontal: 4, borderWidth: 2, borderColor: bg2,
          }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  return (
    <View style={[sc2.card, { borderColor: color + "30" }]}>
      <View style={[sc2.iconBox, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={14} color={color} />
      </View>
      <Text style={[sc2.value, { color }]}>{value}</Text>
      <Text style={sc2.label}>{label}</Text>
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
  const isLavi   = company.id === LAVIVIANE_COMPANY_ID;
  const todayStr = useMemo(() => new Date().toDateString(), []);

  const todayOrders   = useMemo(() => orders.filter(o => new Date(o.createdAt).toDateString() === todayStr), [orders, todayStr]);
  const todayRevenue  = useMemo(() => todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0), [todayOrders]);
  const pendingCnt    = useMemo(() => todayOrders.filter(o => overallStatus(o) === "pending").length,     [todayOrders]);
  const inProgressCnt = useMemo(() => todayOrders.filter(o => overallStatus(o) === "in_progress").length, [todayOrders]);
  const doneCnt       = useMemo(() => todayOrders.filter(o => overallStatus(o) === "done").length,        [todayOrders]);

  const role = currentEmployee?.role;
  const isCashierRole = role === "cashier";
  const tiles = useMemo(() => {
    if (!role || role === "admin" || role === "branch_supervisor" || role === "dept_supervisor") {
      return isAdmin ? [...TILES, ADMIN_TILE] : [...TILES];
    }
    if (role === "cashier") {
      return TILES.filter(t => ["cashier", "archive", "delivery"].includes(t.route));
    }
    // Dept workers: only their own dept tile
    return TILES.filter(t => t.route === role);
  }, [role, isAdmin]);

  const go = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  // Always force 3 columns — compute exact tile size
  const SIDEBAR_W = winW >= 768 ? 220 : 0;
  const INFO_W    = isWide ? 280 : 0;
  const TILE_GAP  = isWide ? 14 : 10;
  const TILE_PAD  = isWide ? 28 : 16;
  const gridAvail = winW - SIDEBAR_W - INFO_W - TILE_PAD * 2 - TILE_GAP * 2;
  const tileSize  = isWide
    ? Math.min(180, Math.max(86, Math.floor(gridAvail / 3)))
    : Math.floor((winW - 32 - TILE_GAP * 2) / 3);

  const empColor = ROLE_COLOR[currentEmployee?.role ?? ""] ?? Colors.gold;

  // ── Wide layout ──────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={s.screen}>
        <View style={s.wideLayout}>

          {/* ── Tile grid (left / larger) ──────────────────────────────────── */}
          <View style={s.gridPanel}>
            {/* Top CTA row */}
            <View style={[s.ctaRow, { paddingHorizontal: TILE_PAD, paddingTop: TILE_PAD }]}>
              <TouchableOpacity style={s.ctaBtn} onPress={() => go("cashier")} activeOpacity={0.85}>
                <LinearGradient colors={[Colors.gold, "#A07830"]} style={s.ctaBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Feather name="plus" size={18} color="#0A1628" />
                  <Text style={s.ctaBtnTxt}>فاتورة جديدة</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={[s.sectionDivider, { marginHorizontal: TILE_PAD }]} />

            <ScrollView
              contentContainerStyle={[s.gridContent, { padding: TILE_PAD, paddingTop: 16, gap: TILE_GAP }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[s.tileGrid, { gap: TILE_GAP }]}>
                {tiles.map(t => (
                  <Tile
                    key={t.route}
                    label={t.label}
                    icon={t.icon}
                    accent={t.accent}
                    primary={(t as any).primary}
                    badge={t.route === "admin" ? pendingCount || undefined : undefined}
                    size={tileSize}
                    onPress={() => go(t.route)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* ── Info panel (right) ────────────────────────────────────────── */}
          <LinearGradient
            colors={["#080F1E", "#0E1A30", "#152240"]}
            style={[s.infoPanel, { width: INFO_W }]}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          >
            <ScrollView contentContainerStyle={s.infoPanelContent} showsVerticalScrollIndicator={false}>

              {/* Brand */}
              {isLavi ? (
                <View style={s.laviWrap}>
                  <Image source={{ uri: "/laviviane-logo.png" }} style={s.laviLogo} contentFit="contain" />
                </View>
              ) : (
                <View style={s.brandWrap}>
                  <View style={[s.brandBadge, { backgroundColor: Colors.gold }]}>
                    <Text style={s.brandBadgeTxt}>{(company.name || "ف").charAt(0)}</Text>
                  </View>
                  <Text style={s.brandName} numberOfLines={2}>{company.name}</Text>
                </View>
              )}

              {/* Gold rule */}
              <LinearGradient
                colors={["transparent", Colors.gold + "80", "transparent"]}
                style={s.goldRule}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />

              {/* Employee */}
              <View style={s.empSection}>
                <View style={s.liveRow}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>متصل الآن</Text>
                </View>

                {currentEmployee ? (
                  <View style={s.empCard}>
                    <View style={[s.empAvatar, { backgroundColor: empColor + "25", borderColor: empColor }]}>
                      <Text style={[s.empAvatarTxt, { color: empColor }]}>{currentEmployee.name.charAt(0)}</Text>
                    </View>
                    <View style={s.empInfo}>
                      <Text style={s.empName} numberOfLines={1}>{currentEmployee.name}</Text>
                      <View style={[s.empRoleBadge, { backgroundColor: empColor + "25" }]}>
                        <Text style={[s.empRoleTxt, { color: empColor }]}>
                          {ROLE_AR[currentEmployee.role] ?? currentEmployee.role}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={s.noEmp}>لم يسجل أحد دخوله</Text>
                )}
              </View>

              {/* Stats grid */}
              <View style={s.statsSection}>
                <Text style={s.statsTitle}>إحصائيات اليوم</Text>
                <View style={s.statsGrid}>
                  <StatCard label="إجمالي"     value={todayOrders.length} color={Colors.gold}  icon="list" />
                  <StatCard label="انتظار"      value={pendingCnt}          color="#F59E0B"       icon="clock" />
                  <StatCard label="قيد التنفيذ" value={inProgressCnt}       color="#60A5FA"       icon="zap" />
                  <StatCard label="جاهز"        value={doneCnt}             color="#34D399"       icon="check-circle" />
                </View>
              </View>

              {/* Revenue */}
              <View style={s.revenueSection}>
                <Text style={s.revenueLabel}>إيرادات اليوم</Text>
                <Text style={s.revenueValue}>
                  {todayRevenue > 0 ? todayRevenue.toLocaleString("ar-SA") : "٠"} <Text style={s.revenueCur}>ريال</Text>
                </Text>
              </View>

              <View style={s.thinRule} />

              {/* Cashier order tracker */}
              {isCashierRole && (
                <View style={s.trackerSection}>
                  <Text style={s.trackerTitle}>متابعة طلباتك اليوم</Text>
                  <CashierOrderTracker orders={todayOrders} isDark />
                </View>
              )}

              {/* Clock */}
              <View style={s.clockSection}>
                <Text style={s.clockTime}>{fmtClock(now)}</Text>
                <Text style={s.clockSecs}>{fmtSecs(now)}</Text>
                <Text style={s.clockDate}>{fmtDate(now)}</Text>
              </View>

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
        {[
          { num: todayOrders.length, lbl: "اليوم",  color: Colors.gold  },
          { num: pendingCnt,          lbl: "انتظار", color: "#F59E0B"    },
          { num: inProgressCnt,       lbl: "تنفيذ",  color: "#60A5FA"    },
          { num: doneCnt,             lbl: "جاهز ✓", color: "#34D399"    },
        ].map((item, i, arr) => (
          <React.Fragment key={item.lbl}>
            <View style={s.stripCell}>
              <Text style={[s.stripNum, { color: item.color }]}>{item.num}</Text>
              <Text style={s.stripLbl}>{item.lbl}</Text>
            </View>
            {i < arr.length - 1 && <View style={s.stripSep} />}
          </React.Fragment>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={s.stripClock}>{fmtClock(now)}</Text>
      </View>

      {/* New invoice CTA */}
      <View style={s.narrowCta}>
        <TouchableOpacity style={s.narrowCtaBtn} onPress={() => go("cashier")} activeOpacity={0.85}>
          <LinearGradient colors={[Colors.gold, "#A07830"]} style={s.narrowCtaInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Feather name="plus" size={16} color="#0A1628" />
            <Text style={s.narrowCtaTxt}>فاتورة جديدة</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Cashier order tracker — mobile */}
      {isCashierRole && (
        <View style={s.narrowTracker}>
          <Text style={s.narrowTrackerTitle}>متابعة الطلبات</Text>
          <CashierOrderTracker orders={todayOrders} isDark={false} />
        </View>
      )}

      {/* Tile grid */}
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
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
              primary={(t as any).primary}
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
  screen:      { flex: 1, backgroundColor: "#fff" },
  wideLayout:  { flex: 1, flexDirection: "row" },

  // Grid panel
  gridPanel:   { flex: 1, backgroundColor: "#fff", overflow: "hidden" as any },
  ctaRow:      { },
  ctaBtn:      { borderRadius: 14, overflow: "hidden" },
  ctaBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  ctaBtnTxt:   { color: "#0A1628", fontSize: 16, fontWeight: "900" },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E8EDF5", marginVertical: 16 },
  gridContent: { gap: 12 },
  tileGrid:    { flexDirection: "row", flexWrap: "wrap" },

  // Info panel
  infoPanel:        { flexShrink: 0, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.06)" },
  infoPanelContent: { padding: 22, gap: 18 },

  // Brand
  laviWrap:     { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  laviLogo:     { width: 190, height: 72 },
  brandWrap:    { alignItems: "center", gap: 10, paddingTop: 8 },
  brandBadge:   { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  brandBadgeTxt:{ fontSize: 26, fontWeight: "900", color: "#0A1628" },
  brandName:    { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" },

  goldRule: { height: 1, borderRadius: 1 },

  // Employee
  empSection: { gap: 10 },
  liveRow:    { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  liveTxt:    { color: "#34D399", fontSize: 11, fontWeight: "700" },
  empCard:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  empAvatar:  { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  empAvatarTxt:{ fontSize: 18, fontWeight: "900" },
  empInfo:    { flex: 1, gap: 4 },
  empName:    { color: "#fff", fontSize: 14, fontWeight: "700" },
  empRoleBadge:{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  empRoleTxt: { fontSize: 10, fontWeight: "700" },
  noEmp:      { color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic" },

  // Stats
  statsSection: { gap: 8 },
  statsTitle:   { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  // Revenue
  revenueSection: { backgroundColor: "rgba(201,168,76,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(201,168,76,0.2)", gap: 4 },
  revenueLabel:   { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600" },
  revenueValue:   { color: Colors.gold, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  revenueCur:     { fontSize: 13, fontWeight: "600" },

  thinRule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)" },

  // Clock
  clockSection: { alignItems: "center", gap: 4 },
  clockTime:    { color: "#fff", fontSize: 36, fontWeight: "900", fontVariant: ["tabular-nums" as any], letterSpacing: 1 },
  clockSecs:    { color: "rgba(255,255,255,0.35)", fontSize: 13, fontVariant: ["tabular-nums" as any] },
  clockDate:    { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },

  // Narrow stats strip
  statsStrip: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4FB", gap: 10 },
  stripCell:  { alignItems: "center", gap: 1 },
  stripNum:   { fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  stripLbl:   { fontSize: 9, color: Colors.textMuted, fontWeight: "600" },
  stripSep:   { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: "#E8EDF5" },
  stripClock: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums" as any] },

  // Narrow CTA
  narrowCta:      { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: "#fff" },
  narrowCtaBtn:   { borderRadius: 12, overflow: "hidden" },
  narrowCtaInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13 },
  narrowCtaTxt:   { color: "#0A1628", fontSize: 15, fontWeight: "900" },

  // Cashier tracker — desktop info panel
  trackerSection:  { gap: 10 },
  trackerTitle:    { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  // Cashier tracker — mobile
  narrowTracker:      { paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff" },
  narrowTrackerTitle: { fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 8, letterSpacing: 0.5 },
});

const sc2 = StyleSheet.create({
  card:    { width: "47%", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, alignItems: "flex-start" },
  iconBox: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  value:   { fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  label:   { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600" },
});

const ct = StyleSheet.create({
  emptyTxt:    { fontSize: 12, marginTop: 8 },
  card:        { borderRadius: 10, borderWidth: 1, padding: 10, gap: 7, overflow: "hidden" as const, position: "relative" as const },
  doneLine:    { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "#34D399" },
  cardHead:    { flexDirection: "row", alignItems: "center", gap: 8 },
  orderNum:    { fontSize: 13, fontWeight: "800", minWidth: 36 },
  custName:    { flex: 1, fontSize: 12, fontWeight: "600" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statusDot:   { width: 5, height: 5, borderRadius: 3 },
  statusTxt:   { fontSize: 10, fontWeight: "700" },
  chips:       { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  chipDot:     { width: 5, height: 5, borderRadius: 3 },
  chipTxt:     { fontSize: 10, fontWeight: "700" },
});
