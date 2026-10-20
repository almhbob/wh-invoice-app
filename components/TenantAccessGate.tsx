import { Feather } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useCompany } from "@/context/CompanyContext";
import { useLang } from "@/context/LanguageContext";
import { useTenantAuth } from "@/context/TenantAuthContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export function TenantAccessGate({ children }: { children: React.ReactNode }) {
  const { lang, isRTL } = useLang();
  const ar = lang === "ar";
  const { companyId } = useCompany();
  const { identity, isLoading, error, login } = useTenantAuth();
  const online = useNetworkStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  if (!isFirebaseConfigured) return <View style={styles.loading}><Text style={styles.subtitle}>{ar ? "إعداد الاتصال بالخادم غير مكتمل. على المسؤول ضبط متغيرات Firebase في بيئة البناء." : "Server connection is not configured. The administrator must configure Firebase build variables."}</Text></View>;
  if (isLoading) return <View style={styles.loading}><ActivityIndicator color="#897443" /></View>;
  if (identity && identity.companyId === companyId) return <>{children}</>;

  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setLoginError(null);
    try {
      await login(email, password);
      setPassword("");
    } catch (failure) {
      const code = (failure as { code?: string }).code;
      setLoginError(code === "auth/network-request-failed"
        ? (ar ? "تعذر الاتصال. تسجيل الدخول الأول يحتاج إلى الإنترنت." : "Cannot connect. Initial sign-in requires internet.")
        : (ar ? "تعذر تسجيل الدخول. تحقق من بيانات الحساب أو تواصل مع مسؤول الشركة." : "Unable to sign in. Check your credentials or contact your company administrator."));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (busy) return;
    if (!email.trim()) {
      setLoginError(ar ? "أدخل بريد حسابك أولًا." : "Enter your account email first.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        ar ? "استعادة كلمة المرور" : "Password recovery",
        ar ? "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة استعادة كلمة المرور." : "If this email belongs to an account, a password reset email will be sent.",
      );
    } catch {
      setLoginError(ar ? "تعذر إرسال طلب الاستعادة. تحقق من الاتصال وحاول مجددًا." : "Unable to request recovery. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const verificationError = error === "AUTH_MEMBERSHIP_NOT_CONFIGURED"
    ? (ar ? "هذا الحساب لم يُربط بملف موظف وشركة بعد. اطلب من المسؤول تهيئته." : "This account has not been assigned to an employee and company. Ask your administrator to provision it.")
    : error
      ? (ar ? "تعذر التحقق من الجلسة. أعد تسجيل الدخول؛ طلباتك المحلية محفوظة." : "Session verification failed. Sign in again; your local orders are preserved.")
      : null;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.mark}><Feather name="shield" size={24} color="#897443" /></View>
          <Text style={styles.eyebrow}>{ar ? "مساحة عمل الشركة" : "COMPANY WORKSPACE"}</Text>
          <Text style={styles.title}>{ar ? "تسجيل الدخول" : "Sign in"}</Text>
          <Text style={styles.subtitle}>{ar ? "ادخل بحساب الموظف المعتمد. تُحدد شركتك وصلاحياتك تلقائيًا." : "Use your assigned employee account. Your company and permissions are selected automatically."}</Text>
          {!online && <Text style={styles.notice}>{ar ? "أنت غير متصل. يمكن متابعة العمل دون إنترنت من جلسة سابقة موثّقة على هذا الجهاز، لمدة تصل إلى 72 ساعة." : "You are offline. An already verified session on this device can continue for up to 72 hours."}</Text>}
          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{ar ? "البريد الإلكتروني" : "Email"}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="name@company.com" placeholderTextColor="#95918A" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" editable={!busy} />
          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{ar ? "كلمة المرور" : "Password"}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" editable={!busy} onSubmitEditing={() => { void submit(); }} />
          {(loginError || verificationError) && <Text accessibilityRole="alert" style={styles.error}>{loginError || verificationError}</Text>}
          <TouchableOpacity accessibilityRole="button" style={[styles.button, (busy || !email.trim() || !password) && styles.disabled]} disabled={busy || !email.trim() || !password} onPress={() => { void submit(); }}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{ar ? "دخول إلى النظام" : "Continue"}</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void resetPassword(); }}><Text style={styles.reset}>{ar ? "نسيت كلمة المرور؟" : "Forgot password?"}</Text></TouchableOpacity>
          <View style={styles.footer}><Feather name="lock" size={13} color="#77746D" /><Text style={styles.footerText}>{ar ? "لا توجد حسابات افتراضية أو دخول تجريبي إلى بيانات الشركة." : "No default accounts or demo access to company data."}</Text></View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F4EF" },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F4EF" },
  card: { width: "100%", maxWidth: 430, padding: 28, borderRadius: 16, borderWidth: 1, borderColor: "#E8E3D8", backgroundColor: "#FFF" },
  mark: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#F5F1E6", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  eyebrow: { textAlign: "center", color: "#897443", fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  title: { textAlign: "center", color: "#25241F", fontSize: 28, fontWeight: "700", marginBottom: 10 },
  subtitle: { textAlign: "center", color: "#77746D", fontSize: 14, lineHeight: 23, marginBottom: 24 },
  label: { color: "#46443D", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#DCD8CE", backgroundColor: "#FDFCF9", borderRadius: 8, padding: 13, color: "#25241F", fontSize: 15, marginBottom: 18, textAlign: "left" },
  notice: { backgroundColor: "#FFF6DA", color: "#78622D", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 21, marginBottom: 18 },
  error: { color: "#A03D38", fontSize: 13, lineHeight: 21, marginBottom: 16, textAlign: "center" },
  button: { backgroundColor: "#302B23", minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#FFF", fontWeight: "600", fontSize: 15 },
  reset: { color: "#897443", textAlign: "center", paddingVertical: 18, fontSize: 13 },
  footer: { borderTopWidth: 1, borderTopColor: "#EEEAE1", paddingTop: 18, flexDirection: "row", gap: 8, alignItems: "center" },
  footerText: { flex: 1, color: "#77746D", fontSize: 11, lineHeight: 18, textAlign: "center" },
});
