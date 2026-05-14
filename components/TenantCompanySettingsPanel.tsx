import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { CAKE_CHOCOLATE_COMPANY_BLUEPRINT } from "@/constants/cakeCompanyBlueprint";
import { DEMO_TENANT_COMPANY, DEMO_TENANT_USERS } from "@/constants/demoTenant";

function SmallCard({ icon, title, value }: { icon: any; title: string; value: string | number }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}><Feather name={icon} size={15} color={Colors.primary} /></View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export function TenantCompanySettingsPanel() {
  const blueprint = CAKE_CHOCOLATE_COMPANY_BLUEPRINT;
  const activeDepartments = blueprint.departments.filter((d) => d.enabled);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>لوحة إعدادات الشركات</Text>
      <Text style={styles.subtitle}>إعدادات مخصصة لشركات الكيك والشوكولاتة مع عزل بيانات كل شركة.</Text>

      <View style={styles.grid}>
        <SmallCard icon="briefcase" title="الشركة التجريبية" value={DEMO_TENANT_COMPANY.nameAr} />
        <SmallCard icon="users" title="عدد المستخدمين" value={blueprint.subscription.maxUsers} />
        <SmallCard icon="file-text" title="فواتير شهرية" value={blueprint.subscription.maxInvoicesPerMonth} />
        <SmallCard icon="clock" title="تجربة مجانية" value={`${blueprint.subscription.trialDays} يوم`} />
      </View>

      <Text style={styles.sectionTitle}>الأقسام المفعلة</Text>
      <View style={styles.chips}>
        {activeDepartments.map((dept) => (
          <View key={dept.key} style={styles.chip}>
            <Feather name="check" size={12} color={Colors.success} />
            <Text style={styles.chipText}>{dept.nameAr}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>مستخدمون تجريبيون</Text>
      {DEMO_TENANT_USERS.map((user) => (
        <View key={user.employeeId} style={styles.userRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.name.charAt(0)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userId}>#{user.employeeId}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  card: { flexGrow: 1, minWidth: 140, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc", gap: 5 },
  iconBox: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gold + "20", alignSelf: "flex-end" },
  cardTitle: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  cardValue: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right", marginTop: 4 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.success + "12" },
  chipText: { fontSize: 11, fontWeight: "800", color: Colors.success },
  userRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: Colors.primary + "08" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  userName: { fontSize: 13, color: Colors.text, fontWeight: "900", textAlign: "right" },
  userId: { fontSize: 10, color: Colors.textMuted, textAlign: "right" },
});
