import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { DEFAULT_TENANT } from "@/constants/platform";
import { CompanyTenant, useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";

const ACCESS_KEY = "@fawtara_access_gate_v1";

const DEMO_TENANT: CompanyTenant = {
  id: DEFAULT_TENANT.id,
  name: DEFAULT_TENANT.name,
  slug: DEFAULT_TENANT.slug,
  status: "active",
  plan: "business",
  maxUsers: 25,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function TenantAccessGate({ children }: { children: React.ReactNode }) {
  const { company, setCompany, switchCompanyById } = useCompany();
  const { employees, currentEmployee, setCurrentEmployee, addEmployee, isLoading } = useEmployee();
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [companyCode, setCompanyCode] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerId, setOwnerId] = useState("OWNER001");
  const [ownerPin, setOwnerPin] = useState("1234");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(ACCESS_KEY)
      .then((value) => mounted && setUnlocked(value === "1"))
      .finally(() => mounted && setReady(true));
    return () => { mounted = false; };
  }, []);

  const employeeCountLabel = useMemo(() => employees.length ? `${employees.length} مستخدم` : "لا يوجد مستخدمون", [employees.length]);

  const unlockDemo = async () => {
    await setCompany(DEMO_TENANT);
    await AsyncStorage.setItem(ACCESS_KEY, "1");
    setUnlocked(true);
  };

  const unlockByCode = async () => {
    const code = companyCode.trim();
    if (!code) {
      Alert.alert("مطلوب", "أدخل كود الشركة أو اختر الشركة التجريبية.");
      return;
    }
    await switchCompanyById(code);
    await AsyncStorage.setItem(ACCESS_KEY, "1");
    setUnlocked(true);
  };

  const resetCompany = async () => {
    await AsyncStorage.removeItem(ACCESS_KEY);
    await setCurrentEmployee(null);
    setLoginId("");
    setLoginPin("");
    setUnlocked(false);
  };

  const loginEmployee = async () => {
    const user = normalize(loginId);
    const pin = loginPin.trim();
    if (!user || !pin) {
      Alert.alert("مطلوب", "أدخل اليوزر أو الرقم الوظيفي ورمز الدخول.");
      return;
    }

    const found = employees.find((emp) => {
      const empUser = normalize((emp as any).username || emp.employeeId || "");
      const empId = normalize(emp.employeeId || "");
      const empPin = String((emp as any).pinCode || "1234");
      return (empUser === user || empId === user) && empPin === pin;
    });

    if (!found) {
      Alert.alert("بيانات غير صحيحة", "لم يتم العثور على مستخدم مطابق داخل هذه الشركة، أو رمز الدخول غير صحيح.");
      return;
    }

    await setCurrentEmployee(found);
  };

  const createOwner = async () => {
    if (!ownerName.trim()) {
      Alert.alert("مطلوب", "أدخل اسم المسؤول.");
      return;
    }
    if (!ownerId.trim() || !ownerPin.trim()) {
      Alert.alert("مطلوب", "أدخل اليوزر/الرقم الوظيفي ورمز الدخول.");
      return;
    }
    setSaving(true);
    try {
      const emp = await addEmployee({
        name: ownerName.trim(),
        employeeId: ownerId.trim().toUpperCase(),
        username: ownerId.trim().toLowerCase(),
        pinCode: ownerPin.trim(),
        role: "admin",
      } as any);
      await setCurrentEmployee(emp);
    } catch (error) {
      console.error("Create owner failed", error);
      Alert.alert("تعذر إنشاء المستخدم", "راجع صلاحيات Firestore أو اتصال الإنترنت ثم حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <View style={styles.center}><ActivityIndicator color={Colors.gold} /><Text style={styles.muted}>جاري التحقق...</Text></View>;
  }

  if (!unlocked) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>دخول الشركة</Text>
          <Text style={styles.subtitle}>يجب اختيار الشركة قبل فتح النظام حتى لا تختلط بيانات الشركات.</Text>
          <TextInput style={styles.input} value={companyCode} onChangeText={setCompanyCode} placeholder="كود الشركة" placeholderTextColor={Colors.textMuted} textAlign="right" />
          <TouchableOpacity style={styles.primaryBtn} onPress={unlockByCode}><Feather name="log-in" size={16} color="#fff" /><Text style={styles.primaryText}>دخول بالكود</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={unlockDemo}><Feather name="briefcase" size={16} color={Colors.gold} /><Text style={styles.secondaryText}>دخول الشركة الحالية / التجريبية</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!currentEmployee) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.switchBtn} onPress={resetCompany}><Text style={styles.switchText}>تغيير الشركة</Text></TouchableOpacity>
          <Text style={styles.title}>دخول المستخدم</Text>
          <Text style={styles.subtitle}>الشركة الحالية: {company.name} · {employeeCountLabel}</Text>
          {isLoading ? <ActivityIndicator color={Colors.gold} /> : employees.length > 0 ? (
            <View style={styles.list}>
              <TextInput style={styles.input} value={loginId} onChangeText={setLoginId} placeholder="اليوزر أو الرقم الوظيفي" placeholderTextColor={Colors.textMuted} textAlign="right" autoCapitalize="none" />
              <TextInput style={styles.input} value={loginPin} onChangeText={setLoginPin} placeholder="رمز الدخول" placeholderTextColor={Colors.textMuted} textAlign="right" secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={styles.primaryBtn} onPress={loginEmployee}><Feather name="unlock" size={16} color="#fff" /><Text style={styles.primaryText}>دخول المستخدم</Text></TouchableOpacity>
              <Text style={styles.hint}>لكل موظف يوزر مستقل داخل شركته. افتراضيًا للموظفين القدامى يمكن استخدام الرقم الوظيفي ورمز 1234 حتى يتم تغييره.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              <Text style={styles.subtitle}>لا يوجد مستخدمون لهذه الشركة. أنشئ أول مسؤول بيوزر ورمز دخول.</Text>
              <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="اسم المسؤول" placeholderTextColor={Colors.textMuted} textAlign="right" />
              <TextInput style={styles.input} value={ownerId} onChangeText={setOwnerId} placeholder="يوزر / الرقم الوظيفي" placeholderTextColor={Colors.textMuted} textAlign="right" autoCapitalize="characters" />
              <TextInput style={styles.input} value={ownerPin} onChangeText={setOwnerPin} placeholder="رمز الدخول" placeholderTextColor={Colors.textMuted} textAlign="right" secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={createOwner} disabled={saving}><Feather name="user-plus" size={16} color="#fff" /><Text style={styles.primaryText}>{saving ? "جاري الإنشاء..." : "إنشاء المسؤول والدخول"}</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.background },
  screen: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: Colors.background },
  card: { gap: 12, backgroundColor: "#fff", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 22, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  subtitle: { fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 21 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  hint: { fontSize: 11, color: Colors.info, textAlign: "center", lineHeight: 18, fontWeight: "700" },
  input: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border, color: Colors.text },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.gold + "18", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { color: Colors.gold, fontSize: 14, fontWeight: "900" },
  switchBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.accent + "12" },
  switchText: { color: Colors.accent, fontSize: 12, fontWeight: "900" },
  list: { gap: 10 },
});
