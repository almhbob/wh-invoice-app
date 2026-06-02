import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

const LAVIVIANE_COMPANY = {
  id: "laviviane-trial",
  name: "Laviviane Maison de Patisserie",
  slug: "laviviane",
  status: "trial",
  plan: "business",
  maxUsers: 25,
  maxInvoicesPerMonth: 3000,
  expiresAt: "2027-12-31T23:59:59.000Z",
  createdAt: "2026-05-22T00:00:00.000Z",
};

const COMPANY_STORAGE_KEY = "@fawtara_current_tenant_v1";
const LEGACY_COMPANY_STORAGE_KEY = "@wh_current_company_v1";

export default function LavivianeEntry() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function selectTenantOnly() {
      try {
        await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(LAVIVIANE_COMPANY));
        await AsyncStorage.removeItem(LEGACY_COMPANY_STORAGE_KEY);
      } finally {
        if (mounted) setReady(true);
      }
    }
    selectTenantOnly();
    return () => {
      mounted = false;
    };
  }, []);

  if (ready) return <Redirect href="/(tabs)/cashier" />;

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.title}>جاري فتح شركة Laviviane...</Text>
      <Text style={styles.note}>سيتم اختيار الشركة فقط، ثم يسجل الموظف دخوله بكوده داخل نطاق الشركة.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background, gap: 12, padding: 24 },
  title: { color: Colors.primary, fontSize: 16, fontWeight: "800", textAlign: "center" },
  note: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 20 },
});
