import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Tabs, useRouter, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmployeeSelectorModal } from "@/components/EmployeeSelectorModal";
import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";

/* ─────────────────────────────────────────────
   Role → accent colour map
───────────────────────────────────────────── */
const ROLE_COLORS: Record<string, string> = {
  cashier: Colors.gold,
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
  admin: Colors.primaryLight,
};

/* ─────────────────────────────────────────────
   Logo / Header
───────────────────────────────────────────── */
interface LogoHeaderProps {
  titleKey: string;
  accentColor?: string;
}

function LogoHeader({ titleKey, accentColor }: LogoHeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 0 : insets.top;
  const { currentEmployee } = useEmployee();
  const { lang, toggleLang, t } = useLang();
  const [showSelector, setShowSelector] = useState(false);
  const isRTL = lang === "ar" || lang === "ur";
  const LANG_NEXT: Record<string, string> = {
    ar: "EN",
    en: "اردو",
    ur: "हि",
    hi: "ع",
  };

  return (
    <>
      <View style={[styles.headerContainer, { paddingTop: topInset }]}>
        <View
          style={[
            styles.headerInner,
            isRTL ? styles.rowRTL : styles.rowLTR,
          ]}
        >
          <View style={styles.logoBox}>
            <Image
              source={require("@/assets/images/logo.jpg")}
              style={styles.logoImg}
              contentFit="contain"
            />
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>W&H</Text>
            <Text style={styles.brandSub}>{t("appSub")}</Text>
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.langBtn}
            onPress={toggleLang}
            activeOpacity={0.75}
          >
            <Text style={styles.langBtnText}>{LANG_NEXT[lang] ?? "EN"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.empBtn}
            onPress={() => setShowSelector(true)}
            activeOpacity={0.8}
          >
            {currentEmployee ? (
              <>
                <View
                  style={[
                    styles.empAvatar,
                    { backgroundColor: ROLE_COLORS[currentEmployee.role] },
                  ]}
                >
                  <Text style={styles.empAvatarText}>
                    {currentEmployee.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.empTextBlock}>
                  <Text style={styles.empName} numberOfLines={1}>
                    {currentEmployee.name}
                  </Text>
                  <Text style={styles.empId}>
                    #{currentEmployee.employeeId}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Feather
                  name="user"
                  size={14}
                  color="rgba(255,255,255,0.75)"
                />
                <Text style={styles.loginText}>{t("loginBtn")}</Text>
              </>
            )}
          </TouchableOpacity>

          <View
            style={[
              styles.screenBadge,
              { backgroundColor: accentColor ?? Colors.gold },
            ]}
          >
            <Text style={styles.screenBadgeText}>{titleKey}</Text>
          </View>
        </View>

        <View style={styles.goldLine} />
      </View>

      <EmployeeSelectorModal
        visible={showSelector}
        onClose={() => setShowSelector(false)}
      />
    </>
  );
}

/* ─────────────────────────────────────────────
   Tab definitions
───────────────────────────────────────────── */
interface TabDef {
  name: string;
  labelKey: string;
  titleKey: string;
  icon: string;        // Feather icon name
  sf?: string;         // SF Symbol (iOS)
  accent: string;
}

const DEPT_TABS: TabDef[] = [
  { name: "halwa",     labelKey: "tabHalwa",     titleKey: "titleHalwa",     icon: "coffee",    sf: "cup.and.saucer",  accent: Colors.halwa      },
  { name: "mawali",    labelKey: "tabMawali",     titleKey: "titleMawali",    icon: "package",   sf: "tray",            accent: Colors.mawali     },
  { name: "chocolate", labelKey: "tabChocolate",  titleKey: "titleChocolate", icon: "gift",      sf: "gift",            accent: Colors.chocolate  },
  { name: "cake",      labelKey: "tabCake",       titleKey: "titleCake",      icon: "layers",    sf: "birthday.cake",   accent: Colors.cake       },
  { name: "packaging", labelKey: "tabPackaging",  titleKey: "titlePackaging", icon: "box",       sf: "shippingbox",     accent: Colors.packaging  },
];

const MORE_TABS: TabDef[] = [
  { name: "customers", labelKey: "tabCustomers", titleKey: "titleCustomers", icon: "users",     sf: "person.2",        accent: "#0891b2"          },
  { name: "delivery",  labelKey: "tabDelivery",  titleKey: "titleDelivery",  icon: "truck",     sf: "shippingbox.and.arrow.backward", accent: "#0d9488" },
  { name: "trays",     labelKey: "tabTrays",     titleKey: "titleTrays",     icon: "layers",    sf: "tray.2",          accent: Colors.gold        },
  { name: "admin",     labelKey: "tabAdmin",     titleKey: "titleAdmin",     icon: "settings",  sf: "gearshape",       accent: Colors.primaryLight },
];

