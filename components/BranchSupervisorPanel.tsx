import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { BRANCH_SUPERVISOR_ALLOWED_ROLES, BRANCH_SUPERVISOR_POLICY_AR } from "@/constants/branchSupervisorPermissions";
import { ROLE_LABELS } from "@/context/EmployeeContext";

export function BranchSupervisorPanel() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{BRANCH_SUPERVISOR_POLICY_AR.title}</Text>
      <Text style={styles.subtitle}>{BRANCH_SUPERVISOR_POLICY_AR.summary}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>المهام المسموحة</Text>
        {BRANCH_SUPERVISOR_POLICY_AR.canDo.map((item) => (
          <View key={item} style={styles.row}>
            <Feather name="check-circle" size={14} color={Colors.success} />
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الأدوار التي يستطيع منحها</Text>
        <View style={styles.chips}>
          {BRANCH_SUPERVISOR_ALLOWED_ROLES.map((role) => (
            <View key={role} style={styles.chip}>
              <Text style={styles.chipText}>{ROLE_LABELS[role]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.dangerSection}>
        <Text style={styles.sectionTitle}>قيود الحماية</Text>
        {BRANCH_SUPERVISOR_POLICY_AR.cannotDo.map((item) => (
          <View key={item} style={styles.row}>
            <Feather name="x-circle" size={14} color={Colors.accent} />
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  section: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  dangerSection: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: Colors.accent + "08" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right" },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  rowText: { flex: 1, fontSize: 12, color: Colors.text, textAlign: "right", lineHeight: 18 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.primary + "10", borderWidth: 1, borderColor: Colors.primary + "25" },
  chipText: { fontSize: 11, fontWeight: "800", color: Colors.primary },
});
