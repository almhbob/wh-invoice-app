import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, Redirect, Stack, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const LAVIVIANE_COMPANY = {
  id: "laviviane-trial",
  name: "Laviviane Maison de Patisserie",
  slug: "laviviane",
  status: "trial",
  plan: "business",
  maxUsers: 25,
  maxInvoicesPerMonth: 3000,
  expiresAt: "2026-06-21T23:59:59.000Z",
  createdAt: "2026-05-22T00:00:00.000Z",
};

const COMPANY_STORAGE_KEY = "@fawtara_current_tenant_v1";
const LEGACY_COMPANY_STORAGE_KEY = "@wh_current_company_v1";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const isLavivianeLegacyRoute = pathname === "/laviviane" || pathname?.startsWith("/laviviane/");
  const [redirectLaviviane, setRedirectLaviviane] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function selectLavivianeTenant() {
      if (!isLavivianeLegacyRoute) return;
      try {
        await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(LAVIVIANE_COMPANY));
        await AsyncStorage.removeItem(LEGACY_COMPANY_STORAGE_KEY);
      } finally {
        if (mounted) setRedirectLaviviane(true);
      }
    }
    selectLavivianeTenant();
    return () => {
      mounted = false;
    };
  }, [isLavivianeLegacyRoute]);

  if (isLavivianeLegacyRoute) {
    if (redirectLaviviane) return <Redirect href="/(tabs)/cashier" />;
    return (
      <>
        <Stack.Screen options={{ title: "Laviviane" }} />
        <View style={styles.container}>
          <ActivityIndicator color="#14213d" />
          <Text style={styles.title}>جاري فتح شركة Laviviane...</Text>
          <Text style={styles.note}>سيتم اختيار الشركة فقط بدون تسجيل دخول تلقائي.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  note: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