/* ─────────────────────────────────────────────
   Popup sheet (Departments / More)
───────────────────────────────────────────── */
interface PopupSheetProps {
  visible: boolean;
  onClose: () => void;
  tabs: TabDef[];
  onSelect: (name: string) => void;
  activePath: string;
}

function PopupSheet({
  visible,
  onClose,
  tabs,
  onSelect,
  activePath,
}: PopupSheetProps) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 12 }]}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetGrid}
        >
          {tabs.map((tab) => {
            const isActive = activePath.includes(tab.name);
            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.sheetItem,
                  isActive && { backgroundColor: tab.accent + "18", borderColor: tab.accent + "60" },
                ]}
                onPress={() => onSelect(tab.name)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.sheetIconCircle,
                    { backgroundColor: tab.accent + (isActive ? "30" : "18") },
                  ]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={22}
                    color={isActive ? tab.accent : Colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.sheetItemLabel,
                    isActive && { color: tab.accent, fontWeight: "700" },
                  ]}
                  numberOfLines={1}
                >
                  {t(tab.labelKey)}
                </Text>
                {isActive && (
                  <View style={[styles.sheetActiveDot, { backgroundColor: tab.accent }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   Custom Bottom Tab Bar
───────────────────────────────────────────── */
function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLang();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  const [showDepts, setShowDepts] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const navigate = (name: string) => {
    setShowDepts(false);
    setShowMore(false);
    router.navigate(`/(tabs)/${name}` as any);
  };

  const isCashier  = pathname.includes("cashier");
  const isArchive  = pathname.includes("archive");
  const isReports  = pathname.includes("reports");
  const isDept     = DEPT_TABS.some((d) => pathname.includes(d.name));
  const isMore     = MORE_TABS.some((m) => pathname.includes(m.name));

  // Active dept/more accent colour for the indicator
  const activeDeptAccent =
    DEPT_TABS.find((d) => pathname.includes(d.name))?.accent ?? Colors.primary;
  const activeMoreAccent =
    MORE_TABS.find((m) => pathname.includes(m.name))?.accent ?? Colors.primary;

  const bg = isDark ? "#0d1117" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const tabH = 64;
  const pb = Platform.OS === "ios" ? insets.bottom : 8;

  return (
    <>
      {/* Dept sheet */}
      <PopupSheet
        visible={showDepts}
        onClose={() => setShowDepts(false)}
        tabs={DEPT_TABS}
        onSelect={navigate}
        activePath={pathname}
      />

      {/* More sheet */}
      <PopupSheet
        visible={showMore}
        onClose={() => setShowMore(false)}
        tabs={MORE_TABS}
        onSelect={navigate}
        activePath={pathname}
      />

      {/* Bar */}
      <View
        style={[
          styles.bar,
          {
            height: tabH + pb,
            paddingBottom: pb,
            borderTopColor: border,
          },
        ]}
      >
        {/* Blur background on iOS */}
        {isIOS && (
          <BlurView
            intensity={90}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        )}
        {!isIOS && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
        )}

        {/* ── CASHIER ── */}
        <BarItem
          label={t("tabCashier")}
          icon="file-text"
          sf="doc.text"
          active={isCashier}
          accent={Colors.gold}
          onPress={() => navigate("cashier")}
        />

        {/* ── DEPARTMENTS ── */}
        <BarItem
          label={t("tabDepts")}
          icon="grid"
          sf="square.grid.2x2"
          active={isDept}
          accent={activeDeptAccent}
          badge={showDepts ? "▲" : "▼"}
          onPress={() => setShowDepts((v) => !v)}
        />

        {/* ── ARCHIVE ── */}
        <BarItem
          label={t("tabArchive")}
          icon="archive"
          sf="archivebox"
          active={isArchive}
          accent={Colors.primaryLight}
          onPress={() => navigate("archive")}
        />

        {/* ── REPORTS ── */}
        <BarItem
          label={t("tabReports")}
          icon="pie-chart"
          sf="chart.pie"
          active={isReports}
          accent="#8b5cf6"
          onPress={() => navigate("reports")}
        />

        {/* ── MORE ── */}
        <BarItem
          label={t("tabMore")}
          icon="more-horizontal"
          sf="ellipsis"
          active={isMore}
          accent={activeMoreAccent}
          badge={showMore ? "▲" : "▼"}
          onPress={() => setShowMore((v) => !v)}
        />
      </View>
    </>
  );
}

/* ─────────────────────────────────────────────
   Single bar item
───────────────────────────────────────────── */
interface BarItemProps {
  label: string;
  icon: string;
  sf?: string;
  active: boolean;
  accent: string;
  badge?: string;
  onPress: () => void;
}

function BarItem({ label, icon, sf, active, accent, badge, onPress }: BarItemProps) {
  const isIOS = Platform.OS === "ios";
  const iconColor = active ? accent : Colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.barItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Active indicator pill */}
      {active && (
        <View style={[styles.activePill, { backgroundColor: accent }]} />
      )}

      <View style={styles.barIconWrap}>
        {isIOS && sf ? (
          <SymbolView name={sf as any} tintColor={iconColor} size={22} />
        ) : (
          <Feather name={icon as any} size={22} color={iconColor} />
        )}
        {badge && (
          <Text style={[styles.arrowBadge, { color: active ? accent : Colors.textMuted }]}>
            {badge}
          </Text>
        )}
      </View>

      <Text
        style={[
          styles.barLabel,
          active && { color: accent, fontWeight: "700" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────
   Root layout
───────────────────────────────────────────── */
export default function TabLayout() {
  const { t } = useLang();

  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="cashier"
        options={{
          title: t("titleCashier"),
          header: () => <LogoHeader titleKey={t("titleCashier")} accentColor={Colors.gold} />,
        }}
      />
      <Tabs.Screen
        name="halwa"
        options={{
          title: t("titleHalwa"),
          header: () => <LogoHeader titleKey={t("titleHalwa")} accentColor={Colors.halwa} />,
        }}
      />
      <Tabs.Screen
        name="mawali"
        options={{
          title: t("titleMawali"),
          header: () => <LogoHeader titleKey={t("titleMawali")} accentColor={Colors.mawali} />,
        }}
      />
      <Tabs.Screen
        name="chocolate"
        options={{
          title: t("titleChocolate"),
          header: () => <LogoHeader titleKey={t("titleChocolate")} accentColor={Colors.chocolate} />,
        }}
      />
      <Tabs.Screen
        name="cake"
        options={{
          title: t("titleCake"),
          header: () => <LogoHeader titleKey={t("titleCake")} accentColor={Colors.cake} />,
        }}
      />
      <Tabs.Screen
        name="packaging"
        options={{
          title: t("titlePackaging"),
          header: () => <LogoHeader titleKey={t("titlePackaging")} accentColor={Colors.packaging} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: t("titleArchive"),
          header: () => <LogoHeader titleKey={t("titleArchive")} accentColor={Colors.primaryLight} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("titleReports"),
          header: () => <LogoHeader titleKey={t("titleReports")} accentColor="#8b5cf6" />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: t("titleCustomers"),
          header: () => <LogoHeader titleKey={t("titleCustomers")} accentColor="#0891b2" />,
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          title: t("titleDelivery"),
          header: () => <LogoHeader titleKey={t("titleDelivery")} accentColor="#0d9488" />,
        }}
      />
      <Tabs.Screen
        name="trays"
        options={{
          title: t("titleTrays"),
          header: () => <LogoHeader titleKey={t("titleTrays")} accentColor={Colors.gold} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t("titleAdmin"),
          header: () => <LogoHeader titleKey={t("titleAdmin")} accentColor={Colors.primaryLight} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* ── Header ── */
  headerContainer: {
    backgroundColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  headerInner: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  rowRTL: { flexDirection: "row-reverse" },
  rowLTR: { flexDirection: "row" },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.gold + "80",
    backgroundColor: "#fff",
  },
  logoImg: { width: 46, height: 46 },
  brandBlock: { gap: 1 },
  brandName: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  brandSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontWeight: "500",
  },
  langBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  langBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 130,
  },
  empAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  empAvatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empTextBlock: { flex: 1 },
  empName: { color: "#fff", fontSize: 11, fontWeight: "600" },
  empId: { color: "rgba(255,255,255,0.6)", fontSize: 9 },
  loginText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  screenBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  screenBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  goldLine: { height: 2, backgroundColor: Colors.gold, opacity: 0.6 },

  /* ── Bottom Bar ── */
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    gap: 3,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  barIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  arrowBadge: {
    fontSize: 7,
    fontWeight: "900",
    marginTop: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textMuted,
    letterSpacing: 0.1,
  },

  /* ── Popup Sheet ── */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 18,
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    paddingBottom: 8,
  },
  sheetItem: {
    width: 88,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: "#f8f9fb",
    position: "relative",
  },
  sheetIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetItemLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    textAlign: "center",
  },
  sheetActiveDot: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
