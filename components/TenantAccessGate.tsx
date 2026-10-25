import { tr } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
import { DEFAULT_TENANT } from "@/constants/platform";
import { tenantAccessText } from "@/constants/tenantAccessTranslations";
import { CompanyTenant, useCompany } from "@/context/CompanyContext";
import { Employee, useEmployee } from "@/context/EmployeeContext";
import { PinChangeModal } from "@/components/PinChangeModal";
import { secureAuthErrorText, secureAuthText } from "@/constants/secureAuthText";
import { secureLogin, secureLogout, secureSetPin, SecureAuthFailure } from "@/lib/secureAuth";
import { showPlatformAlert } from "@/lib/platformAlert";
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
  expiresAt: "2028-12-31T23:59:59.999Z",
  createdAt: new Date().toISOString(),
};

type BootstrapEmployee = Employee & { username?: string; pinCode?: string; isLocalBootstrap?: boolean };

const LAVIVIANE_STATIC_USERS: BootstrapEmployee[] = [
  {
    id: "local-laviviane-trial-lavi001",
    companyId: LAVIVIANE_COMPANY_ID,
    name: "مسؤول لاففيان",
    employeeId: "LAVI001",
    username: "lavi001",
    pinCode: "1234",
    role: "admin",
    permissions: ["*"],
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLocalBootstrap: true,
  },
  {
    id: "local-laviviane-trial-lavi002",
    companyId: LAVIVIANE_COMPANY_ID,
    name: "مسؤول لاففيان",
    employeeId: "LAVI002",
    username: "lavi002",
    pinCode: "1234",
    role: "admin",
    permissions: ["*"],
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLocalBootstrap: true,
  },
];

const NUKHBA_COMPANY_ID = "nukhba-food";

