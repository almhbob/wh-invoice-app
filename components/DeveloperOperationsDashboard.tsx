import { Feather } from "@expo/vector-icons";
import React from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { RELEASE_INFO } from "@/constants/releaseInfo";

type OpsStatus = "ready" | "warning" | "manual";

interface OpsItem {
  title: string;
  description: string;
  status: OpsStatus;
  icon: keyof typeof Feather.glyphMap;
}

const PRODUCTION_LINKS = [
  { label: "فتح النظام", url: "https://fawtara.sawihasa.digital", icon: "external-link" as const },
  { label: "صفحة التشخيص", url: "https://fawtara.sawihasa.digital/diagnostics", icon: "activity" as const },
  { label: "Health Check", url: "https://fawtara.sawihasa.digital/healthz", icon: "heart" as const },
  { label: "Railway", url: "https://railway.com/dashboard", icon: "upload-cloud" as const },
];

const OPS_ITEMS: OpsItem[] = [
  {
    title: "النشر والتشخيص",
    description: "راجع /diagnostics بعد كل Redeploy وتأكد من static-build و index.html ومتغيرات Firebase.",
    status: "ready",
    icon: "server",
  },
  {
    title: "الفروع والطلبات اليومية",
    description: "تابع طلبية الفرع اليومية والجرد والمرتجع والإكسباير من صفحة الفروع.",
    status: "ready",
    icon: "git-branch",
  },
  {
    title: "Firebase الإنتاجي",
    description: "أضف متغيرات Firebase في Railway وانشر firestore.rules و storage.rules قبل تشغيل شركات حقيقية.",
    status: "warning",
    icon: "database",
  },
  {
    title: "حماية لوحة المطور",
    description: "اللوحة مخفية من قائمة المستخدمين، ولا تفتح إلا بالرمز ولا يُحفظ فتحها بعد تحديث الصفحة.",
    status: "ready",
    icon: "lock",
  },
  {
    title: "إدارة الاشتراكات",
    description: "راجع الشركات التجريبية، حالات الاشتراك، روابط السداد، ومزايا الباقات من لوحات الاشتراك أدناه.",
    status: "manual",
    icon: "credit-card",
  },
  {
    title: "الأمان النهائي",
    description: "عند الإنتاج عطّل الحسابات الاحتياطية demo/admin واربط الموظفين بـ Firebase Auth و companyId و role.",
    status: "warning",
    icon: "shield",
  },
];

const CHECKLIST = [
  "إعادة نشر Railway بعد كل commit مهم.",
  "اختبار دخول الشركة ثم دخول الموظف وعدم الخروج التلقائي.",
  "اختبار قفل المطور بالرمز بعد تحديث الصفحة.",
  "اختبار طلبية الفرع اليومية وحفظ جرد اليوم.",
  "اختبار إنشاء فاتورة ومرتجع وإكسباير وتالف.",
  "مراجعة صفحة التشخيص قبل عرض النظام على عميل.",
];

function statusStyle(status: OpsStatus) {
  if (status === "ready") return { label: "جاهز", color: Colors.success, icon: "check-circle" as const };
  if (status === "warning") return { label: "يتطلب ضبط", color: Colors.accent, icon: "alert-triangle" as const };
  return { label: "يدوي", color: Colors.gold, icon: "tool" as const };
}

function openUrl(url: string) {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  Linking.openURL(url).catch(() => undefined);
}

export function DeveloperOperationsDashboard() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="command" size={22} color={Colors.gold} />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>مركز عمليات المطور</Text>
          <Text style={styles.subtitle}>لوحة مختصرة لإدارة التشغيل، النشر، الاشتراكات، الفروع، والأمان.</Text>
        </View>
      </View>

      <View style={styles.releaseBox}>
        <Text style={styles.releaseLabel}>الإصدار الحالي</Text>
        <Text style={styles.releaseVersion}>{RELEASE_INFO.version}</Text>
        <Text style={styles.releaseHint}>{RELEASE_INFO.latestRequiredCommitHint}</Text>
      </View>

      <View style={styles.linksGrid}>
        {PRODUCTION_LINKS.map((link) => (
          <TouchableOpacity key={link.url} style={styles.linkBtn} onPress={() => openUrl(link.url)} activeOpacity={0.85}>
            <Feather name={link.icon} size={15} color={Colors.primary} />
            <Text style={styles.linkText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.opsGrid}>
        {OPS_ITEMS.map((item) => {
          const st = statusStyle(item.status);
          return (
            <View key={item.title} style={styles.opsItem}>
              <View style={styles.opsTopRow}>
                <View style={[styles.opsIcon, { backgroundColor: st.color + "14" }]}>
                  <Feather name={item.icon} size={17} color={st.color} />
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.color + "14" }]}>
                  <Feather name={st.icon} size={11} color={st.color} />
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={styles.opsTitle}>{item.title}</Text>
              <Text style={styles.opsDescription}>{item.description}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.checklistBox}>
        <Text style={styles.sectionTitle}>قائمة فحص قبل تسليم النظام</Text>
        {CHECKLIST.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Feather name="check" size={14} color={Colors.success} />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gold + "18" },
  headerTextBlock: { flex: 1, gap: 3 },
  title: { fontSize: 20, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 19, fontWeight: "600" },
  releaseBox: { borderRadius: 18, padding: 14, backgroundColor: Colors.primary + "08", borderWidth: 1, borderColor: Colors.primary + "18", gap: 4 },
  releaseLabel: { fontSize: 11, fontWeight: "900", color: Colors.textMuted, textAlign: "right" },
  releaseVersion: { fontSize: 16, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  releaseHint: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },
  linksGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  linkBtn: { minHeight: 42, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  linkText: { fontSize: 12, fontWeight: "900", color: Colors.primary },
  opsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  opsItem: { flexGrow: 1, flexBasis: 220, gap: 8, borderRadius: 18, padding: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  opsTopRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  opsIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  statusBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "900" },
  opsTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  opsDescription: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, fontWeight: "600" },
  checklistBox: { gap: 8, borderRadius: 18, padding: 12, backgroundColor: Colors.success + "08", borderWidth: 1, borderColor: Colors.success + "22" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.primary, textAlign: "right", marginBottom: 2 },
  checkRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  checkText: { flex: 1, fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, fontWeight: "700" },
});
