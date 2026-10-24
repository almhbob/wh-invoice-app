import { Feather } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { ProductionReadinessPanel } from "@/components/ProductionReadinessPanel";
import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { auth } from "@/lib/firebase";
import { writeAuditLog } from "@/lib/auditLog";
import { canAccessDeveloperDashboard } from "@/lib/developerAccess";

export default function DeveloperScreen() {
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await auth.authStateReady();
        const user = auth.currentUser;
        if (!user || user.isAnonymous) {
          if (active) setAuthorized(false);
          return;
        }
        const token = await user.getIdTokenResult();
        if (active) setAuthorized(canAccessDeveloperDashboard({ platformRole: String(token.claims.platformRole ?? "") }));
      } catch {
        if (active) setAuthorized(false);
      }
    })();
    return () => { active = false; };
  }, [currentEmployee?.id]);

  useEffect(() => {
    if (!authorized || !currentEmployee || !companyId) return;
    void writeAuditLog({
      companyId,
      action: "developer_panel_opened",
      actorId: currentEmployee.id,
      actorName: currentEmployee.name,
      targetType: "developer_dashboard",
    });
  }, [authorized, companyId, currentEmployee?.id, currentEmployee?.name]);

  if (authorized === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>جارٍ التحقق من صلاحية المطور…</Text>
      </View>
    );
  }
  if (!authorized) return <Redirect href="/(tabs)/cashier" />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <Feather name="shield" size={20} color={Colors.primary} />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.title}>مركز المطور</Text>
          <Text style={styles.subtitle}>وصول داخلي موثّق بمطالبة منصة موقّعة من الخادم.</Text>
        </View>
      </View>
      <ProductionReadinessPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4F2" },
  content: { padding: 18, gap: 16, maxWidth: 920, width: "100%", alignSelf: "center" },
  heading: { flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingVertical: 8 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  headingText: { flex: 1, gap: 4 },
  title: { fontSize: 21, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 18 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F4F4F2" },
  loadingText: { color: Colors.textMuted, fontSize: 13 },
});
