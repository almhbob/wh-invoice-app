import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { DEFAULT_TENANT } from "@/constants/platform";
import { tenantAccessText } from "@/constants/tenantAccessTranslations";
import { CompanyTenant, useCompany } from "@/context/CompanyContext";
import { Employee, useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";

const ACCESS_KEY = "@fawtara_access_gate_v1";
const BOOTSTRAP_USERS_KEY = "@fawtara_bootstrap_users_v1";
const EMPLOYEE_LOAD_TIMEOUT_MS = 4500;

const DEMO_TENANT: CompanyTenant = {
  id: DEFAULT_TENANT.id,
  name: DEFAULT_TENANT.name,
  slug: DEFAULT_TENANT.slug,
  status: "active",
  plan: "business",
  maxUsers: 25,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NEW_TRIAL_TENANT: CompanyTenant = {
  id: "new-trial-company",
  name: "الشركة الجديدة التجريبية",
  slug: "new-trial-company",
  status: "trial",
  plan: "business",
  maxUsers: 25,
  maxInvoicesPerMonth: 1000,
  expiresAt: "2026-06-30T23:59:59.999Z",
  createdAt: new Date().toISOString(),
};

type BootstrapEmployee = Employee & { username?: string; pinCode?: string; isLocalBootstrap?: boolean };

const NEW_TRIAL_USER: BootstrapEmployee = {
  id: "local-new-trial-company-trial-admin",
  companyId: NEW_TRIAL_TENANT.id,
  name: "مسؤول الشركة التجريبية",
  employeeId: "TRIAL001",
  username: "trial",
  pinCode: "1234",
  role: "admin",
  permissions: ["*"],
  createdAt: new Date().toISOString(),
  isLocalBootstrap: true,
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function bootstrapKey(companyId: string) {
  return `${BOOTSTRAP_USERS_KEY}_${companyId}`;
}

export function TenantAccessGate({ children }: { children: React.ReactNode }) {
  const { lang, isRTL } = useLang();
  const tx = (key: Parameters<typeof tenantAccessText>[0]) => tenantAccessText(key, lang);
  const textAlign = isRTL ? "right" : "left";
  const rowDirection = isRTL ? "row-reverse" : "row";
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
  const [localUsers, setLocalUsers] = useState<BootstrapEmployee[]>([]);
  const [employeeLoadTimedOut, setEmployeeLoadTimedOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(ACCESS_KEY)
      .then((value) => mounted && setUnlocked(value === "1"))
      .finally(() => mounted && setReady(true));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(bootstrapKey(company.id))
      .then((raw) => {
        if (!mounted) return;
        setLocalUsers(raw ? JSON.parse(raw) : []);
      })
      .catch(() => mounted && setLocalUsers([]));
    return () => { mounted = false; };
  }, [company.id]);

  useEffect(() => {
    setEmployeeLoadTimedOut(false);
    if (!unlocked || !isLoading) return;
    const timer = setTimeout(() => setEmployeeLoadTimedOut(true), EMPLOYEE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [unlocked, isLoading, company.id]);

  const allUsers = useMemo(() => [...employees, ...localUsers], [employees, localUsers]);
  const employeeCountLabel = useMemo(() => allUsers.length ? `${allUsers.length} ${tx("usersCount")}` : tx("noUsers"), [allUsers.length, lang]);
  const shouldShowBootstrapForm = !isLoading || employeeLoadTimedOut || allUsers.length > 0;

  const saveLocalUser = async (employee: BootstrapEmployee) => {
    const next = [employee, ...localUsers.filter((u) => u.employeeId !== employee.employeeId)];
    setLocalUsers(next);
    await AsyncStorage.setItem(bootstrapKey(company.id), JSON.stringify(next));
  };

  const unlockTenant = async (tenant: CompanyTenant, seedUser?: BootstrapEmployee) => {
    await setCompany(tenant);
    if (seedUser) {
      const key = bootstrapKey(tenant.id);
      const raw = await AsyncStorage.getItem(key);
      const existing: BootstrapEmployee[] = raw ? JSON.parse(raw) : [];
      const next = [seedUser, ...existing.filter((u) => u.employeeId !== seedUser.employeeId)];
      await AsyncStorage.setItem(key, JSON.stringify(next));
      setLocalUsers(next);
      setLoginId(seedUser.username || seedUser.employeeId);
      setLoginPin(seedUser.pinCode || "1234");
    }
    await AsyncStorage.setItem(ACCESS_KEY, "1");
    setUnlocked(true);
  };

  const unlockDemo = async () => {
    await unlockTenant(DEMO_TENANT);
  };

  const unlockNewTrial = async () => {
    await unlockTenant(NEW_TRIAL_TENANT, NEW_TRIAL_USER);
    Alert.alert(tx("trialReadyTitle"), tx("trialReadyMessage"));
  };

  const unlockByCode = async () => {
    const code = companyCode.trim();
    if (!code) {
      Alert.alert(tx("requiredTitle"), tx("companyCodeRequired"));
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
      Alert.alert(tx("requiredTitle"), tx("requiredCredentialsMessage"));
      return;
    }

    const found = allUsers.find((emp) => {
      const empUser = normalize((emp as any).username || emp.employeeId || "");
      const empId = normalize(emp.employeeId || "");
      const empPin = String((emp as any).pinCode || "1234");
      return (empUser === user || empId === user) && empPin === pin;
    });

    if (!found) {
      Alert.alert(tx("invalidCredentialsTitle"), tx("invalidCredentialsMessage"));
      return;
    }

    await setCurrentEmployee(found);
  };

  const createOwner = async () => {
    if (!ownerName.trim()) {
      Alert.alert(tx("requiredTitle"), tx("ownerNameRequired"));
      return;
    }
    if (!ownerId.trim() || !ownerPin.trim()) {
      Alert.alert(tx("requiredTitle"), tx("ownerCredentialsRequired"));
      return;
    }
    setSaving(true);
    const ownerPayload = {
      name: ownerName.trim(),
      employeeId: ownerId.trim().toUpperCase(),
      username: ownerId.trim().toLowerCase(),
      pinCode: ownerPin.trim(),
      role: "admin" as const,
    };

    try {
      const emp = await addEmployee(ownerPayload as any);
      await setCurrentEmployee(emp);
    } catch (error) {
      console.error("Create owner failed; using local bootstrap user", error);
      const localOwner: BootstrapEmployee = {
        id: `local-${company.id}-${ownerPayload.employeeId}`,
        companyId: company.id,
        ...ownerPayload,
        permissions: ["*"],
        createdAt: new Date().toISOString(),
        isLocalBootstrap: true,
      };
      await saveLocalUser(localOwner);
      await setCurrentEmployee(localOwner);
      Alert.alert(tx("temporaryLoginTitle"), tx("temporaryLoginMessage"));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <View style={styles.center}><ActivityIndicator color={Colors.gold} /><Text style={styles.muted}>{tx("checking")}</Text></View>;
  }

  if (!unlocked) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>{tx("companyLoginTitle")}</Text>
          <Text style={styles.subtitle}>{tx("companyLoginSubtitle")}</Text>
          <TextInput style={[styles.input, { textAlign }]} value={companyCode} onChangeText={setCompanyCode} placeholder={tx("companyCodePlaceholder")} placeholderTextColor={Colors.textMuted} />
          <TouchableOpacity style={[styles.primaryBtn, { flexDirection: rowDirection }]} onPress={unlockByCode}><Feather name="log-in" size={16} color="#fff" /><Text style={styles.primaryText}>{tx("loginByCode")}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { flexDirection: rowDirection }]} onPress={unlockNewTrial}><Feather name="star" size={16} color={Colors.gold} /><Text style={styles.secondaryText}>{tx("createTrialCompany")}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { flexDirection: rowDirection }]} onPress={unlockDemo}><Feather name="briefcase" size={16} color={Colors.gold} /><Text style={styles.secondaryText}>{tx("openDemoCompany")}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!currentEmployee) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.switchBtn} onPress={resetCompany}><Text style={styles.switchText}>{tx("changeCompany")}</Text></TouchableOpacity>
          <Text style={styles.title}>{tx("employeeLoginTitle")}</Text>
          <Text style={styles.subtitle}>{tx("currentCompany")}: {company.name} · {employeeCountLabel}</Text>

          {!shouldShowBootstrapForm ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.hint}>{tx("loadingCompanyUsers")}</Text>
            </View>
          ) : allUsers.length > 0 ? (
            <View style={styles.list}>
              {employeeLoadTimedOut ? <Text style={styles.warningText}>{tx("firestoreTimeout")}</Text> : null}
              <TextInput style={[styles.input, { textAlign }]} value={loginId} onChangeText={setLoginId} placeholder={tx("employeeLoginPlaceholder")} placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
              <TextInput style={[styles.input, { textAlign }]} value={loginPin} onChangeText={setLoginPin} placeholder={tx("pinPlaceholder")} placeholderTextColor={Colors.textMuted} secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={[styles.primaryBtn, { flexDirection: rowDirection }]} onPress={loginEmployee}><Feather name="unlock" size={16} color="#fff" /><Text style={styles.primaryText}>{tx("employeeLoginButton")}</Text></TouchableOpacity>
              <Text style={styles.hint}>{tx("employeeLoginHint")}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {employeeLoadTimedOut ? <Text style={styles.warningText}>{tx("firestoreTimeout")}</Text> : null}
              <Text style={styles.subtitle}>{tx("createOwnerTitle")}</Text>
              <TextInput style={[styles.input, { textAlign }]} value={ownerName} onChangeText={setOwnerName} placeholder={tx("ownerNamePlaceholder")} placeholderTextColor={Colors.textMuted} />
              <TextInput style={[styles.input, { textAlign }]} value={ownerId} onChangeText={setOwnerId} placeholder={tx("ownerIdPlaceholder")} placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
              <TextInput style={[styles.input, { textAlign }]} value={ownerPin} onChangeText={setOwnerPin} placeholder={tx("pinPlaceholder")} placeholderTextColor={Colors.textMuted} secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }, { flexDirection: rowDirection }]} onPress={createOwner} disabled={saving}><Feather name="user-plus" size={16} color="#fff" /><Text style={styles.primaryText}>{saving ? tx("creating") : tx("ownerCreateButton")}</Text></TouchableOpacity>
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
  warningText: { fontSize: 11, color: Colors.accent, textAlign: "center", lineHeight: 18, fontWeight: "800" },
  input: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border, color: Colors.text },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.gold + "18", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { color: Colors.gold, fontSize: 14, fontWeight: "900" },
  switchBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.accent + "12" },
  switchText: { color: Colors.accent, fontSize: 12, fontWeight: "900" },
  list: { gap: 10 },
  loadingBox: { gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
});
