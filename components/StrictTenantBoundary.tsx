import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";

export function StrictTenantBoundary({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const { currentEmployee, setCurrentEmployee, isLoading } = useEmployee();
  const { lang } = useLang();

  if (isLoading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#897443" /></View>;
  if (!currentEmployee || currentEmployee.companyId !== companyId) {
    return (
      <View style={{ flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <Text style={{ textAlign: "center", lineHeight: 24 }}>{lang === "ar" ? "تعذر التحقق من ملف الموظف. اتصل بالإنترنت أو اطلب من المسؤول تهيئة الحساب. الطلبات المحلية محفوظة." : "Cannot verify the employee profile. Connect to the internet or ask your administrator to provision this account. Local orders are preserved."}</Text>
        <TouchableOpacity onPress={() => { void setCurrentEmployee(null); }}><Text>{lang === "ar" ? "تسجيل الخروج" : "Sign out"}</Text></TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}
