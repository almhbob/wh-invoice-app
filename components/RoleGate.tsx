import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { canDo } from "@/constants/rbac";
import { EmployeeRole, useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";

/** Blocks a screen for roles that have no business there (deep links included). */
export function RoleGate({ allow, children }: { allow: Set<EmployeeRole>; children: React.ReactNode }) {
  const { currentEmployee } = useEmployee();
  const { lang } = useLang();
  if (currentEmployee && !canDo(currentEmployee.role, allow)) {
    return (
      <View style={st.wrap}>
        <View style={st.icon}><Feather name="lock" size={30} color={Colors.accent} /></View>
        <Text style={st.title}>{lang === "ar" ? "لا تملك صلاحية لهذه الشاشة" : "You don't have access to this screen"}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const st = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: Colors.background, padding: 32 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent + "14", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: Colors.text, textAlign: "center" },
});
