import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { tr } from "@/lib/i18n";
import { HrPayrollPanel } from "@/components/hr/HrPayrollPanel";
import { HrStaffPanel, s } from "@/components/hr/HrStaffPanel";

/** Admin → Staff: iqama/document expiry tracking and payroll. Company admin only. */
export function HrSection() {
  const { currentEmployee } = useEmployee();
  const [tab, setTab] = useState<"staff" | "payroll">("staff");
  if (currentEmployee?.role !== "admin") {
    return (
      <View style={[s.card, { alignItems: "center" }]}>
        <Feather name="lock" size={22} color={Colors.textMuted} />
        <Text style={s.muted}>{tr("ملفات العاملين والرواتب متاحة لمسؤول الشركة فقط.", "Staff files and payroll are for the company admin only.")}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={[s.seg, { alignSelf: "stretch" }]}>
        {([["staff", tr("العاملون والإقامات", "Staff & iqamas"), "users"], ["payroll", tr("الرواتب", "Payroll"), "credit-card"]] as const).map(([k, l, icon]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.segBtn, { flex: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "center", alignItems: "center" }, tab === k && s.segOn]}>
            <Feather name={icon} size={14} color={tab === k ? Colors.text : Colors.textSecondary} />
            <Text style={[s.segTxt, tab === k && s.segTxtOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "staff" ? <HrStaffPanel /> : <HrPayrollPanel />}
    </View>
  );
}
