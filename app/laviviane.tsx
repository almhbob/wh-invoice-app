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
  expiresAt: "2026-06-21T23:59:59.000Z",
  createdAt: "2026-05-22T00:00:00.000Z",
};

const COMPANY_STORAGE_KEY = "@fawtara_current_tenant_v1";
const LEGACY_COMPANY_STORAGE_KEY = "@wh_current_company_v1";
const SESSION_KEY = "@wh_session_v1_laviviane-trial";
const SESSION_EMPLOYEE_KEY = "@wh_session_employee_v1_laviviane-trial";

const LAVIVIANE_ADMIN = {
  id: "local-fallback-laviviane-trial",
  companyId: "laviviane-trial",
  name: "مسؤول شركة Laviviane",
  employeeId: "LAVI001",
  username: "laviviane",
  pinCode: "1234",
  status: "active",
  role: "admin",
  permissions: [
    "invoices.read",
    "invoices.write",
    "products.read",
    "products.write",
    "reports.read",
    "employees.read",
    "employees.write",
    "branches.read",
    "branches.write",
    "inventory.read",
    "inventory.write"
  ],
  createdAt: "2026-05-22T00:00:00.000Z",
  isLocalFallback: true,
};

export default function LavivianeEntry() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function setupLaviviane() {
      try {
        await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(LAVIVIANE_COMPANY));
        await AsyncStorage.removeItem(LEGACY_COMPANY_STORAGE_KEY);
        await AsyncStorage.setItem(SESSION_KEY, LAVIVIANE_ADMIN.id);
        await AsyncStorage.setItem(SESSION_EMPLOYEE_KEY, JSON.stringify(LAVIVIANE_ADMIN));
      } finally {
        if (mounted) setReady(true);
      }
    }
    setupLaviviane();
    return () => {
      mounted = false;
    };
  }, []);

  if (ready) return <Redirect href="/(tabs)/cashier" />;

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.title}>جاري تجهيز شركة Laviviane...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background, gap: 12, padding: 24 },
  title: { color: Colors.primary, fontSize: 16, fontWeight: "800", textAlign: "center" },
});
