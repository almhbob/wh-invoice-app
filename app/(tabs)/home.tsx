import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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

function fmtClock(d: Date, locale: string) {
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtSecs(d: Date, locale: string) {
  return d.toLocaleTimeString(locale, { second: "2-digit", hour12: false });
}
function fmtDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

// ── Dept meta for cashier tracker (built at runtime with t()) ──────────────────
const DEPT_COLORS = {
  halwa: Colors.halwa, mawali: Colors.mawali, chocolate: Colors.chocolate,
  cake: Colors.cake, packaging: Colors.packaging,
} as const;

const STATUS_COLORS = {
  pending:     "#6B7280",
  in_progress: "#60A5FA",
  done:        "#34D399",
  cancelled:   "#F87171",
};

function CashierOrderTracker({ orders, isDark }: { orders: Order[]; isDark?: boolean }) {
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
                  {allDone ? t("statusReady") : anyInProg ? t("statusPrepping") : t("statusWaiting")}
                </Text>
              </View>
            </View>
            <View style={ct.chips}>
              {depts.map(d => {
                const status = order.departmentStatuses?.[d] ?? "pending";
                const col = STATUS_COLORS[status] ?? "#6B7280";
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
  cashier: Colors.gold, admin: "#7C3AED", branch_supervisor: "#0D9488",
  dept_supervisor: "#0891B2", halwa: Colors.halwa, mawali: Colors.mawali,
  chocolate: Colors.chocolate, cake: Colors.cake, packaging: Colors.packaging,
};

// ── Palette (warm ivory surface + ink text, gold brand accent) ─────────────────
const UI = {
  bg:      "#F5F2EC",
  card:    "#FFFFFF",
  line:    "#ECE6DB",
  ink:     "#1C1917",
  muted:   "#78716C",
  faint:   "#A8A29E",
  gold:    "#C9A84C",
  goldHi:  "#E8C96A",
  goldDeep:"#A9863A",
  pending: "#F59E0B",
  active:  "#60A5FA",
  done:    "#34D399",
};

const DATE_LOCALE: Record<string, string> = {
  ar: "ar-SA", en: "en-US", ur: "ur-PK", hi: "hi-IN", bn: "bn-BD",
};

// ── Card definitions (labels/captions computed at runtime) ─────────────────────
type CardKey = "tabCashier" | "tabArchive" | "tabReports" | "tabDelivery" | "tabAdmin"
  | "deptHalwaShort" | "deptMawaliShort" | "deptChocolateShort" | "deptCakeShort" | "deptPackagingShort";

const CARD_DEFS: { key: CardKey; icon: string; route: string; accent: string; group: "ops" | "prod" }[] = [
  { key: "tabCashier",         icon: "file-text",   route: "cashier",   accent: "#B8892B",         group: "ops"  },
  { key: "tabArchive",         icon: "archive",     route: "archive",   accent: "#2563EB",         group: "ops"  },
  { key: "tabReports",         icon: "bar-chart-2", route: "reports",   accent: "#7C3AED",         group: "ops"  },
  { key: "tabDelivery",        icon: "truck",       route: "delivery",  accent: "#0D9488",         group: "ops"  },
  { key: "deptHalwaShort",     icon: "coffee",      route: "halwa",     accent: Colors.halwa,      group: "prod" },
  { key: "deptMawaliShort",    icon: "package",     route: "mawali",    accent: Colors.mawali,     group: "prod" },
  { key: "deptChocolateShort", icon: "gift",        route: "chocolate", accent: Colors.chocolate,  group: "prod" },
  { key: "deptCakeShort",      icon: "layers",      route: "cake",      accent: Colors.cake,       group: "prod" },
  { key: "deptPackagingShort", icon: "box",         route: "packaging", accent: Colors.packaging,  group: "prod" },
];
const ADMIN_CARD = { key: "tabAdmin" as CardKey, icon: "settings", route: "admin", accent: "#475569", group: "ops" as const };

// ── Action card ────────────────────────────────────────────────────────────────

function ActionCard({ label, caption, captionActive, icon, accent, badge, width, isRTL, onPress }: {
  label: string; caption: string; captionActive?: boolean; icon: string; accent: string;
  badge?: number; width: number; isRTL: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ac.card, { width }, pressed && ac.cardPressed]}
    >
      <View style={ac.top}>
        <View style={[ac.iconBox, { backgroundColor: accent + "14" }]}>
          <Feather name={icon as any} size={20} color={accent} />
        </View>
        {badge ? (
          <View style={[ac.badge, { backgroundColor: Colors.accent }]}>
            <Text style={ac.badgeTxt}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : (
          <Feather name={isRTL ? "arrow-up-left" : "arrow-up-right"} size={16} color={UI.faint} />
        )}
      </View>
      <View style={{ gap: 3 }}>
        <Text style={ac.label} numberOfLines={1}>{label}</Text>
        <View style={ac.captionRow}>
          {captionActive && <View style={[ac.captionDot, { backgroundColor: accent }]} />}
          <Text style={[ac.caption, captionActive && { color: accent, fontWeight: "700" }]} numberOfLines={1}>
            {caption}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Primary CTA ────────────────────────────────────────────────────────────────

function NewInvoiceButton({ title, sub, isRTL, onPress }: { title: string; sub: string; isRTL: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cta.wrap, pressed && { transform: [{ scale: 0.98 }] }]}>
      <LinearGradient
        colors={[UI.goldHi, UI.gold, UI.goldDeep]}
        style={cta.inner}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={cta.iconCircle}>
          <Feather name="plus" size={22} color="#1A1206" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={cta.title}>{title}</Text>
          <Text style={cta.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#1A1206" />
      </LinearGradient>
    </Pressable>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {count !== undefined && (
        <View style={sh.countPill}><Text style={sh.countTxt}>{count}</Text></View>
      )}
      <View style={sh.line} />
    </View>
  );
}

// ── Stat card (wide info panel) ────────────────────────────────────────────────

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

  const { t, rl, lang, isRTL } = useLang();
  const { company }         = useCompany();
  const { currentEmployee } = useEmployee();
  const { orders }          = useOrders();
  const { pendingCount }    = usePriceChange();

  const locale = DATE_LOCALE[lang] ?? "ar-SA";

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isAdmin  = canDo(currentEmployee?.role, ROLE_CAN_ACCESS_ADMIN);
  const isLavi   = company.id === LAVIVIANE_COMPANY_ID;
  const todayStr = useMemo(() => new Date().toDateString(), []);

  const todayOrders   = useMemo(() => orders.filter(o => !o.deleted && new Date(o.createdAt).toDateString() === todayStr), [orders, todayStr]);
  const todayRevenue  = useMemo(() => todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0), [todayOrders]);
  const pendingCnt    = useMemo(() => todayOrders.filter(o => overallStatus(o) === "pending").length,     [todayOrders]);
  const inProgressCnt = useMemo(() => todayOrders.filter(o => overallStatus(o) === "in_progress").length, [todayOrders]);
  const doneCnt       = useMemo(() => todayOrders.filter(o => overallStatus(o) === "done").length,        [todayOrders]);

  // Active (not done / cancelled) orders per production department
  const deptActive = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of DEPARTMENTS) {
      out[d] = todayOrders.filter(o => {
        if (!o.items.some(i => i.department === d)) return false;
        const st = o.departmentStatuses?.[d] ?? "pending";
        return st === "pending" || st === "in_progress";
      }).length;
    }
    return out;
  }, [todayOrders]);

  const role = currentEmployee?.role;
  const isCashierRole = role === "cashier";

  const cards = useMemo(() => {
    let defs = CARD_DEFS;
    if (!role || role === "admin" || role === "branch_supervisor" || role === "dept_supervisor") {
      defs = isAdmin ? [...CARD_DEFS, ADMIN_CARD] : CARD_DEFS;
    } else if (role === "cashier") {
      defs = CARD_DEFS.filter(c => ["cashier", "archive", "delivery"].includes(c.route));
    } else {
      // Dept workers: only their own dept card
      defs = CARD_DEFS.filter(c => c.route === role);
    }
    return defs.map(c => {
      const active = deptActive[c.route];
      let caption: string;
      let captionActive = false;
      if (c.group === "prod") {
        captionActive = active > 0;
        caption = active > 0 ? t("homeDeptActive").replace("{n}", String(active)) : t("homeDeptClear");
      } else if (c.route === "cashier")  caption = t("homeCapCashier");
      else if (c.route === "archive")    caption = t("homeCapArchive").replace("{n}", String(todayOrders.length));
      else if (c.route === "reports")    caption = t("homeCapReports");
      else if (c.route === "delivery")   caption = t("homeCapDelivery");
      else                               caption = t("homeCapAdmin");
      return { ...c, label: t(c.key), caption, captionActive };
    });
  }, [role, isAdmin, t, deptActive, todayOrders.length]);

  const opsCards  = cards.filter(c => c.group === "ops");
  const prodCards = cards.filter(c => c.group === "prod");
  const prodActiveTotal = prodCards.reduce((s, c) => s + (deptActive[c.route] ?? 0), 0);

  const go = (route: string) => router.navigate(`/(tabs)/${route}` as any);

  // Responsive card grid
  const SIDEBAR_W = winW >= 768 ? 220 : 0;
  const INFO_W    = isWide ? 280 : 0;
  const GAP       = isWide ? 14 : 12;
  const PAD       = isWide ? 28 : 16;
  const contentW  = winW - SIDEBAR_W - INFO_W - PAD * 2;
  const cols      = contentW >= 760 ? 4 : contentW >= 420 ? 3 : 2;
  const cardW     = Math.floor((contentW - GAP * (cols - 1)) / cols);

  const empColor = ROLE_COLOR[currentEmployee?.role ?? ""] ?? Colors.gold;
  const greeting = now.getHours() < 12 ? t("greetMorning") : t("greetEvening");
  const fmtMoney = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });

  const renderCards = (list: typeof cards) => (
    <View style={[s.grid, { gap: GAP }]}>
      {list.map(c => (
        <ActionCard
          key={c.route}
          label={c.label}
          caption={c.caption}
          captionActive={c.captionActive}
          icon={c.icon}
          accent={c.accent}
          badge={c.route === "admin" ? pendingCount || undefined : undefined}
          width={cardW}
          isRTL={isRTL}
          onPress={() => go(c.route)}
        />
      ))}
    </View>
  );

  const sections = (
    <>
      {opsCards.length > 0 && (
        <View style={s.section}>
          <SectionHeader title={t("homeOperations")} />
          {renderCards(opsCards)}
        </View>
      )}
      {prodCards.length > 0 && (
        <View style={s.section}>
          <SectionHeader title={t("homeProduction")} count={prodActiveTotal || undefined} />
          {renderCards(prodCards)}
        </View>
      )}
    </>
  );

  // ── Wide layout ──────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={s.screen}>
        <View style={s.wideLayout}>

          {/* ── Card grid (main area) ──────────────────────────────────────── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: PAD, gap: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.wideHead}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.wideGreeting}>
                  {greeting}{currentEmployee ? `، ${currentEmployee.name}` : ""}
                </Text>
                <Text style={s.wideDate}>{fmtDate(now, locale)}</Text>
              </View>
            </View>

            <NewInvoiceButton title={t("newInvoice")} sub={t("newInvoiceSub")} isRTL={isRTL} onPress={() => go("cashier")} />

            {sections}
          </ScrollView>

          {/* ── Info panel ────────────────────────────────────────────────── */}
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
                        <Text style={[s.empRoleTxt, { color: empColor }]}>
                          {rl(currentEmployee.role)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={s.noEmp}>{t("noEmpLogged")}</Text>
                )}
              </View>

              {/* Stats grid */}
              <View style={s.statsSection}>
                <Text style={s.statsTitle}>{t("todayStatsTitle")}</Text>
                <View style={s.statsGrid}>
                  <StatCard label={t("total")}        value={todayOrders.length} color={Colors.gold}  icon="list" />
                  <StatCard label={t("statusWaiting")} value={pendingCnt}         color={UI.pending}    icon="clock" />
                  <StatCard label={t("inProgress")}    value={inProgressCnt}      color={UI.active}     icon="zap" />
                  <StatCard label={t("statusReady")}   value={doneCnt}            color={UI.done}       icon="check-circle" />
                </View>
              </View>

              {/* Revenue */}
              <View style={s.revenueSection}>
                <Text style={s.revenueLabel}>{t("revenueToday")}</Text>
                <Text style={s.revenueValue}>
                  {fmtMoney(todayRevenue)} <Text style={s.revenueCur}>{t("sarCurrency")}</Text>
                </Text>
              </View>

              <View style={s.thinRule} />

              {/* Cashier order tracker */}
              {isCashierRole && (
                <View style={s.trackerSection}>
                  <Text style={s.trackerTitle}>{t("orderTrackerTitle")}</Text>
                  <CashierOrderTracker orders={todayOrders} isDark />
                </View>
              )}

              {/* Clock */}
              <View style={s.clockSection}>
                <Text style={s.clockTime}>{fmtClock(now, locale)}</Text>
                <Text style={s.clockSecs}>{fmtSecs(now, locale)}</Text>
                <Text style={s.clockDate}>{fmtDate(now, locale)}</Text>
              </View>

            </ScrollView>
          </LinearGradient>

        </View>
      </View>
    );
  }

  // ── Narrow layout ─────────────────────────────────────────────────────────
  const flowTotal = pendingCnt + inProgressCnt + doneCnt;
  const heroColors = (isLavi ? ["#3A2C22", "#2F241D", "#1C1511"] : ["#24365E", "#1A2744", "#0F1A2E"]) as [string, string, string];
  const stats = [
    { num: todayOrders.length, lbl: t("todayShort"),      color: UI.goldHi  },
    { num: pendingCnt,          lbl: t("statusWaiting"),   color: UI.pending },
    { num: inProgressCnt,       lbl: t("inProgressShort"), color: UI.active  },
    { num: doneCnt,             lbl: t("statusReady"),     color: UI.done    },
  ];

  return (
    <View style={s.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: PAD, gap: 22, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: greeting, revenue, live flow ─────────────────────────── */}
        <LinearGradient colors={heroColors} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {/* decorative glow */}
          <View style={s.heroGlow} pointerEvents="none" />

          <View style={s.heroTop}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.heroGreeting} numberOfLines={1}>
                {greeting}{currentEmployee ? `، ${currentEmployee.name}` : ""}
              </Text>
              <Text style={s.heroDate}>{fmtDate(now, locale)}</Text>
            </View>
            <View style={s.clockPill}>
              <View style={s.liveDot} />
              <Text style={s.clockPillTxt}>{fmtClock(now, locale)}</Text>
            </View>
          </View>

          <View style={{ gap: 2 }}>
            <Text style={s.heroLabel}>{t("revenueToday")}</Text>
            <Text style={s.heroRevenue}>
              {fmtMoney(todayRevenue)}
              <Text style={s.heroCur}>  {t("sarCurrency")}</Text>
            </Text>
          </View>

          {/* Order flow bar */}
          <View style={s.flowTrack}>
            {flowTotal > 0 ? (
              <>
                {pendingCnt    > 0 && <View style={{ flex: pendingCnt,    backgroundColor: UI.pending }} />}
                {inProgressCnt > 0 && <View style={{ flex: inProgressCnt, backgroundColor: UI.active  }} />}
                {doneCnt       > 0 && <View style={{ flex: doneCnt,       backgroundColor: UI.done    }} />}
              </>
            ) : null}
          </View>

          <View style={s.heroStats}>
            {stats.map(item => (
              <View key={item.lbl} style={s.heroStat}>
                <Text style={[s.heroStatNum, { color: item.color }]}>{item.num}</Text>
                <View style={s.heroStatLblRow}>
                  <View style={[s.heroStatDot, { backgroundColor: item.color }]} />
                  <Text style={s.heroStatLbl} numberOfLines={1}>{item.lbl}</Text>
                </View>
              </View>
            ))}
          </View>

          <NewInvoiceButton title={t("newInvoice")} sub={t("newInvoiceSub")} isRTL={isRTL} onPress={() => go("cashier")} />
        </LinearGradient>

        {/* Cashier order tracker — mobile */}
        {isCashierRole && (
          <View style={s.section}>
            <SectionHeader title={t("orderTrackerMobile")} count={todayOrders.length || undefined} />
            <CashierOrderTracker orders={todayOrders} isDark={false} />
          </View>
        )}

        {sections}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const softShadow = {
  shadowColor: "#3B2F1E",
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: UI.bg },
  wideLayout:  { flex: 1, flexDirection: "row" },

  section:     { gap: 12 },
  grid:        { flexDirection: "row", flexWrap: "wrap" },

  // Wide header
  wideHead:     { flexDirection: "row", alignItems: "flex-end" },
  wideGreeting: { color: UI.ink, fontSize: 24, fontWeight: "900" },
  wideDate:     { color: UI.muted, fontSize: 13, fontWeight: "600" },

  // Hero (narrow)
  hero:         { borderRadius: 26, padding: 18, gap: 16, overflow: "hidden", ...softShadow, shadowOpacity: 0.18 },
  heroGlow:     { position: "absolute", top: -90, end: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(232,201,106,0.12)" },
  heroTop:      { flexDirection: "row", alignItems: "center", gap: 12 },
  heroGreeting: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  heroDate:     { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  clockPill:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  clockPillTxt: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums" as any] },
  heroLabel:    { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" },
  heroRevenue:  { color: UI.goldHi, fontSize: 34, fontWeight: "900", fontVariant: ["tabular-nums" as any], letterSpacing: 0.5 },
  heroCur:      { color: "rgba(232,201,106,0.7)", fontSize: 14, fontWeight: "700" },
  flowTrack:    { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", gap: 2 },
  heroStats:    { flexDirection: "row", gap: 8 },
  heroStat:     { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", gap: 4 },
  heroStatNum:  { fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums" as any] },
  heroStatLblRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroStatDot:  { width: 5, height: 5, borderRadius: 3 },
  heroStatLbl:  { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700" },

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
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34D399" },
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

  // Cashier tracker — desktop info panel
  trackerSection:  { gap: 10 },
  trackerTitle:    { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});

const ac = StyleSheet.create({
  card:        { backgroundColor: UI.card, borderRadius: 20, padding: 14, gap: 14, borderWidth: 1, borderColor: UI.line, ...softShadow },
  cardPressed: { transform: [{ scale: 0.97 }], backgroundColor: "#FBF9F5" },
  top:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  iconBox:     { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  badge:       { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeTxt:    { color: "#fff", fontSize: 11, fontWeight: "900" },
  label:       { color: UI.ink, fontSize: 15, fontWeight: "800" },
  captionRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  captionDot:  { width: 6, height: 6, borderRadius: 3 },
  caption:     { color: UI.muted, fontSize: 12, fontWeight: "500", flexShrink: 1 },
});

const cta = StyleSheet.create({
  wrap:       { borderRadius: 18, overflow: "hidden", shadowColor: UI.goldDeep, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  inner:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  title:      { color: "#1A1206", fontSize: 16, fontWeight: "900" },
  sub:        { color: "rgba(26,18,6,0.65)", fontSize: 12, fontWeight: "600" },
});

const sh = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: 8 },
  title:    { color: UI.ink, fontSize: 16, fontWeight: "900" },
  countPill:{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: UI.ink, alignItems: "center", justifyContent: "center" },
  countTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  line:     { flex: 1, height: 1, backgroundColor: UI.line },
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
