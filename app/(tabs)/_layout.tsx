import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Tabs, useRouter, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmployeeSelectorModal } from "@/components/EmployeeSelectorModal";
import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
import { PLATFORM_OWNER } from "@/constants/platform";
import {
  canAccessDept, canDo,
  ROLE_CAN_ACCESS_ADMIN,
  ROLE_CAN_VIEW_ARCHIVE, ROLE_CAN_VIEW_BRANCH_FEATURES,
  ROLE_CAN_VIEW_CASHIER, ROLE_CAN_VIEW_CUSTOMERS,
  ROLE_CAN_VIEW_DELIVERY, ROLE_CAN_VIEW_REPORTS,
  ROLE_CAN_VIEW_TRAYS,
} from "@/constants/rbac";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import type { TranslationKey } from "@/constants/translations";

const ROLE_COLORS: Record<string, string> = {
  cashier: Colors.gold,
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
  admin: Colors.primaryLight,
  branch_supervisor: "#0d9488",
  dept_supervisor: "#0891b2",
  guest: Colors.textMuted,
};

const TENANT_BRANDS: Record<string, { name: string; subtitle: string; logoText: string; primary: string; accent: string }> = {
  [LAVIVIANE_COMPANY_ID]: {
    name: "Laviviane",
    subtitle: "Maison de Pâtisserie",
    logoText: "L",
    primary: "#2f241d",
    accent: "#d6b56d",
  },
  "select-company": {
    name: PLATFORM_OWNER.nameAr,
    subtitle: PLATFORM_OWNER.nameEn,
    logoText: "ف",
    primary: Colors.primary,
    accent: Colors.gold,
  },
};

interface LogoHeaderProps {
  titleKey: string;
  accentColor?: string;
  isDesktop?: boolean;
}

function FawtaraMark() {
  return (
    <View style={styles.fawtaraMark}>
      <View style={styles.markBlueStem} />
      <View style={styles.markBlueFoot} />
      <View style={styles.markGoldTop} />
      <View style={styles.markGoldMid} />
    </View>
  );
}

function LavivianeLogoMark({ small }: { small?: boolean }) {
  const w = small ? 36 : 112;
  const h = small ? 36 : 42;
  return (
    <Image
      source={{ uri: "/laviviane-logo.png" }}
      style={{ width: w, height: h, borderRadius: small ? 6 : 0 }}
      contentFit="contain"
    />
  );
}

function TenantLogoMark({ logoText, primary, accent, small }: { logoText: string; primary: string; accent: string; small?: boolean }) {
  if (logoText === "ف") return <FawtaraMark />;
  if (logoText === "L") return <LavivianeLogoMark small={small} />;
  return (
    <View style={[styles.tenantLogoMark, small && styles.tenantLogoMarkSmall, { borderColor: accent + "80", backgroundColor: primary }]}>
      <Text style={[styles.tenantLogoText, small && styles.tenantLogoTextSmall, { color: accent }]}>{logoText}</Text>
      <View style={[styles.tenantLogoLine, { backgroundColor: accent }]} />
    </View>
  );
}

