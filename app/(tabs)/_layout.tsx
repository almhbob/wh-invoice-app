import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
  Platform,
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

const ROLE_COLORS = {
  cashier: Colors.gold,
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
  admin: Colors.primaryLight,
};

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
  const LANG_NEXT: Record<string, string> = { ar: "EN", en: "اردو", ur: "हि", hi: "ع" };

  return (
    <>
      <View style={[styles.headerContainer, { paddingTop: topInset }]}>
        <View style={[styles.headerInner, isRTL ? styles.rowRTL : styles.rowLTR]}>
          {/* Logo */}
          <View style={styles.logoBox}>
            <Image
              source={require("@/assets/images/logo.jpg")}
              style={styles.logoImg}
              contentFit="contain"
            />
          </View>

          {/* Brand */}
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>W&H</Text>
            <Text style={styles.brandSub}>{t("appSub")}</Text>
          </View>

          <View style={{ flex: 1 }} />

          {/* Lang toggle — cycles through AR → EN → UR → HI */}
          <TouchableOpacity style={styles.langBtn} onPress={toggleLang} activeOpacity={0.75}>
            <Text style={styles.langBtnText}>{LANG_NEXT[lang] ?? "EN"}</Text>
          </TouchableOpacity>

          {/* Employee button */}
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

          {/* Screen badge */}
          <View style={[styles.screenBadge, { backgroundColor: accentColor ?? Colors.gold }]}>
            <Text style={styles.screenBadgeText}>{titleKey}</Text>
          </View>
        </View>

        {/* Gold accent line */}
        <View style={styles.goldLine} />
      </View>

      <EmployeeSelectorModal visible={showSelector} onClose={() => setShowSelector(false)} />
    </>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { t } = useLang();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: Colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#000" : "#fff" }]} />
          ) : null,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: isWeb ? 8 : 0 },
      }}
    >
      <Tabs.Screen
        name="cashier"
        options={{
          title: t("titleCashier"),
          tabBarLabel: t("tabCashier"),
          header: () => <LogoHeader titleKey={t("titleCashier")} accentColor={Colors.gold} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="doc.text" tintColor={color} size={22} /> : <Feather name="file-text" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="halwa"
        options={{
          title: t("titleHalwa"),
          tabBarLabel: t("tabHalwa"),
          header: () => <LogoHeader titleKey={t("titleHalwa")} accentColor={Colors.halwa} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="cup.and.saucer" tintColor={color} size={22} /> : <Feather name="coffee" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mawali"
        options={{
          title: t("titleMawali"),
          tabBarLabel: t("tabMawali"),
          header: () => <LogoHeader titleKey={t("titleMawali")} accentColor={Colors.mawali} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="tray" tintColor={color} size={22} /> : <Feather name="package" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chocolate"
        options={{
          title: t("titleChocolate"),
          tabBarLabel: t("tabChocolate"),
          header: () => <LogoHeader titleKey={t("titleChocolate")} accentColor={Colors.chocolate} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="gift" tintColor={color} size={22} /> : <Feather name="gift" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cake"
        options={{
          title: t("titleCake"),
          tabBarLabel: t("tabCake"),
          header: () => <LogoHeader titleKey={t("titleCake")} accentColor={Colors.cake} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="birthday.cake" tintColor={color} size={22} /> : <Feather name="layers" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="packaging"
        options={{
          title: t("titlePackaging"),
          tabBarLabel: t("tabPackaging"),
          header: () => <LogoHeader titleKey={t("titlePackaging")} accentColor={Colors.packaging} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="shippingbox" tintColor={color} size={22} /> : <Feather name="box" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: t("titleArchive"),
          tabBarLabel: t("tabArchive"),
          header: () => <LogoHeader titleKey={t("titleArchive")} accentColor={Colors.primaryLight} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="archivebox" tintColor={color} size={22} /> : <Feather name="archive" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("titleReports"),
          tabBarLabel: t("tabReports"),
          header: () => <LogoHeader titleKey={t("titleReports")} accentColor="#8b5cf6" />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="chart.pie" tintColor={color} size={22} /> : <Feather name="pie-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: t("titleCustomers"),
          tabBarLabel: t("tabCustomers"),
          header: () => <LogoHeader titleKey={t("titleCustomers")} accentColor="#0891b2" />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="person.2" tintColor={color} size={22} /> : <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          title: t("titleDelivery"),
          tabBarLabel: t("tabDelivery"),
          header: () => <LogoHeader titleKey={t("titleDelivery")} accentColor="#0d9488" />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="shippingbox.and.arrow.backward" tintColor={color} size={22} /> : <Feather name="truck" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trays"
        options={{
          title: t("titleTrays"),
          tabBarLabel: t("tabTrays"),
          header: () => <LogoHeader titleKey={t("titleTrays")} accentColor={Colors.gold} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="tray.2" tintColor={color} size={22} /> : <Feather name="layers" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t("titleAdmin"),
          tabBarLabel: t("tabAdmin"),
          header: () => <LogoHeader titleKey={t("titleAdmin")} accentColor={Colors.primaryLight} />,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="chart.bar" tintColor={color} size={22} /> : <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

function NativeTabLayout() {
  const { t } = useLang();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="cashier">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>{t("tabCashier")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="halwa">
        <Icon sf={{ default: "cup.and.saucer", selected: "cup.and.saucer.fill" }} />
        <Label>{t("tabHalwa")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mawali">
        <Icon sf={{ default: "tray", selected: "tray.fill" }} />
        <Label>{t("tabMawali")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chocolate">
        <Icon sf={{ default: "gift", selected: "gift.fill" }} />
        <Label>{t("tabChocolate")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cake">
        <Icon sf={{ default: "birthday.cake", selected: "birthday.cake.fill" }} />
        <Label>{t("tabCake")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="packaging">
        <Icon sf={{ default: "shippingbox", selected: "shippingbox.fill" }} />
        <Label>{t("tabPackaging")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="archive">
        <Icon sf={{ default: "archivebox", selected: "archivebox.fill" }} />
        <Label>{t("tabArchive")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} />
        <Label>{t("tabReports")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="customers">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>{t("tabCustomers")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="delivery">
        <Icon sf={{ default: "shippingbox.and.arrow.backward", selected: "shippingbox.and.arrow.backward.fill" }} />
        <Label>{t("tabDelivery")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trays">
        <Icon sf={{ default: "tray.2", selected: "tray.2.fill" }} />
        <Label>{t("tabTrays")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="admin">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>{t("tabAdmin")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  headerInner: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  rowRTL: { flexDirection: "row-reverse" },
  rowLTR: { flexDirection: "row" },
  logoBox: {
    width: 46, height: 46, borderRadius: 10, overflow: "hidden",
    borderWidth: 2, borderColor: Colors.gold + "80", backgroundColor: "#fff",
  },
  logoImg: { width: 46, height: 46 },
  brandBlock: { gap: 1 },
  brandName: {
    color: Colors.gold, fontSize: 15, fontWeight: "800", letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  brandSub: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "500" },
  langBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  langBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 130,
  },
  empAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  empAvatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empTextBlock: { flex: 1 },
  empName: { color: "#fff", fontSize: 11, fontWeight: "600" },
  empId: { color: "rgba(255,255,255,0.6)", fontSize: 9 },
  loginText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600" },
  screenBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  screenBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  goldLine: { height: 2, backgroundColor: Colors.gold, opacity: 0.6 },
});
