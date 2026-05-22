import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

const WORKFLOW_STEPS = [
  {
    title: "1. إنشاء الطلبية",
    description: "الفرع يحدد المنتجات والكميات اليومية المطلوبة من المصنع. مقدم الطلب يُسجل من اليوزر الحالي عند إنشاء الطلبية.",
    icon: "clipboard" as const,
  },
  {
    title: "2. تجهيز المصنع",
    description: "المصنع يراجع الطلبية ويجهز المنتجات، ثم يتم تحديث الحالة إلى قيد التجهيز أو تم التوفير.",
    icon: "truck" as const,
  },
  {
    title: "3. استلام الفرع",
    description: "عند وصول الطلبية، يسجل الفرع ما وصل مطابقًا وما هو ناقص. وقت الاستلام والمستلم يتم تسجيلهما تلقائيًا.",
    icon: "check-square" as const,
  },
  {
    title: "4. جرد نهاية اليوم",
    description: "الفرع يسجل بداية اليوم، الوارد، البيع، المرتجع، الإكسباير، التالف، والجرد الفعلي لحساب الفرق تلقائيًا.",
    icon: "bar-chart-2" as const,
  },
];

const RULES = [
  "لا تُسجل طلبية جديدة قبل التأكد من طلبية اليوم السابقة.",
  "أي نقص في الاستلام يجب توضيحه نصيًا في خانة النواقص.",
  "الجرد الفعلي في نهاية اليوم هو المرجع النهائي للمتوفر والخلصان.",
  "عند تفعيل Firebase الإنتاجي ستصبح السجلات مركزية بين الفرع والمصنع والإدارة.",
];

export function BranchWorkflowGuidePanel() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="map" size={20} color={Colors.primary} />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>سير عمل الفرع اليومي</Text>
          <Text style={styles.subtitle}>ترتيب واضح لاستخدام الطلبية، الاستلام، والجرد حتى لا تختلط البيانات اليومية.</Text>
        </View>
      </View>

      <View style={styles.stepsGrid}>
        {WORKFLOW_STEPS.map((step) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIcon}>
                <Feather name={step.icon} size={16} color={Colors.primary} />
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
            </View>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.rulesBox}>
        <Text style={styles.rulesTitle}>ضوابط تشغيل مهمة</Text>
        {RULES.map((rule) => (
          <View key={rule} style={styles.ruleRow}>
            <Feather name="check" size={13} color={Colors.success} />
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  headerRow: { flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary + "12" },
  headerTextBlock: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, fontWeight: "600", color: Colors.textMuted, textAlign: "right", lineHeight: 19 },
  stepsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stepCard: { flexGrow: 1, flexBasis: 220, gap: 8, borderRadius: 18, padding: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  stepHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  stepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary + "10" },
  stepTitle: { flex: 1, fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  stepDescription: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, fontWeight: "700" },
  rulesBox: { gap: 8, borderRadius: 18, padding: 12, backgroundColor: Colors.success + "08", borderWidth: 1, borderColor: Colors.success + "22" },
  rulesTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  ruleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  ruleText: { flex: 1, fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, fontWeight: "700" },
});