function LogoHeader({ titleKey, accentColor, isDesktop }: LogoHeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 0 : insets.top;
  const { company } = useCompany();
  const { currentEmployee } = useEmployee();
  const { lang, toggleLang, t } = useLang();
  const [showSelector, setShowSelector] = useState(false);
  const isRTL = lang === "ar" || lang === "ur";
  const LANG_NEXT: Record<string, string> = { ar: "EN", en: "اردو", ur: "हि", hi: "বাং", bn: "ع" };
  const tenantBrand = TENANT_BRANDS[company.id] ?? {
    name: company.name || PLATFORM_OWNER.nameAr,
    subtitle: company.slug || PLATFORM_OWNER.nameEn,
    logoText: (company.name || PLATFORM_OWNER.nameAr).trim().charAt(0),
    primary: Colors.primary,
    accent: Colors.gold,
  };
  const isNamedTenant = company.id in TENANT_BRANDS;
  const isLaviviane = company.id === LAVIVIANE_COMPANY_ID;

  return (
    <>
      <View style={[styles.headerContainer, { paddingTop: topInset, backgroundColor: tenantBrand.primary }]}>
        <View style={[styles.headerInner, isRTL ? styles.rowRTL : styles.rowLTR]}>
          {!isDesktop && isLaviviane && (
            <View style={styles.laviLogoBox}>
              <Image source={{ uri: "/laviviane-logo.png" }} style={styles.laviLogoImg} contentFit="contain" />
            </View>
          )}
          {!isDesktop && !isLaviviane && (
            <View style={[styles.logoBox, { borderColor: tenantBrand.accent + "80" }]}>
              <TenantLogoMark logoText={tenantBrand.logoText} primary={tenantBrand.primary} accent={tenantBrand.accent} />
            </View>
          )}
          {!isDesktop && !isLaviviane && (
            <View style={styles.brandBlock}>
              <Text style={[styles.brandName, { color: tenantBrand.accent }]}>{tenantBrand.name}</Text>
              <Text style={styles.brandSub}>
                {isNamedTenant ? tenantBrand.subtitle : `${PLATFORM_OWNER.nameEn} · ${tenantBrand.subtitle}`}
              </Text>
            </View>
          )}
          {isDesktop && <View style={{ flex: 1 }} />}
          {!isDesktop && <View style={{ flex: 1 }} />}
          {!isDesktop && (
            <TouchableOpacity style={styles.langBtn} onPress={toggleLang} activeOpacity={0.75}>
              <Text style={styles.langBtnText}>{LANG_NEXT[lang] ?? "EN"}</Text>
            </TouchableOpacity>
          )}
          {!isDesktop && (
            <TouchableOpacity style={styles.empBtn} onPress={() => setShowSelector(true)} activeOpacity={0.8}>
              {currentEmployee ? (
                <>
                  <View style={[styles.empAvatar, { backgroundColor: ROLE_COLORS[currentEmployee.role] ?? Colors.primaryLight }]}>
                    <Text style={styles.empAvatarText}>{currentEmployee.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.empTextBlock}>
                    <Text style={styles.empName} numberOfLines={1}>{currentEmployee.name}</Text>
                    <Text style={styles.empId}>#{currentEmployee.employeeId}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Feather name="user" size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.loginText}>{t("loginBtn")}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <View style={[styles.screenBadge, { backgroundColor: accentColor ?? tenantBrand.accent }]}>
            <Text style={styles.screenBadgeText} numberOfLines={1}>{titleKey}</Text>
          </View>
        </View>
        <View style={[styles.goldLine, { backgroundColor: tenantBrand.accent }]} />
      </View>
      {!isDesktop && <EmployeeSelectorModal visible={showSelector} onClose={() => setShowSelector(false)} />}
    </>
  );
}

interface TabDef { name: string; labelKey: string; titleKey: string; icon: string; sf?: string; accent: string; }

const DEPT_TABS: TabDef[] = [
  { name: "halwa",     labelKey: "tabHalwa",     titleKey: "titleHalwa",     icon: "coffee",   sf: "cup.and.saucer",               accent: Colors.halwa },
  { name: "mawali",    labelKey: "tabMawali",     titleKey: "titleMawali",    icon: "package",  sf: "tray",                         accent: Colors.mawali },
  { name: "chocolate", labelKey: "tabChocolate",  titleKey: "titleChocolate", icon: "gift",     sf: "gift",                         accent: Colors.chocolate },
  { name: "cake",      labelKey: "tabCake",       titleKey: "titleCake",      icon: "layers",   sf: "birthday.cake",                accent: Colors.cake },
  { name: "packaging", labelKey: "tabPackaging",  titleKey: "titlePackaging", icon: "box",      sf: "shippingbox",                  accent: Colors.packaging },
];

const MORE_TABS: TabDef[] = [
  { name: "branch-orders",    labelKey: "tabBranchOrders",    titleKey: "titleBranchOrders",    icon: "clipboard",    sf: "list.clipboard",                   accent: Colors.gold },
  { name: "branch-inventory", labelKey: "tabBranchInventory", titleKey: "titleBranchInventory", icon: "bar-chart-2",  sf: "chart.bar",                        accent: "#2563eb" },
  { name: "branches",         labelKey: "tabBranches",        titleKey: "titleManageBranches",  icon: "git-branch",   sf: "building.2",                       accent: "#0d9488" },
  { name: "customers",        labelKey: "tabCustomers",       titleKey: "titleCustomers",       icon: "users",        sf: "person.2",                         accent: "#0891b2" },
  { name: "delivery",         labelKey: "tabDelivery",        titleKey: "titleDelivery",        icon: "truck",        sf: "shippingbox.and.arrow.backward",   accent: "#0d9488" },
  { name: "trays",            labelKey: "tabTrays",           titleKey: "titleTrays",           icon: "layers",       sf: "tray.2",                           accent: Colors.gold },
  { name: "admin",            labelKey: "tabAdmin",           titleKey: "titleAdmin",           icon: "settings",     sf: "gearshape",                        accent: Colors.primaryLight },
  { name: "settings",         labelKey: "الإعدادات",          titleKey: "الإعدادات",            icon: "sliders",      sf: "gearshape.2",                      accent: Colors.primary },
];

// ── Desktop sidebar ────────────────────────────────────────────────────────────

function SideNavItem({
  label, icon, active, accent, onPress, indent = false, expandable = false, expanded = false,
}: {
  label: string; icon: string; active: boolean; accent: string;
  onPress: () => void; indent?: boolean; expandable?: boolean; expanded?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[ds.navItem, indent && ds.navIndent, active && { backgroundColor: accent + "22" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {active && <View style={[ds.navActiveLine, { backgroundColor: accent }]} />}
      <Feather name={icon as any} size={indent ? 14 : 16} color={active ? accent : "rgba(255,255,255,0.5)"} />
      <Text style={[ds.navLabel, active && { color: accent, fontWeight: "700" }]} numberOfLines={1}>{label}</Text>
      {expandable && (
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={12} color="rgba(255,255,255,0.35)" />
      )}
    </TouchableOpacity>
  );
}

function DesktopSidebar({ activePath, navigate, isRTL }: { activePath: string; navigate: (name: string) => void; isRTL: boolean }) {
  const { t, lang, toggleLang } = useLang();
  const { company } = useCompany();
  const { currentEmployee } = useEmployee();
  const [showSelector, setShowSelector] = useState(false);
  const role = currentEmployee?.role;
  const hasRole = !!role;
  const showCashierNav = !hasRole || canDo(role, ROLE_CAN_VIEW_CASHIER);
  const showArchiveNav = !hasRole || canDo(role, ROLE_CAN_VIEW_ARCHIVE);
  const showReportsNav = !hasRole || canDo(role, ROLE_CAN_VIEW_REPORTS);
  const visibleDepts = !hasRole ? DEPT_TABS : DEPT_TABS.filter(d => canAccessDept(role, d.name));
  const visibleMore = (!hasRole ? MORE_TABS : MORE_TABS.filter(m => {
    if (["branch-orders", "branch-inventory", "branches"].includes(m.name)) return canDo(role, ROLE_CAN_VIEW_BRANCH_FEATURES);
    if (m.name === "customers") return canDo(role, ROLE_CAN_VIEW_CUSTOMERS);
    if (m.name === "delivery") return canDo(role, ROLE_CAN_VIEW_DELIVERY);
    if (m.name === "trays") return canDo(role, ROLE_CAN_VIEW_TRAYS);
    if (m.name === "admin") return canDo(role, ROLE_CAN_ACCESS_ADMIN);
    return true;
  }));

  const [showDepts, setShowDepts] = useState(() => visibleDepts.some(d => activePath.includes(d.name)));
  const [showMore, setShowMore]   = useState(() => visibleMore.some(m => activePath.includes(m.name)));

  const isHome    = activePath.includes("home") || activePath === "/" || activePath === "/(tabs)";
  const isCashier = activePath.includes("cashier");
  const isArchive = activePath.includes("archive");
  const isReports = activePath.includes("reports");
  const activeDept = visibleDepts.find(d => activePath.includes(d.name));
  const activeMore = visibleMore.find(m => activePath.includes(m.name));
  const isLaviviane = company.id === LAVIVIANE_COMPANY_ID;

  const tenantBrand = TENANT_BRANDS[company.id] ?? {
    name: company.name || PLATFORM_OWNER.nameAr,
    subtitle: company.slug || PLATFORM_OWNER.nameEn,
    logoText: (company.name || PLATFORM_OWNER.nameAr).trim().charAt(0),
    primary: Colors.primary,
    accent: Colors.gold,
  };

  const LANG_NEXT: Record<string, string> = { ar: "EN", en: "اردو", ur: "हि", hi: "বাং", bn: "ع" };

  const sideStyle = [
    ds.sidebar,
    { backgroundColor: tenantBrand.primary },
    isRTL
      ? { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.08)", borderRightWidth: 0 }
      : { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.08)" },
  ];

  return (
    <>
      <View style={sideStyle}>
        {/* Brand */}
        {isLaviviane ? (
          <View style={ds.laviBrand}>
            <Image source={{ uri: "/laviviane-logo.png" }} style={ds.laviSidebarLogo} contentFit="contain" />
          </View>
        ) : (
          <View style={[ds.brand, isRTL ? ds.rowRTL : ds.rowLTR]}>
            <TenantLogoMark logoText={tenantBrand.logoText} primary={tenantBrand.primary} accent={tenantBrand.accent} small />
            <View style={{ flex: 1 }}>
              <Text style={[ds.brandName, { color: tenantBrand.accent }]}>{tenantBrand.name}</Text>
              <Text style={ds.brandSub}>{tenantBrand.subtitle}</Text>
            </View>
          </View>
        )}
        <View style={ds.divider} />

        {/* Navigation */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          <SideNavItem label="الطلبات الحية" icon="activity" active={isHome} accent={Colors.gold} onPress={() => navigate("home")} />
          {showCashierNav && <SideNavItem label={t("tabCashier")} icon="file-text" active={isCashier} accent={Colors.gold} onPress={() => navigate("cashier")} />}

          {visibleDepts.length > 0 && (
            <SideNavItem
              label={t("tabDepts")} icon="grid"
              active={!!activeDept} accent={activeDept?.accent ?? Colors.textMuted}
              onPress={() => setShowDepts(v => !v)} expandable expanded={showDepts}
            />
          )}
          {showDepts && visibleDepts.map(tab => (
            <SideNavItem
              key={tab.name}
              label={t(tab.labelKey as TranslationKey)} icon={tab.icon}
              active={activePath.includes(tab.name)} accent={tab.accent}
              onPress={() => navigate(tab.name)} indent
            />
          ))}

          {showArchiveNav && <SideNavItem label={t("tabArchive")} icon="archive" active={isArchive} accent={Colors.primaryLight} onPress={() => navigate("archive")} />}
          {showReportsNav && <SideNavItem label={t("tabReports")} icon="pie-chart" active={isReports} accent="#8b5cf6" onPress={() => navigate("reports")} />}

          {visibleMore.length > 0 && (
            <SideNavItem
              label={t("tabMore")} icon="more-horizontal"
              active={!!activeMore} accent={activeMore?.accent ?? Colors.textMuted}
              onPress={() => setShowMore(v => !v)} expandable expanded={showMore}
            />
          )}
          {showMore && visibleMore.map(tab => (
            <SideNavItem
              key={tab.name}
              label={tab.labelKey.startsWith("tab") ? t(tab.labelKey as TranslationKey) : tab.labelKey}
              icon={tab.icon} active={activePath.includes(tab.name)} accent={tab.accent}
              onPress={() => navigate(tab.name)} indent
            />
          ))}

          <SideNavItem
            label="الإعدادات" icon="settings"
            active={activePath.includes("settings")} accent={Colors.primary}
            onPress={() => navigate("settings")}
          />
        </ScrollView>

        <View style={ds.divider} />

        {/* Employee */}
        <TouchableOpacity style={[ds.empRow, isRTL ? ds.rowRTL : ds.rowLTR]} onPress={() => setShowSelector(true)} activeOpacity={0.8}>
          {currentEmployee ? (
            <>
              <View style={[ds.empAvatar, { backgroundColor: ROLE_COLORS[currentEmployee.role] ?? Colors.primaryLight }]}>
                <Text style={ds.empAvatarText}>{currentEmployee.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ds.empName} numberOfLines={1}>{currentEmployee.name}</Text>
                <Text style={ds.empId}>#{currentEmployee.employeeId}</Text>
              </View>
              <Feather name="chevron-up" size={13} color="rgba(255,255,255,0.35)" />
            </>
          ) : (
            <>
              <Feather name="user" size={16} color="rgba(255,255,255,0.55)" />
              <Text style={ds.loginText}>{t("loginBtn")}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Language toggle */}
        <TouchableOpacity style={[ds.langRow, isRTL ? ds.rowRTL : ds.rowLTR]} onPress={toggleLang} activeOpacity={0.8}>
          <Feather name="globe" size={14} color="rgba(255,255,255,0.45)" />
          <Text style={ds.langLabel}>{LANG_NEXT[lang] ?? "EN"}</Text>
          <Text style={ds.langCurrent}>{lang.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <EmployeeSelectorModal visible={showSelector} onClose={() => setShowSelector(false)} />
    </>
  );
}

// ── Mobile bottom tab bar ──────────────────────────────────────────────────────

function PopupSheet({ visible, onClose, tabs, onSelect, activePath }: {
  visible: boolean; onClose: () => void; tabs: TabDef[];
  onSelect: (name: string) => void; activePath: string;
}) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const labelFor = (key: string) => key.startsWith("tab") ? t(key as TranslationKey) : key;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHandle} />
        <ScrollView horizontal={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetGrid}>
          {tabs.map((tab) => {
            const isActive = activePath.includes(tab.name);
            return (
              <TouchableOpacity key={tab.name} style={[styles.sheetItem, isActive && { backgroundColor: tab.accent + "18", borderColor: tab.accent + "60" }]} onPress={() => onSelect(tab.name)} activeOpacity={0.7}>
                <View style={[styles.sheetIconCircle, { backgroundColor: tab.accent + (isActive ? "30" : "18") }]}>
                  <Feather name={tab.icon as any} size={22} color={isActive ? tab.accent : Colors.textMuted} />
                </View>
                <Text style={[styles.sheetItemLabel, isActive && { color: tab.accent, fontWeight: "700" }]} numberOfLines={1}>{labelFor(tab.labelKey)}</Text>
                {isActive && <View style={[styles.sheetActiveDot, { backgroundColor: tab.accent }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLang();
  const { currentEmployee } = useEmployee();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const [showDepts, setShowDepts] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const navigate = (name: string) => { setShowDepts(false); setShowMore(false); router.navigate(`/(tabs)/${name}` as any); };

  const role = currentEmployee?.role;
  const hasRole = !!role;
  const showCashierTab = !hasRole || canDo(role, ROLE_CAN_VIEW_CASHIER);
  const showArchiveTab = !hasRole || canDo(role, ROLE_CAN_VIEW_ARCHIVE);
  const showReportsTab = !hasRole || canDo(role, ROLE_CAN_VIEW_REPORTS);
  const visibleDeptsTab = !hasRole ? DEPT_TABS : DEPT_TABS.filter(d => canAccessDept(role, d.name));
  const visibleMoreTab = (!hasRole ? MORE_TABS : MORE_TABS.filter(m => {
    if (["branch-orders", "branch-inventory", "branches"].includes(m.name)) return canDo(role, ROLE_CAN_VIEW_BRANCH_FEATURES);
    if (m.name === "customers") return canDo(role, ROLE_CAN_VIEW_CUSTOMERS);
    if (m.name === "delivery") return canDo(role, ROLE_CAN_VIEW_DELIVERY);
    if (m.name === "trays") return canDo(role, ROLE_CAN_VIEW_TRAYS);
    if (m.name === "admin") return canDo(role, ROLE_CAN_ACCESS_ADMIN);
    return true;
  }));

  const isHome    = pathname.includes("home") || pathname === "/(tabs)" || pathname === "/";
  const isCashier = pathname.includes("cashier");
  const isArchive = pathname.includes("archive");
  const isReports = pathname.includes("reports");
  const isDept = visibleDeptsTab.some((d) => pathname.includes(d.name));
  const isMore = visibleMoreTab.some((m) => pathname.includes(m.name));
  const activeDeptAccent = visibleDeptsTab.find((d) => pathname.includes(d.name))?.accent ?? Colors.primary;
  const activeMoreAccent = visibleMoreTab.find((m) => pathname.includes(m.name))?.accent ?? Colors.primary;
  const bg = isDark ? "#0d1117" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const tabH = 64;
  const pb = Platform.OS === "ios" ? insets.bottom : 8;
  const isWeb = Platform.OS === "web";
  return (
    <>
      <PopupSheet visible={showDepts} onClose={() => setShowDepts(false)} tabs={visibleDeptsTab} onSelect={navigate} activePath={pathname} />
      <PopupSheet visible={showMore} onClose={() => setShowMore(false)} tabs={visibleMoreTab} onSelect={navigate} activePath={pathname} />
      <View style={[styles.bar, isWeb ? styles.webBar : styles.nativeBar, { height: tabH + pb, paddingBottom: pb, borderTopColor: border }]}>
        {isIOS && <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
        {!isIOS && <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />}
        <BarItem label="الطلبات" icon="activity" sf="list.bullet.rectangle" active={isHome} accent={Colors.gold} onPress={() => navigate("home")} />
        {showCashierTab && <BarItem label={t("tabCashier")} icon="file-text" sf="doc.text" active={isCashier} accent={Colors.gold} onPress={() => navigate("cashier")} />}
        {visibleDeptsTab.length > 0 && <BarItem label={t("tabDepts")} icon="grid" sf="square.grid.2x2" active={isDept} accent={activeDeptAccent} badge={showDepts ? "▲" : "▼"} onPress={() => setShowDepts((v) => !v)} />}
        {showArchiveTab && <BarItem label={t("tabArchive")} icon="archive" sf="archivebox" active={isArchive} accent={Colors.primaryLight} onPress={() => navigate("archive")} />}
        {showReportsTab && <BarItem label={t("tabReports")} icon="pie-chart" sf="chart.pie" active={isReports} accent="#8b5cf6" onPress={() => navigate("reports")} />}
        {visibleMoreTab.length > 0 && <BarItem label={t("tabMore")} icon="more-horizontal" sf="ellipsis" active={isMore} accent={activeMoreAccent} badge={showMore ? "▲" : "▼"} onPress={() => setShowMore((v) => !v)} />}
      </View>
    </>
  );
}

function BarItem({ label, icon, sf, active, accent, badge, onPress }: {
  label: string; icon: string; sf?: string; active: boolean; accent: string; badge?: string; onPress: () => void;
}) {
  const isIOS = Platform.OS === "ios";
  const iconColor = active ? accent : Colors.textMuted;
  return (
    <TouchableOpacity style={styles.barItem} onPress={onPress} activeOpacity={0.7}>
      {active && <View style={[styles.activePill, { backgroundColor: accent }]} />}
      <View style={styles.barIconWrap}>
        {isIOS && sf ? <SymbolView name={sf as any} tintColor={iconColor} size={22} /> : <Feather name={icon as any} size={22} color={iconColor} />}
        {badge && <Text style={[styles.arrowBadge, { color: active ? accent : Colors.textMuted }]}>{badge}</Text>}
      </View>
      <Text style={[styles.barLabel, active && { color: accent, fontWeight: "700" }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Root layout ────────────────────────────────────────────────────────────────

const SCREEN_META: Record<string, { titleKey: string; accent: string }> = {
  home:             { titleKey: "لوحة الطلبات",   accent: Colors.primary },
  cashier:          { titleKey: "titleCashier",   accent: Colors.gold },
  halwa:            { titleKey: "titleHalwa",      accent: Colors.halwa },
  mawali:           { titleKey: "titleMawali",     accent: Colors.mawali },
  chocolate:        { titleKey: "titleChocolate",  accent: Colors.chocolate },
  cake:             { titleKey: "titleCake",       accent: Colors.cake },
  packaging:        { titleKey: "titlePackaging",  accent: Colors.packaging },
  archive:          { titleKey: "titleArchive",    accent: Colors.primaryLight },
  reports:          { titleKey: "titleReports",    accent: "#8b5cf6" },
  developer:        { titleKey: "titleDeveloper",      accent: "#7c3aed" },
  "branch-orders":  { titleKey: "titleBranchOrders",   accent: Colors.gold },
  "branch-inventory": { titleKey: "titleBranchInventory", accent: "#2563eb" },
  branches:         { titleKey: "titleManageBranches", accent: "#0d9488" },
  customers:        { titleKey: "titleCustomers",  accent: "#0891b2" },
  delivery:         { titleKey: "titleDelivery",   accent: "#0d9488" },
  trays:            { titleKey: "titleTrays",      accent: Colors.gold },
  admin:            { titleKey: "titleAdmin",      accent: Colors.primaryLight },
  settings:         { titleKey: "الإعدادات",       accent: Colors.primary },
};

function useScreenMeta(pathname: string, t: (k: TranslationKey) => string) {
  const key = Object.keys(SCREEN_META).find((k) => pathname.includes(k)) ?? "cashier";
  const meta = SCREEN_META[key];
  const rawKey = meta.titleKey;
  const title = rawKey.startsWith("title") || rawKey.startsWith("tab") ? t(rawKey as TranslationKey) : rawKey;
  return { title, accent: meta.accent };
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { lang } = useLang();
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = lang === "ar" || lang === "ur";
  const isDesktop = Platform.OS === "web" && width >= 768;
  const navigate = useCallback((name: string) => { router.navigate(`/(tabs)/${name}` as any); }, [router]);
  const { title: screenTitle, accent: screenAccent } = useScreenMeta(pathname, t);

  const screens = (
    <>
      <Tabs.Screen name="home"             options={{ title: "لوحة الطلبات",      headerShown: false }} />
      <Tabs.Screen name="cashier"          options={{ title: t("titleCashier"),   headerShown: false }} />
      <Tabs.Screen name="halwa"            options={{ title: t("titleHalwa"),     headerShown: false }} />
      <Tabs.Screen name="mawali"           options={{ title: t("titleMawali"),    headerShown: false }} />
      <Tabs.Screen name="chocolate"        options={{ title: t("titleChocolate"), headerShown: false }} />
      <Tabs.Screen name="cake"             options={{ title: t("titleCake"),      headerShown: false }} />
      <Tabs.Screen name="packaging"        options={{ title: t("titlePackaging"), headerShown: false }} />
      <Tabs.Screen name="archive"          options={{ title: t("titleArchive"),   headerShown: false }} />
      <Tabs.Screen name="reports"          options={{ title: t("titleReports"),   headerShown: false }} />
      <Tabs.Screen name="developer"        options={{ href: null, title: t("titleDeveloper"),      headerShown: false }} />
      <Tabs.Screen name="branch-orders"    options={{ title: t("titleBranchOrders"),   headerShown: false }} />
      <Tabs.Screen name="branch-inventory" options={{ title: t("titleBranchInventory"), headerShown: false }} />
      <Tabs.Screen name="branches"         options={{ title: t("titleManageBranches"), headerShown: false }} />
      <Tabs.Screen name="customers"        options={{ title: t("titleCustomers"), headerShown: false }} />
      <Tabs.Screen name="delivery"         options={{ title: t("titleDelivery"),  headerShown: false }} />
      <Tabs.Screen name="trays"            options={{ title: t("titleTrays"),     headerShown: false }} />
      <Tabs.Screen name="admin"            options={{ title: t("titleAdmin"),     headerShown: false }} />
      <Tabs.Screen name="settings"         options={{ title: "الإعدادات",         headerShown: false }} />
      <Tabs.Screen name="index"            options={{ href: null }} />
    </>
  );

  if (isDesktop) {
    return (
      <View style={[ds.root, isRTL ? ds.rootRTL : ds.rootLTR]}>
        <DesktopSidebar activePath={pathname} navigate={navigate} isRTL={isRTL} />
        <View style={ds.content}>
          <View style={[ds.contentHeader, isRTL ? ds.rowRTL : ds.rowLTR]}>
            <View style={[ds.contentBadge, { backgroundColor: screenAccent }]}>
              <Text style={ds.contentBadgeText}>{screenTitle}</Text>
            </View>
          </View>
          <Tabs tabBar={() => <></>} screenOptions={{ headerShown: false }}>
            {screens}
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LogoHeader titleKey={screenTitle} accentColor={screenAccent} isDesktop={false} />
      <Tabs tabBar={() => <CustomTabBar />} screenOptions={{ headerShown: false }}>
        {screens}
      </Tabs>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerContainer: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 },
  headerInner: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  rowRTL: { flexDirection: "row-reverse" }, rowLTR: { flexDirection: "row" },
  logoBox: { width: 46, height: 46, borderRadius: 10, overflow: "hidden", borderWidth: 2, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  laviLogoBox: { height: 46, width: 120, borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  laviLogoImg: { width: 112, height: 42 },
  fawtaraMark: { width: 31, height: 31, position: "relative" },
  markBlueStem: { position: "absolute", left: 0, top: 0, width: 10, height: 31, backgroundColor: "#132446" },
  markBlueFoot: { position: "absolute", left: 0, bottom: 0, width: 22, height: 12, backgroundColor: "#132446" },
  markGoldTop: { position: "absolute", right: 0, top: 0, width: 24, height: 9, backgroundColor: "#c79a35" },
  markGoldMid: { position: "absolute", right: 6, top: 13, width: 18, height: 9, backgroundColor: "#c79a35" },
  tenantLogoMark: { width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  tenantLogoMarkSmall: { width: 32, height: 32, borderRadius: 8 },
  tenantLogoText: { fontSize: 22, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  tenantLogoTextSmall: { fontSize: 18 },
  tenantLogoLine: { width: 18, height: 2, borderRadius: 2, marginTop: 1 },
  brandBlock: { gap: 1 },
  brandName: { fontSize: 16, fontWeight: "900", letterSpacing: 0.3, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  brandSub: { color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "600" },
  langBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  langBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", maxWidth: 130 },
  empAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  empAvatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empTextBlock: { flex: 1 },
  empName: { color: "#fff", fontSize: 11, fontWeight: "600" },
  empId: { color: "rgba(255,255,255,0.6)", fontSize: 9 },
  loginText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600" },
  screenBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  screenBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  goldLine: { height: 2, opacity: 0.75 },
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, zIndex: 100, overflow: "hidden" },
  nativeBar: { position: "absolute", bottom: 0, left: 0, right: 0 },
  webBar: { position: "relative", left: 0, right: 0 },
  barItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 6, gap: 3, position: "relative" },
  activePill: { position: "absolute", top: 0, width: 32, height: 3, borderRadius: 2 },
  barIconWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  arrowBadge: { fontSize: 7, fontWeight: "900", marginTop: 6 },
  barLabel: { fontSize: 10, fontWeight: "500", color: Colors.textMuted, letterSpacing: 0.1 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheetContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20 },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", marginBottom: 18 },
  sheetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", paddingBottom: 8 },
  sheetItem: { width: 88, alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1.5, borderColor: "transparent", backgroundColor: "#f8f9fb", position: "relative" },
  sheetIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  sheetItemLabel: { fontSize: 11, fontWeight: "600", color: Colors.textMuted, textAlign: "center" },
  sheetActiveDot: { position: "absolute", top: 8, right: 10, width: 7, height: 7, borderRadius: 4 },
});

const ds = StyleSheet.create({
  root: { flex: 1 },
  rootLTR: { flexDirection: "row" },
  rootRTL: { flexDirection: "row-reverse" },
  sidebar: { width: 220, flexDirection: "column" },
  content: { flex: 1, overflow: "hidden" as any },
  rowLTR: { flexDirection: "row" },
  rowRTL: { flexDirection: "row-reverse" },
  brand: { alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14 },
  laviBrand: { alignItems: "center", justifyContent: "center", paddingTop: 20, paddingBottom: 14, paddingHorizontal: 12 },
  laviSidebarLogo: { width: 188, height: 72 },
  brandName: { fontSize: 15, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  brandSub: { color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)", marginHorizontal: 12, marginVertical: 4 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, marginHorizontal: 8, marginVertical: 1, borderRadius: 10, position: "relative" },
  navIndent: { paddingLeft: 28, marginLeft: 12 },
  navActiveLine: { position: "absolute", left: 0, top: "15%" as any, width: 3, height: "70%" as any, borderRadius: 2 },
  navLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", flex: 1 },
  empRow: { alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  empAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  empAvatarText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empName: { color: "#fff", fontSize: 12, fontWeight: "600" },
  empId: { color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 1 },
  loginText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  langRow: { alignItems: "center", gap: 8, paddingHorizontal: 14, paddingBottom: 18, paddingTop: 4 },
  langLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", flex: 1 },
  langCurrent: { color: "rgba(255,255,255,0.25)", fontSize: 10 },
  contentHeader: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  contentBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start" },
  contentBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
