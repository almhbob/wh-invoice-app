import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
import { canDo, ROLE_CAN_ACCESS_ADMIN } from "@/constants/rbac";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Department, Order, useOrders } from "@/context/OrdersContext";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { AttentionBanner } from "@/components/AttentionBanner";
import { usePriceChange } from "@/context/PriceChangeContext";
import type { TranslationKey } from "@/constants/translations";

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

// ── Dept meta for cashier tracker (built at runtime with t()) ──────────────────
const DEPT_COLORS = {
  halwa: Colors.halwa, mawali: Colors.mawali, chocolate: Colors.chocolate,
  cake: Colors.cake, packaging: Colors.packaging,
} as const;

// On light surfaces use the base status tones; on dark espresso use the lifted ones.
const HERO_WAIT = "#F2C46B";
const HERO_PROG = "#8FC9D2";
const HERO_DONE = "#6FD0A0";

const STATUS_COLORS = {
  pending:     Colors.textSecondary,
  in_progress: Colors.statusInProgress,
  done:        Colors.statusDone,
  cancelled:   Colors.statusCancelled,
};

function CashierOrderTracker({ orders, isDark }: { orders: Order[]; isDark?: boolean }) {
  const DONE_C = isDark ? HERO_DONE : Colors.statusDone;
  const PROG_C = isDark ? HERO_PROG : Colors.statusInProgress;
  const WAIT_C = isDark ? "#B9AC9C" : Colors.textSecondary;
  const { t } = useLang();
  const deptMeta = useMemo(() => ({
    halwa:     { short: t("deptHalwaShort"),     color: Colors.halwa },
    mawali:    { short: t("deptMawaliShort"),    color: Colors.mawali },
    chocolate: { short: t("deptChocolateShort"), color: Colors.chocolate },
    cake:      { short: t("deptCakeShort"),      color: Colors.cake },
    packaging: { short: t("deptPackagingShort"), color: Colors.packaging },
  }), [t]);

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
        <Text style={[ct.emptyTxt, { color: subColor }]}>{t("orderTrackerEmpty")}</Text>
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
          <View key={order.id} style={[ct.card, { backgroundColor: cardBg, borderColor: allDone ? Colors.statusDone + "40" : cardBorder }]}>
            {allDone && <View style={ct.doneLine} />}
            <View style={ct.cardHead}>
              <Text style={[ct.orderNum, { color: allDone ? DONE_C : textColor }]}>#{order.orderNumber}</Text>
              <Text style={[ct.custName, { color: textColor }]} numberOfLines={1}>{order.customerName}</Text>
              <View style={[ct.statusBadge, {
                backgroundColor: allDone ? DONE_C + "18" : anyInProg ? PROG_C + "18" : WAIT_C + "18",
              }]}>
                <View style={[ct.statusDot, { backgroundColor: allDone ? DONE_C : anyInProg ? PROG_C : WAIT_C }]} />
                <Text style={[ct.statusTxt, { color: allDone ? DONE_C : anyInProg ? PROG_C : WAIT_C }]}>
                  {allDone ? t("statusReady") : anyInProg ? t("statusPrepping") : t("statusWaiting")}
                </Text>
              </View>
            </View>
            <View style={ct.chips}>
              {depts.map(d => {
                const status = order.departmentStatuses?.[d] ?? "pending";
                const col = STATUS_COLORS[status] ?? Colors.textSecondary;
                const dm = deptMeta[d];
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

const ROLE_COLOR: Record<string, string> = {
  cashier: Colors.gold, admin: Colors.purple, branch_supervisor: Colors.success,
  dept_supervisor: Colors.info, halwa: Colors.halwa, mawali: Colors.mawali,
  chocolate: Colors.chocolate, cake: Colors.cake, packaging: Colors.packaging,
};

// ── Module definitions (labels computed at runtime) ─────────────────────────────
type ModuleDef = {
  route: string;
  icon: string;
  accent: string;
  labelKey: TranslationKey;
  capKey?: TranslationKey;
  group: "ops" | "dept" | "admin";
  primary?: boolean;
};

const MODULE_DEFS: ModuleDef[] = [
  { route: "cashier",   icon: "file-text",   accent: Colors.gold,     labelKey: "homeTileCashier",    capKey: "homeCapCashier",  group: "ops", primary: true },
  { route: "archive",   icon: "archive",     accent: Colors.info,     labelKey: "tabArchive",         capKey: "homeCapArchive",  group: "ops" },
  { route: "reports",   icon: "bar-chart-2", accent: Colors.purple,   labelKey: "tabReports",         capKey: "homeCapReports",  group: "ops" },
  { route: "online",    icon: "globe",       accent: Colors.info,     labelKey: "tabOnline",          capKey: "homeCapOnline",   group: "ops" },
  { route: "driver",    icon: "truck",       accent: Colors.success,  labelKey: "tabMyDeliveries",    capKey: "homeCapDriver",   group: "ops" },
  { route: "tracking",  icon: "navigation",  accent: Colors.gold,     labelKey: "tabTracking",        capKey: "homeCapTracking", group: "ops" },
  { route: "delivery",  icon: "truck",       accent: Colors.success,  labelKey: "tabDelivery",        capKey: "homeCapDelivery", group: "ops" },
  { route: "halwa",     icon: "coffee",      accent: Colors.halwa,    labelKey: "deptHalwaShort",     group: "dept" },
  { route: "mawali",    icon: "package",     accent: Colors.mawali,   labelKey: "deptMawaliShort",    group: "dept" },
  { route: "chocolate", icon: "gift",        accent: Colors.chocolate,labelKey: "deptChocolateShort", group: "dept" },
  { route: "cake",      icon: "layers",      accent: Colors.cake,     labelKey: "deptCakeShort",      group: "dept" },
  { route: "writing",   icon: "edit-3",      accent: Colors.purple,   labelKey: "tabWriting",         group: "dept" },
  { route: "packaging", icon: "box",         accent: Colors.packaging,labelKey: "deptPackagingShort", group: "dept" },
  { route: "admin",     icon: "settings",    accent: Colors.primary,  labelKey: "tabAdmin",           capKey: "homeCapAdmin",    group: "admin" },
];

// ── Pressable with a soft spring scale ─────────────────────────────────────────
function PressScale({ onPress, style, children }: { onPress: () => void; style?: any; children: React.ReactNode }) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 60, bounciness: 4 }).start();
  return (
    <Animated.View style={[style, { transform: [{ scale: sc }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        style={{ flex: 1 }}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ── Operations card (icon + title + caption) ───────────────────────────────────
function OpsCard({ label, caption, icon, accent, primary, width, onPress }: {
  label: string; caption?: string; icon: string; accent: string; primary?: boolean; width: number; onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} style={{ width }}>
      <View style={[m.opsCard, primary && m.opsCardPrimary]}>
        <View style={[m.opsIcon, { backgroundColor: primary ? "rgba(217,192,143,0.16)" : accent + "14" }]}>
          <Feather name={icon as any} size={20} color={primary ? Colors.goldLight : accent} />
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[m.opsLabel, primary && { color: "#fff" }]} numberOfLines={1}>{label}</Text>
          {!!caption && (
            <Text style={[m.opsCap, primary && { color: "rgba(255,255,255,0.55)" }]} numberOfLines={1}>{caption}</Text>
          )}
        </View>
      </View>
    </PressScale>
  );
}

// ── Department card with live queue count ──────────────────────────────────────
function DeptCard({ label, icon, accent, queue, queueLabel, active, width, onPress, queueTxt, clearTxt }: {
  label: string; icon: string; accent: string; queue: number; queueLabel: string; active: number; width: number;
  onPress: () => void; queueTxt: string; clearTxt: string;
}) {
  const busy = queue > 0;
  return (
    <PressScale onPress={onPress} style={{ width }}>
      <View style={[m.deptCard, busy && { borderColor: accent + "55" }]}>
        <View style={[m.deptStrip, { backgroundColor: accent }]} />
        <View style={m.deptTop}>
          <View style={[m.deptIcon, { backgroundColor: accent + "16" }]}>
            <Feather name={icon as any} size={18} color={accent} />
          </View>
          {busy && (
            <View style={[m.deptCount, { backgroundColor: accent }]}>
              <Text style={m.deptCountTxt}>{queueLabel}</Text>
            </View>
          )}
        </View>
        <Text style={m.deptLabel} numberOfLines={1}>{label}</Text>
        <View style={m.deptStatusRow}>
          <View style={[m.deptDot, { backgroundColor: busy ? (active > 0 ? Colors.statusInProgress : Colors.statusPending) : Colors.statusDone }]} />
          <Text style={m.deptStatus} numberOfLines={1}>{busy ? queueTxt : clearTxt}</Text>
        </View>
      </View>
    </PressScale>
  );
}

// ── Admin row ──────────────────────────────────────────────────────────────────
function AdminRow({ label, caption, badge, isRTL, onPress }: { label: string; caption: string; badge?: number; isRTL: boolean; onPress: () => void }) {
  return (
    <PressScale onPress={onPress}>
      <View style={m.adminRow}>
        <View style={[m.opsIcon, { backgroundColor: Colors.primary + "12" }]}>
          <Feather name="settings" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={m.opsLabel}>{label}</Text>
          <Text style={m.opsCap} numberOfLines={1}>{caption}</Text>
        </View>
        {!!badge && (
          <View style={m.adminBadge}><Text style={m.adminBadgeTxt}>{badge > 99 ? "99+" : badge}</Text></View>
        )}
        <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={Colors.textMuted} />
      </View>
    </PressScale>
  );
}

function SectionTitle({ title, right }: { title: string; right?: string }) {
  return (
    <View style={m.secHead}>
      <Text style={m.secTitle}>{title}</Text>
      {!!right && <Text style={m.secRight}>{right}</Text>}
    </View>
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

  const { t, rl, isRTL, lang } = useLang();
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
  const todayStr = now.toDateString();

  const todayOrders   = useMemo(() => orders.filter(o => !o.deleted && new Date(o.createdAt).toDateString() === todayStr), [orders, todayStr]);
  const todayRevenue  = useMemo(() => todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0), [todayOrders]);
  const pendingCnt    = useMemo(() => todayOrders.filter(o => overallStatus(o) === "pending").length,     [todayOrders]);
  const inProgressCnt = useMemo(() => todayOrders.filter(o => overallStatus(o) === "in_progress").length, [todayOrders]);
  const doneCnt       = useMemo(() => todayOrders.filter(o => overallStatus(o) === "done").length,        [todayOrders]);

  // Live queue per department (pending + in progress)
  const deptQueues = useMemo(() => {
    const out = {} as Record<Department, { queue: number; active: number }>;
    DEPARTMENTS.forEach(d => { out[d] = { queue: 0, active: 0 }; });
    todayOrders.forEach(o => {
      DEPARTMENTS.forEach(d => {
        if (!o.items?.some(i => i.department === d)) return;
        const st = o.departmentStatuses?.[d] ?? "pending";
        if (st === "pending" || st === "in_progress") out[d].queue += 1;
        if (st === "in_progress") out[d].active += 1;
      });
    });
    return out;
  }, [todayOrders]);

  const writingQueue = useMemo(() => {
    const open = todayOrders.filter(o => o.items?.some(i => i.writing?.text?.trim()) && (o.writingStatus ?? "pending") !== "done");
    return { queue: open.length, active: open.filter(o => o.writingStatus === "in_progress").length };
  }, [todayOrders]);

  // Role-based module visibility (same rules as before)
  const role = currentEmployee?.role;
  // Sales figures are for management and the cashier only.
  const canSeeMoney = !role || ["admin", "branch_supervisor", "cashier"].includes(role);
  const isCashierRole = role === "cashier";
  const visible = useMemo(() => {
    const base = MODULE_DEFS.filter(d => d.group !== "admin" && d.route !== "driver");
    if (!role || role === "admin" || role === "branch_supervisor" || role === "dept_supervisor") {
      return isAdmin ? MODULE_DEFS : base;
    }
    if (role === "cashier") return base.filter(d => ["cashier", "online", "tracking", "delivery", "archive"].includes(d.route));
    if (role === "driver") return MODULE_DEFS.filter(d => d.route === "driver");
    const own = role === "calligrapher" ? "writing" : role;
    return base.filter(d => d.route === own || (role === "cake" && d.route === "writing"));
  }, [role, isAdmin]);

  const opsMods   = visible.filter(d => d.group === "ops");
  const deptMods  = visible.filter(d => d.group === "dept");
  const adminMod  = visible.find(d => d.group === "admin");
  const canInvoice = visible.some(d => d.route === "cashier");

  const go = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  // Layout math
  const SIDEBAR_W = winW >= 768 ? 220 : 0;
  const INFO_W    = isWide ? 300 : 0;
  const PAD       = isWide ? 28 : 16;
  const GAP       = isWide ? 14 : 10;
  const contentW  = Math.min(winW - SIDEBAR_W - INFO_W, 1100) - PAD * 2;
  const colW = (cols: number) => Math.floor((contentW - GAP * (cols - 1)) / cols);
  const opsCols  = isWide ? Math.min(5, Math.max(opsMods.length, 1)) : (opsMods.length === 1 ? 1 : 2);
  const deptCols = isWide ? 6 : 3;

  const empColor = ROLE_COLOR[currentEmployee?.role ?? ""] ?? Colors.gold;
  const greeting = now.getHours() < 12 ? t("homeGreetMorning") : t("homeGreetEvening");
  const firstName = currentEmployee?.name;
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const fmtNum = (n: number) => n.toLocaleString(locale);
  const total = Math.max(todayOrders.length, 1);

  const fmtNow = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
  const fmtDay = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  // ── Shared blocks ────────────────────────────────────────────────────────────
  const heroCard = (
    <LinearGradient colors={[Colors.espressoMid, Colors.espressoDeep]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={m.hero}>
      <View style={m.heroAccent} />
      <View style={m.heroTop}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={m.heroGreet} numberOfLines={1}>
            {greeting}{firstName ? `${isRTL ? "،" : ","} ${firstName}` : ""}
          </Text>
          <Text style={m.heroDate}>{fmtDay}</Text>
        </View>
        <View style={m.heroClock}>
          <Feather name="clock" size={12} color={Colors.goldLight} />
          <Text style={m.heroClockTxt}>{fmtNow}</Text>
        </View>
      </View>

      <View style={m.heroMid}>
        {canSeeMoney ? (
        <View style={{ gap: 2 }}>
          <Text style={m.heroLbl}>{t("revenueToday")}</Text>
          <Text style={m.heroRevenue}>
            {fmtNum(todayRevenue)} <Text style={m.heroCur}>{t("sarCurrency")}</Text>
          </Text>
        </View>
        ) : <View />}
        <View style={m.heroOrders}>
          <Text style={m.heroOrdersNum}>{fmtNum(todayOrders.length)}</Text>
          <Text style={m.heroLbl}>{t("homeOrdersToday")}</Text>
        </View>
      </View>

      {/* Segmented progress */}
      <View style={m.progress}>
        {todayOrders.length === 0 ? (
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
        ) : (
          <>
            {doneCnt > 0       && <View style={{ flex: doneCnt / total,       backgroundColor: HERO_DONE }} />}
            {inProgressCnt > 0 && <View style={{ flex: inProgressCnt / total, backgroundColor: HERO_PROG }} />}
            {pendingCnt > 0    && <View style={{ flex: pendingCnt / total,    backgroundColor: HERO_WAIT }} />}
          </>
        )}
      </View>

      <View style={m.heroStats}>
        {[
          { n: pendingCnt,    l: t("statusWaiting"),   c: HERO_WAIT },
          { n: inProgressCnt, l: t("inProgressShort"), c: HERO_PROG },
          { n: doneCnt,       l: t("statusReady"),     c: HERO_DONE },
        ].map(x => (
          <View key={x.l} style={m.heroStat}>
            <View style={[m.heroStatDot, { backgroundColor: x.c }]} />
            <Text style={[m.heroStatNum, { color: x.c }]}>{fmtNum(x.n)}</Text>
            <Text style={m.heroStatLbl}>{x.l}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );

  const ctaButton = canInvoice && (
    <PressScale onPress={() => go("cashier")}>
      <LinearGradient colors={[Colors.gold, Colors.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={m.cta}>
        <View style={m.ctaIcon}><Feather name="plus" size={20} color={Colors.gold} /></View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={m.ctaTxt}>{t("newInvoice")}</Text>
          <Text style={m.ctaSub}>{t("homeNewInvoiceSub")}</Text>
        </View>
        <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={20} color="#fff" />
      </LinearGradient>
    </PressScale>
  );

  const modules = (
    <View style={{ gap: 22 }}>
      {opsMods.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionTitle title={t("homeSecOperations")} />
          <View style={[m.grid, { gap: GAP }]}>
            {opsMods.map(d => (
              <OpsCard
                key={d.route}
                label={t(d.labelKey)}
                caption={d.capKey ? t(d.capKey) : undefined}
                icon={d.icon}
                accent={d.accent}
                primary={d.primary}
                width={!isWide && d.primary && opsMods.length % 2 === 1 ? contentW : colW(opsCols)}
                onPress={() => go(d.route)}
              />
            ))}
          </View>
        </View>
      )}

      {deptMods.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionTitle
            title={t("homeSecDepartments")}
            right={`${fmtNum(DEPARTMENTS.reduce((s, d) => s + deptQueues[d].queue, 0))} ${t("homeDeptQueue")}`}
          />
          <View style={[m.grid, { gap: GAP }]}>
            {deptMods.map(d => {
              const q = d.route === "writing" ? writingQueue : (deptQueues[d.route as Department] ?? { queue: 0, active: 0 });
              return (
                <DeptCard
                  key={d.route}
                  label={t(d.labelKey)}
                  icon={d.icon}
                  accent={d.accent}
                  queue={q.queue}
                  queueLabel={fmtNum(q.queue)}
                  active={q.active}
                  width={deptMods.length === 1 ? contentW : colW(deptCols)}
                  queueTxt={`${fmtNum(q.queue)} ${t("homeDeptQueue")}`}
                  clearTxt={t("homeDeptClear")}
                  onPress={() => go(d.route)}
                />
              );
            })}
          </View>
        </View>
      )}

      {adminMod && (
        <View style={{ gap: 10 }}>
          <SectionTitle title={t("homeSecManagement")} />
          <AdminRow
            label={t("tabAdmin")}
            caption={t("homeCapAdmin")}
            badge={pendingCount || undefined}
            isRTL={isRTL}
            onPress={() => go("admin")}
          />
        </View>
      )}
    </View>
  );

  // ── Wide layout ──────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={m.screen}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: PAD, gap: 18, maxWidth: 1100 + PAD * 2, width: "100%", alignSelf: "center" }} showsVerticalScrollIndicator={false}>
            {heroCard}
            <SyncStatusBanner />
            <AttentionBanner />
            {ctaButton}
            {modules}
          </ScrollView>

          {/* Info panel */}
          <LinearGradient colors={[Colors.espressoDeep, Colors.espressoMid, Colors.espressoSoft]} style={[s.infoPanel, { width: INFO_W }]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <ScrollView contentContainerStyle={s.infoPanelContent} showsVerticalScrollIndicator={false}>
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

              <LinearGradient colors={["transparent", Colors.gold + "80", "transparent"]} style={s.goldRule} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

              <View style={s.empSection}>
                <View style={s.liveRow}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>{t("onlineNow")}</Text>
                </View>
                {currentEmployee ? (
                  <View style={s.empCard}>
                    <View style={[s.empAvatar, { backgroundColor: empColor + "25", borderColor: empColor }]}>
                      <Text style={[s.empAvatarTxt, { color: empColor }]}>{currentEmployee.name.charAt(0)}</Text>
                    </View>
                    <View style={s.empInfo}>
                      <Text style={s.empName} numberOfLines={1}>{currentEmployee.name}</Text>
                      <View style={[s.empRoleBadge, { backgroundColor: empColor + "25" }]}>
                        <Text style={[s.empRoleTxt, { color: empColor }]}>{rl(currentEmployee.role)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={s.noEmp}>{t("noEmpLogged")}</Text>
                )}
              </View>

              <View style={s.statsSection}>
                <Text style={s.statsTitle}>{t("todayStatsTitle")}</Text>
                <View style={s.statsGrid}>
                  <StatCard label={t("total")}         value={todayOrders.length} color={Colors.gold} icon="list" />
                  <StatCard label={t("statusWaiting")} value={pendingCnt}         color={HERO_WAIT}     icon="clock" />
                  <StatCard label={t("inProgress")}    value={inProgressCnt}      color={HERO_PROG}     icon="zap" />
                  <StatCard label={t("statusReady")}   value={doneCnt}            color={HERO_DONE}     icon="check-circle" />
                </View>
              </View>

              {isCashierRole && (
                <View style={s.trackerSection}>
                  <Text style={s.trackerTitle}>{t("orderTrackerTitle")}</Text>
                  <CashierOrderTracker orders={todayOrders} isDark />
                </View>
              )}

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

  // ── Narrow (mobile) layout ───────────────────────────────────────────────────
  return (
    <View style={m.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: PAD, gap: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {heroCard}
        <SyncStatusBanner />
        <AttentionBanner />
        {ctaButton}

        {isCashierRole && (
          <View style={{ gap: 10 }}>
            <SectionTitle title={t("orderTrackerMobile")} />
            <CashierOrderTracker orders={todayOrders} isDark={false} />
          </View>
        )}

        {modules}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: Colors.primary,
  shadowOpacity: 0.04,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const m = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  grid:   { flexDirection: "row", flexWrap: "wrap" },

  // Hero
  hero:        { borderRadius: 24, padding: 20, gap: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  heroAccent:  { position: "absolute", top: 0, right: 24, width: 56, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: Colors.gold },
  heroTop:     { flexDirection: "row", alignItems: "center", gap: 12 },
  heroGreet:   { color: "#fff", fontSize: 19, fontWeight: "700", letterSpacing: -0.2 },
  heroDate:    { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  heroClock:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  heroClockTxt:{ color: "#fff", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums" as any] },
  heroMid:     { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  heroLbl:     { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600" },
  heroRevenue: { color: "#fff", fontSize: 34, fontWeight: "700", letterSpacing: -0.8, fontVariant: ["tabular-nums" as any] },
  heroCur:     { fontSize: 14, fontWeight: "600", color: Colors.goldLight, letterSpacing: 0 },
  heroOrders:  { alignItems: "center", gap: 2 },
  heroOrdersNum:{ color: "#fff", fontSize: 26, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums" as any] },
  progress:    { height: 4, borderRadius: 2, overflow: "hidden", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", gap: 2 },
  heroStats:   { flexDirection: "row", gap: 8 },
  heroStat:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  heroStatDot: { width: 6, height: 6, borderRadius: 3 },
  heroStatNum: { fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  heroStatLbl: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", flexShrink: 1 },

  // CTA
  cta:     { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 16, ...CARD_SHADOW, shadowColor: Colors.gold, shadowOpacity: 0.22 },
  ctaIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  ctaTxt:  { color: "#fff", fontSize: 16, fontWeight: "700" },
  ctaSub:  { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "500" },

  // Section heading
  secHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  secTitle: { color: Colors.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  secRight: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },

  // Ops cards
  opsCard:        { backgroundColor: Colors.surface, borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: Colors.borderLight, ...CARD_SHADOW },
  opsCardPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  opsIcon:        { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  opsLabel:       { color: Colors.text, fontSize: 14, fontWeight: "700" },
  opsCap:         { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },

  // Dept cards
  deptCard:      { backgroundColor: Colors.surface, borderRadius: 18, padding: 12, paddingTop: 14, gap: 8, borderWidth: 1, borderColor: Colors.borderLight, overflow: "hidden", ...CARD_SHADOW },
  deptStrip:     { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  deptTop:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  deptIcon:      { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  deptCount:     { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  deptCountTxt:  { color: "#fff", fontSize: 11, fontWeight: "900" },
  deptLabel:     { color: Colors.text, fontSize: 13, fontWeight: "700" },
  deptStatusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  deptDot:       { width: 6, height: 6, borderRadius: 3 },
  deptStatus:    { color: Colors.textSecondary, fontSize: 10.5, fontWeight: "600", flexShrink: 1 },

  // Admin row
  adminRow:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: Colors.borderLight, ...CARD_SHADOW },
  adminBadge:    { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  adminBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "900" },
});

// Wide-layout info panel styles (unchanged look)
const s = StyleSheet.create({
  infoPanel:        { flexShrink: 0, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.06)" },
  infoPanelContent: { padding: 22, gap: 18 },
  laviWrap:     { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  laviLogo:     { width: 190, height: 72 },
  brandWrap:    { alignItems: "center", gap: 10, paddingTop: 8 },
  brandBadge:   { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  brandBadgeTxt:{ fontSize: 26, fontWeight: "900", color: Colors.primary },
  brandName:    { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" },
  goldRule:     { height: 1, borderRadius: 1 },
  empSection:   { gap: 10 },
  liveRow:      { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: HERO_DONE },
  liveTxt:      { color: HERO_DONE, fontSize: 11, fontWeight: "700" },
  empCard:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  empAvatar:    { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  empAvatarTxt: { fontSize: 18, fontWeight: "900" },
  empInfo:      { flex: 1, gap: 4 },
  empName:      { color: "#fff", fontSize: 14, fontWeight: "700" },
  empRoleBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  empRoleTxt:   { fontSize: 10, fontWeight: "700" },
  noEmp:        { color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic" },
  statsSection: { gap: 8 },
  statsTitle:   { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trackerSection:{ gap: 10 },
  trackerTitle: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  clockSection: { alignItems: "center", gap: 4 },
  clockTime:    { color: "#fff", fontSize: 36, fontWeight: "900", fontVariant: ["tabular-nums" as any], letterSpacing: 1 },
  clockSecs:    { color: "rgba(255,255,255,0.35)", fontSize: 13, fontVariant: ["tabular-nums" as any] },
  clockDate:    { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
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
  doneLine:    { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.statusDone },
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