const NUKHBA_TENANT: CompanyTenant = {
  id: NUKHBA_COMPANY_ID,
  name: "النخبة للمأكولات الراقية",
  slug: "nukhba",
  status: "active",
  plan: "starter",
  maxUsers: 5,
  maxInvoicesPerMonth: 800,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NUKHBA_STATIC_USERS: BootstrapEmployee[] = [
  {
    id: "local-nukhba-food-admin001",
    companyId: NUKHBA_COMPANY_ID,
    name: "مدير النخبة",
    employeeId: "NK001",
    username: "nk001",
    pinCode: "5678",
    role: "admin",
    permissions: ["*"],
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLocalBootstrap: true,
  },
  {
    id: "local-nukhba-food-cashier001",
    companyId: NUKHBA_COMPANY_ID,
    name: "كاشير النخبة",
    employeeId: "NK002",
    username: "nk002",
    pinCode: "5678",
    role: "cashier",
    permissions: [],
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLocalBootstrap: true,
  },
  {
    id: "local-nukhba-food-halwa001",
    companyId: NUKHBA_COMPANY_ID,
    name: "موظف الحلويات",
    employeeId: "NK003",
    username: "nk003",
    pinCode: "5678",
    role: "halwa",
    permissions: [],
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLocalBootstrap: true,
  },
  {
    id: "local-nukhba-food-packaging001",
    companyId: NUKHBA_COMPANY_ID,
    name: "موظف التغليف",
    employeeId: "NK004",
    username: "nk004",
    pinCode: "5678",
    role: "packaging",
    permissions: [],
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    isLocalBootstrap: true,
  },
];

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
  const { employees, currentEmployee, setCurrentEmployee, checkAndLogin, addEmployee, isLoading, authMode } = useEmployee();
  const isSecure = authMode === "secure";
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingDeviceConflict, setPendingDeviceConflict] = useState<Employee | null>(null);
  const [pendingPinChange, setPendingPinChange] = useState<{ employee: Employee; pin: string } | null>(null);
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
    if (!ready || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedCompany = params.get("company") || params.get("tenant") || params.get("companyId");
    if (requestedCompany !== LAVIVIANE_COMPANY_ID) return;

    // The QR selects the Laviviane tenant and opens its login screen; employee authentication is still required.
    setUnlocked(true);
    void AsyncStorage.setItem(ACCESS_KEY, "1");
  }, [ready]);

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

  const allUsers = useMemo(() => {
    // Secure mode: the employee list is private until sign-in, and hardcoded accounts never apply.
    if (isSecure) return [] as BootstrapEmployee[];
    const firestoreAndLocal = [...employees, ...localUsers];
    const existingIds = new Set(firestoreAndLocal.map((e) => e.employeeId.toLowerCase()));
    if (company.id === LAVIVIANE_COMPANY_ID) {
      const extras = LAVIVIANE_STATIC_USERS.filter((u) => !existingIds.has(u.employeeId.toLowerCase()));
      return [...firestoreAndLocal, ...extras];
    }
    if (company.id === NUKHBA_COMPANY_ID) {
      const extras = NUKHBA_STATIC_USERS.filter((u) => !existingIds.has(u.employeeId.toLowerCase()));
      return [...firestoreAndLocal, ...extras];
    }
    return firestoreAndLocal;
  }, [employees, localUsers, company.id, isSecure]);
  const employeeCountLabel = useMemo(() => allUsers.length ? `${allUsers.length} ${tx("usersCount")}` : tx("noUsers"), [allUsers.length, lang]);
  const shouldShowBootstrapForm = isSecure || (authMode !== "checking" && (!isLoading || employeeLoadTimedOut || allUsers.length > 0));

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
    showPlatformAlert(tx("trialReadyTitle"), tx("trialReadyMessage"));
  };

  const unlockNukhba = async () => {
    await unlockTenant(NUKHBA_TENANT);
  };

  const unlockByCode = async () => {
    const code = companyCode.trim();
    if (!code) {
      showPlatformAlert(tx("requiredTitle"), tx("companyCodeRequired"));
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

  const finishLogin = async (emp: Employee) => {
    const result = await checkAndLogin(emp);
    if (result === "conflict") {
      setLoginError(null);
      setPendingDeviceConflict(emp);
      return;
    }
    setLoginError(null);
    setPendingDeviceConflict(null);
  };

  const loginEmployeeSecure = async (user: string, pin: string) => {
    setLoggingIn(true);
    setLoginError(null);
    setPendingDeviceConflict(null);
    try {
      const { employee, mustChangePin } = await secureLogin(company.id, user, pin);
      const emp: Employee = {
        ...employee,
        role: employee.role as Employee["role"],
        status: (employee.status as Employee["status"]) ?? "active",
        createdAt: new Date().toISOString(),
      };
      setLoginPin("");
      if (mustChangePin) {
        setPendingPinChange({ employee: emp, pin });
        return;
      }
      await finishLogin(emp);
    } catch (e) {
      const f = e instanceof SecureAuthFailure ? e : null;
      const code = f?.code ?? "server_error";
      setLoginError(code === "invalid_credentials" ? tx("invalidCredentialsMessage") : secureAuthErrorText(code, lang, f?.retryAfter));
    } finally {
      setLoggingIn(false);
    }
  };

  const loginEmployee = async () => {
    const user = normalize(loginId);
    const pin = loginPin.trim();
    setLoginError(null);
    setPendingDeviceConflict(null);
    if (!user || !pin) {
      setLoginError(tx("requiredCredentialsMessage"));
      return;
    }
    if (isSecure) {
      await loginEmployeeSecure(loginId.trim(), pin);
      return;
    }

    const found = allUsers.find((emp) => {
      const empUser = normalize(emp.username || emp.employeeId || "");
      const empId = normalize(emp.employeeId || "");
      const empPin = String(emp.pinCode || "1234");
      return (empUser === user || empId === user) && empPin === pin;
    });

    if (!found) {
      setLoginError(tx("invalidCredentialsMessage"));
      return;
    }

    await finishLogin(found);
  };

  const createOwner = async () => {
    if (!ownerName.trim()) {
      showPlatformAlert(tx("requiredTitle"), tx("ownerNameRequired"));
      return;
    }
    if (!ownerId.trim() || !ownerPin.trim()) {
      showPlatformAlert(tx("requiredTitle"), tx("ownerCredentialsRequired"));
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
      const emp = await addEmployee(ownerPayload);
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
      showPlatformAlert(tx("temporaryLoginTitle"), tx("temporaryLoginMessage"));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <View style={styles.center}><ActivityIndicator color={Colors.gold} /><Text style={styles.muted}>{tx("checking")}</Text></View>;
  }

  if (authMode === "unavailable") {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          <Feather name="shield" size={28} color={Colors.accent} />
          <Text style={styles.title}>{secureAuthText("authUnavailableTitle", lang)}</Text>
          <Text style={styles.subtitle}>{secureAuthText("authUnavailableMessage", lang)}</Text>
        </View>
      </ScrollView>
    );
  }

  const isLaviviane = company.id === LAVIVIANE_COMPANY_ID;

  const unlockLavivianeDirect = async () => {
    setCompanyCode(LAVIVIANE_COMPANY_ID);
    await switchCompanyById(LAVIVIANE_COMPANY_ID);
    await AsyncStorage.setItem(ACCESS_KEY, "1");
    setUnlocked(true);
  };

  if (!unlocked) {
    if (isLaviviane) {
      return (
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.lavivianeGate}>
            {/* Header */}
            <View style={styles.laviBanner}>
              <Image source={{ uri: "/laviviane-logo.png" }} style={styles.laviLogoImg} contentFit="contain" />
              <Text style={styles.laviSub}>Maison de Pâtisserie</Text>
            </View>

            {/* QR Code */}
            <View style={styles.laviQrBox}>
              <Image source={{ uri: "/laviviane-qr.png" }} style={styles.laviQrImg} contentFit="contain" />
              <Text style={styles.laviQrLabel}>{tx("laviQrScanLabel")}</Text>
            </View>

            {/* Direct Entry */}
            <TouchableOpacity style={styles.laviEnterBtn} onPress={unlockLavivianeDirect}>
              <Feather name="log-in" size={18} color="#F2A27A" />
              <Text style={styles.laviEnterText}>{tx("laviEnterBtn")}</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.laviDividerRow}>
              <View style={styles.laviDividerLine} />
              <Text style={styles.laviDividerText}>{tx("laviOrCodeDivider")}</Text>
              <View style={styles.laviDividerLine} />
            </View>

            <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 20 }}>
              <TextInput
                style={[styles.input, { textAlign, backgroundColor: "#FAFAF8" }]}
                value={companyCode}
                onChangeText={setCompanyCode}
                placeholder={tx("companyCodePlaceholder")}
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity style={[styles.primaryBtn, { flexDirection: rowDirection }]} onPress={unlockByCode}>
                <Feather name="log-in" size={16} color="#fff" />
                <Text style={styles.primaryText}>{tx("loginByCode")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>{tx("companyLoginTitle")}</Text>
          <Text style={styles.subtitle}>{tx("companyLoginSubtitle")}</Text>
          <TextInput style={[styles.input, { textAlign }]} value={companyCode} onChangeText={setCompanyCode} placeholder={tx("companyCodePlaceholder")} placeholderTextColor={Colors.textMuted} />
          <TouchableOpacity style={[styles.primaryBtn, { flexDirection: rowDirection }]} onPress={unlockByCode}><Feather name="log-in" size={16} color="#fff" /><Text style={styles.primaryText}>{tx("loginByCode")}</Text></TouchableOpacity>
          {!isSecure && (<>
          <TouchableOpacity style={[styles.secondaryBtn, { flexDirection: rowDirection }]} onPress={unlockNewTrial}><Feather name="star" size={16} color={Colors.gold} /><Text style={styles.secondaryText}>{tx("createTrialCompany")}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { flexDirection: rowDirection }]} onPress={unlockDemo}><Feather name="briefcase" size={16} color={Colors.gold} /><Text style={styles.secondaryText}>{tx("openDemoCompany")}</Text></TouchableOpacity>

          {/* Demo divider */}
          <View style={styles.demoSectionRow}>
            <View style={styles.laviDividerLine} />
            <Text style={styles.demoSectionLabel}>{tr("نماذج حية", "Live demos")}</Text>
            <View style={styles.laviDividerLine} />
          </View>

          {/* Nukhba demo company */}
          <TouchableOpacity style={[styles.nukhbaBtn, { flexDirection: rowDirection }]} onPress={unlockNukhba}>
            <View style={styles.nukhbaIconBox}>
              <Text style={styles.nukhbaIcon}>🍽️</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.nukhbaBtnTitle}>النخبة للمأكولات الراقية</Text>
              <Text style={styles.nukhbaBtnSub}>Nukhba Fine Foods · Starter Plan · كود: nukhba-food</Text>
            </View>
          </TouchableOpacity>
          </>)}
        </View>
      </ScrollView>
    );
  }

  if (!currentEmployee) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.card}>
          {isLaviviane && (
            <>
              <View style={styles.laviBanner}>
                <Image source={{ uri: "/laviviane-logo.png" }} style={styles.laviLogoImg} contentFit="contain" />
                <Text style={styles.laviSub}>Maison de Pâtisserie</Text>
              </View>
              <View style={styles.laviQrBoxSmall}>
                <Image source={{ uri: "/laviviane-qr.png" }} style={styles.laviQrImgSmall} contentFit="contain" />
                <Text style={styles.laviQrLabel}>{tx("laviQrScanAnotherLabel")}</Text>
              </View>
            </>
          )}
          {company.id === NUKHBA_COMPANY_ID && (
            <View style={styles.nukhbaBanner}>
              <Text style={styles.nukhbaBannerTitle}>🍽️ النخبة للمأكولات الراقية</Text>
              <Text style={styles.nukhbaBannerSub}>Nukhba Fine Foods · Starter Plan</Text>
              <View style={styles.nukhbaPillRow}>
                <View style={[styles.nukhbaPill, { backgroundColor: "#2D6E7E18" }]}><Text style={[styles.nukhbaPillTxt, { color: "#2D6E7E" }]}>5 مستخدمين</Text></View>
                <View style={[styles.nukhbaPill, { backgroundColor: "#8C4A5E18" }]}><Text style={[styles.nukhbaPillTxt, { color: "#8C4A5E" }]}>800 فاتورة/شهر</Text></View>
                <View style={[styles.nukhbaPill, { backgroundColor: "#05966918" }]}><Text style={[styles.nukhbaPillTxt, { color: "#059669" }]}>نشط</Text></View>
              </View>
              {!isSecure && <Text style={styles.nukhbaCredLabel}>المستخدمون: NK001–NK004 · رمز: 5678</Text>}
            </View>
          )}
          <TouchableOpacity style={styles.switchBtn} onPress={resetCompany}><Text style={styles.switchText}>{tx("changeCompany")}</Text></TouchableOpacity>
          <Text style={styles.title}>{tx("employeeLoginTitle")}</Text>
          <Text style={styles.subtitle}>{tx("currentCompany")}: {company.name} · {isSecure ? `🔒 ${secureAuthText("secureBadge", lang)}` : employeeCountLabel}</Text>

          {!shouldShowBootstrapForm ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.hint}>{tx("loadingCompanyUsers")}</Text>
            </View>
          ) : isSecure || allUsers.length > 0 ? (
            <View style={styles.list}>
              {employeeLoadTimedOut ? <Text style={styles.warningText}>{tx("firestoreTimeout")}</Text> : null}
              <TextInput style={[styles.input, { textAlign }]} value={loginId} onChangeText={(value) => { setLoginId(value); setLoginError(null); }} editable={!pendingDeviceConflict} placeholder={tx("employeeLoginPlaceholder")} placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
              <TextInput style={[styles.input, { textAlign }]} value={loginPin} onChangeText={(value) => { setLoginPin(value); setLoginError(null); }} editable={!pendingDeviceConflict} placeholder={tx("pinPlaceholder")} placeholderTextColor={Colors.textMuted} secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={[styles.primaryBtn, { flexDirection: rowDirection }, (loggingIn || pendingDeviceConflict) && { opacity: 0.6 }]} onPress={loginEmployee} disabled={loggingIn || !!pendingDeviceConflict}>{loggingIn ? <ActivityIndicator color="#fff" /> : <Feather name="unlock" size={16} color="#fff" />}<Text style={styles.primaryText}>{tx("employeeLoginButton")}</Text></TouchableOpacity>
              {loginError ? <Text style={styles.errorText} accessibilityRole="alert">{loginError}</Text> : null}
              {pendingDeviceConflict ? (
                <View style={styles.conflictCard} accessibilityRole="alert">
                  <Text style={styles.conflictTitle}>{tx("deviceConflictTitle")}</Text>
                  <Text style={styles.conflictMessage}>{`"${pendingDeviceConflict.name}" ${tx("deviceConflictMessage")}`}</Text>
                  <View style={[styles.conflictActions, { flexDirection: rowDirection }]}>
                    <TouchableOpacity
                      style={styles.conflictCancelBtn}
                      onPress={() => {
                        setPendingDeviceConflict(null);
                        if (isSecure) void secureLogout();
                      }}
                    >
                      <Text style={styles.conflictCancelText}>{tx("deviceConflictCancel")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.conflictForceBtn}
                      onPress={async () => {
                        const employee = pendingDeviceConflict;
                        if (!employee) return;
                        setPendingDeviceConflict(null);
                        try {
                          await checkAndLogin(employee, true);
                        } catch {
                          setLoginError(secureAuthErrorText("server_error", lang));
                          if (isSecure) void secureLogout();
                        }
                      }}
                    >
                      <Text style={styles.conflictForceText}>{tx("deviceConflictForce")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              {isSecure
                ? <Text style={styles.hint}>{secureAuthText("forgotPin", lang)}</Text>
                : <Text style={styles.hint}>{tx("employeeLoginHint")}</Text>}
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
        <PinChangeModal
          visible={!!pendingPinChange}
          mode="self"
          forced
          knownCurrentPin={pendingPinChange?.pin}
          onSubmit={async (newPin, currentPin) => {
            await secureSetPin({ newPin, currentPin });
            const emp = pendingPinChange!.employee;
            setPendingPinChange(null);
            await finishLogin(emp);
          }}
          onCancel={() => { setPendingPinChange(null); void secureLogout(); }}
        />
      </ScrollView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.background },
  screen: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: "#F3F3F1" },
  card: { gap: 12, backgroundColor: "#fff", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: Colors.border },

  // Laviviane gate
  lavivianeGate: {
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 0,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#161616",
    shadowColor: "#161616",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  laviBanner: {
    backgroundColor: "#161616",
    alignItems: "center",
    paddingTop: 22,
    paddingBottom: 14,
    paddingHorizontal: 20,
    gap: 6,
  },
  laviLogoImg: { width: 180, height: 68 },
  laviSub: { color: "#F2A27A", fontSize: 11, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase" as const },

  laviQrBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  laviQrImg: {
    width: 190,
    height: 190,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E2DE",
  },
  laviQrLabel: { color: "#7a6550", fontSize: 12, fontWeight: "700", textAlign: "center" },

  laviQrBoxSmall: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E2DE",
  },
  laviQrImgSmall: {
    width: 130,
    height: 130,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E2DE",
  },

  laviEnterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: "#161616",
    borderRadius: 14,
    paddingVertical: 14,
  },
  laviEnterText: { color: "#F2A27A", fontSize: 16, fontWeight: "900" },

  laviDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  laviDividerLine: { flex: 1, height: 1, backgroundColor: "#E2E2DE" },
  laviDividerText: { color: "#b8a090", fontSize: 11, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  subtitle: { fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 21 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  hint: { fontSize: 11, color: Colors.info, textAlign: "center", lineHeight: 18, fontWeight: "700" },
  warningText: { fontSize: 11, color: Colors.accent, textAlign: "center", lineHeight: 18, fontWeight: "800" },
  input: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#FAFAF8", borderWidth: 1, borderColor: Colors.border, color: Colors.text },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  errorText: { color: Colors.accent, fontSize: 13, textAlign: "center", lineHeight: 19, fontWeight: "700" },
  conflictCard: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: Colors.info + "10", borderWidth: 1, borderColor: Colors.info + "45" },
  conflictTitle: { color: Colors.primary, fontSize: 14, fontWeight: "900", textAlign: "center" },
  conflictMessage: { color: Colors.text, fontSize: 12, lineHeight: 19, textAlign: "center" },
  conflictActions: { gap: 8 },
  conflictCancelBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  conflictCancelText: { color: Colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" },
  conflictForceBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  conflictForceText: { color: "#fff", fontSize: 12, fontWeight: "800", textAlign: "center" },
  secondaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: Colors.gold + "18", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { color: Colors.gold, fontSize: 14, fontWeight: "900" },
  switchBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.accent + "12" },
  switchText: { color: Colors.accent, fontSize: 12, fontWeight: "900" },
  list: { gap: 10 },
  loadingBox: { gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 20 },

  // Demo section divider
  demoSectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  demoSectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  // Nukhba demo company button
  nukhbaBtn: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2D6E7E30",
    backgroundColor: "#2D6E7E08",
  },
  nukhbaIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#2D6E7E18", alignItems: "center", justifyContent: "center",
  },
  nukhbaIcon: { fontSize: 18 },
  nukhbaBtnTitle: { fontSize: 13, fontWeight: "800", color: Colors.text },
  nukhbaBtnSub: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },

  // Nukhba banner (shown on employee login screen)
  nukhbaBanner: {
    backgroundColor: "#2D6E7E08",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2D6E7E30",
    padding: 14,
    gap: 6,
  },
  nukhbaBannerTitle: { fontSize: 15, fontWeight: "900", color: "#2D6E7E", textAlign: "center" },
  nukhbaBannerSub: { fontSize: 11, color: "#2D6E7E80", textAlign: "center", fontWeight: "600" },
  nukhbaPillRow: { flexDirection: "row", gap: 6, justifyContent: "center", flexWrap: "wrap" },
  nukhbaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  nukhbaPillTxt: { fontSize: 10, fontWeight: "700" },
  nukhbaCredLabel: { fontSize: 10, color: Colors.textMuted, textAlign: "center", fontWeight: "600" },
});
