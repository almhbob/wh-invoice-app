import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompanySubscriptionsPanel } from "@/components/CompanySubscriptionsPanel";
import { DeveloperControlCenterPanel } from "@/components/DeveloperControlCenterPanel";
import { DeveloperOwnerProfilePanel } from "@/components/DeveloperOwnerProfilePanel";
import { DeveloperSubscriptionsPanel } from "@/components/DeveloperSubscriptionsPanel";
import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { canAccessDeveloperDashboard } from "@/lib/developerAccess";

function AccessDenied() {
  return (
    <View style={styles.deniedCard}>
      <View style={styles.deniedIcon}>
        <Feather name="lock" size={24} color={Colors.accent} />
      </View>
      <Text style={styles.deniedTitle}>لوحة المطور محمية</Text>
      <Text style={styles.deniedText}>هذه اللوحة مخصصة لمالك النظام أو المستخدمين المصرح لهم فقط. تواصل مع مالك النظام إذا كنت تحتاج صلاحية Developer.</Text>
    </View>
  );
}

export default function DeveloperScreen() {
  const insets = useSafeAreaInsets();
  const { currentEmployee } = useEmployee();
  const allowed = canAccessDeveloperDashboard(currentEmployee as any);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {allowed ? (
          <>
            <DeveloperControlCenterPanel />
            <DeveloperOwnerProfilePanel />
            <DeveloperSubscriptionsPanel />
            <CompanySubscriptionsPanel />
          </>
        ) : (
          <AccessDenied />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, flexGrow: 1 },
  deniedCard: { flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fff", borderRadius: 22, padding: 22, borderWidth: 1, borderColor: Colors.border },
  deniedIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent + "12" },
  deniedTitle: { fontSize: 20, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  deniedText: { fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
});
