import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { firebaseConfigDiagnostics, isFirebaseConfigured } from "@/lib/firebase";

interface CheckItem {
  id: string;
  titleAr: string;
  descriptionAr: string;
  ok: boolean;
  actionAr: string;
}

export function ProductionReadinessPanel() {
  const checks: CheckItem[] = [
    {
      id: "firebase_config",
      titleAr: "إعدادات Firebase",
      descriptionAr: isFirebaseConfigured
        ? "كل متغيرات Firebase الأساسية موجودة."
        : `متغيرات ناقصة: ${firebaseConfigDiagnostics.missingKeys.join(", ")}`,
      ok: isFirebaseConfigured,
      actionAr: "أكمل متغيرات EXPO_PUBLIC_FIREBASE_* في Vercel ثم أعد النشر بدون كاش.",
    },
    {
      id: "auth_claims",
      titleAr: "Firebase Auth و Claims",
      descriptionAr: "القواعد الأمنية تعتمد على request.auth و companyId/platformRole داخل claims.",
      ok: false,
      actionAr: "اربط كل موظف بحساب Firebase Auth وأضف claims للشركة والدور قبل الإنتاج.",
    },
    {
      id: "bootstrap_mode",
      titleAr: "Bootstrap المحلي",
      descriptionAr: "يوجد دخول محلي مؤقت لتجاوز تعطل Firestore أثناء التجربة.",
      ok: false,
      actionAr: "اجعله مقصورًا على بيئة التطوير أو أزله بعد تفعيل Auth.",
    },
    {
      id: "storage_rules",
      titleAr: "قواعد Storage",
      descriptionAr: "تمت إضافة قواعد لعقود وصور الشركات، لكنها تحتاج نشرًا في Firebase Console.",
      ok: true,
      actionAr: "انشر storage.rules وتأكد من Storage Bucket.",
    },
  ];

  const failedCount = checks.filter((item) => !item.ok).length;

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <View style={[styles.iconBox, { backgroundColor: failedCount ? Colors.accent + "18" : Colors.success + "18" }]}>
          <Feather name={failedCount ? "alert-triangle" : "shield"} size={18} color={failedCount ? Colors.accent : Colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>فحص جاهزية الإنتاج</Text>
          <Text style={styles.subtitle}>{failedCount ? `${failedCount} نقاط حرجة قبل الإنتاج` : "النظام جاهز من ناحية الفحوص الحالية"}</Text>
        </View>
      </View>

      {checks.map((item) => (
        <View key={item.id} style={styles.checkCard}>
          <View style={styles.checkHead}>
            <Feather name={item.ok ? "check-circle" : "x-circle"} size={15} color={item.ok ? Colors.success : Colors.accent} />
            <Text style={styles.checkTitle}>{item.titleAr}</Text>
          </View>
          <Text style={styles.checkDesc}>{item.descriptionAr}</Text>
          <Text style={[styles.action, { color: item.ok ? Colors.info : Colors.accent }]}>{item.actionAr}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  checkCard: { gap: 6, padding: 11, borderRadius: 14, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  checkHead: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  checkTitle: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  checkDesc: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 17 },
  action: { fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 17 },
});
