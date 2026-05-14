import React, { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import {
  COMPANY_SUBSCRIPTION_PLANS,
  DEMO_COMPANY_SUBSCRIPTIONS,
  DEMO_SERVICE_APPLICATIONS,
  SYSTEM_FEATURES,
  CompanyPlanKey,
  CompanySubscriptionRecord,
  SystemFeatureKey,
  featureByKey,
  planByKey,
  visibleFeaturesForCompany,
} from "@/constants/companySubscriptions";

function price(n: number) {
  return `${n.toLocaleString("ar-SA")} ر.س`;
}

function Pill({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.pill, { backgroundColor: color + "18", color }]}>{text}</Text>;
}

export function CompanySubscriptionsPanel() {
  const [subscriptions, setSubscriptions] = useState<CompanySubscriptionRecord[]>(DEMO_COMPANY_SUBSCRIPTIONS);
  const [selectedPlan, setSelectedPlan] = useState<CompanyPlanKey>("business");
  const [contractUrl, setContractUrl] = useState("");
  const [contractFileName, setContractFileName] = useState("");

  const activeSub = subscriptions[0];
  const activePlan = planByKey(activeSub.planKey);
  const visibleFeatures = useMemo(() => visibleFeaturesForCompany(activeSub), [activeSub]);

  const toggleFeature = (featureKey: SystemFeatureKey) => {
    setSubscriptions((prev) => prev.map((sub, idx) => {
      if (idx !== 0) return sub;
      const isHidden = sub.hiddenFeatures.includes(featureKey);
      const hiddenFeatures = isHidden
        ? sub.hiddenFeatures.filter((key) => key !== featureKey)
        : [...sub.hiddenFeatures, featureKey];
      const enabledFeatures = sub.enabledFeatures.includes(featureKey)
        ? sub.enabledFeatures
        : [...sub.enabledFeatures, featureKey];
      return { ...sub, enabledFeatures, hiddenFeatures };
    }));
  };

  const changePlan = (planKey: CompanyPlanKey) => {
    const plan = planByKey(planKey);
    setSelectedPlan(planKey);
    setSubscriptions((prev) => prev.map((sub, idx) => idx === 0 ? {
      ...sub,
      planKey,
      enabledFeatures: plan.features,
      hiddenFeatures: SYSTEM_FEATURES.map((f) => f.key).filter((key) => !plan.features.includes(key)),
    } : sub));
  };

  const saveContract = () => {
    setSubscriptions((prev) => prev.map((sub, idx) => idx === 0 ? {
      ...sub,
      contractUrl: contractUrl.trim(),
      contractFileName: contractFileName.trim() || "عقد الشركة",
    } : sub));
  };

  const openContract = async () => {
    if (!activeSub.contractUrl) return;
    await Linking.openURL(activeSub.contractUrl);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>إدارة اشتراكات الشركات والعقود</Text>
      <Text style={styles.subtitle}>تحكم بالباقات، إظهار وإخفاء المميزات، رفع/تحميل العقد، واستقبال طلبات الاشتراك.</Text>

      <Text style={styles.sectionTitle}>باقات الاشتراك</Text>
      <View style={styles.planGrid}>
        {COMPANY_SUBSCRIPTION_PLANS.map((plan) => {
          const active = activeSub.planKey === plan.key;
          return (
            <TouchableOpacity key={plan.key} style={[styles.planCard, active && styles.planCardActive]} onPress={() => changePlan(plan.key)}>
              <Text style={[styles.planTitle, active && { color: Colors.gold }]}>{plan.titleAr}</Text>
              <Text style={styles.planPrice}>{price(plan.monthlyPriceSar)} / شهري</Text>
              <Text style={styles.planMeta}>{plan.maxUsers} مستخدم · {plan.maxBranches} فرع · {plan.maxInvoicesPerMonth} فاتورة</Text>
              <Text style={styles.planDesc}>{plan.recommendedForAr}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>اشتراك الشركة الحالي</Text>
      <View style={styles.companyCard}>
        <View style={styles.companyHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{activeSub.companyNameAr}</Text>
            <Text style={styles.companyMeta}>{activePlan.titleAr} · {activeSub.contactName} · {activeSub.contactPhone}</Text>
          </View>
          <Pill text={activeSub.status === "trial" ? "تجربة" : activeSub.status} color={Colors.gold} />
        </View>
        <Text style={styles.companyMeta}>المميزات الظاهرة للشركة: {visibleFeatures.length} / {SYSTEM_FEATURES.length}</Text>
      </View>

      <Text style={styles.sectionTitle}>إظهار وإخفاء المميزات</Text>
      <View style={styles.featuresWrap}>
        {SYSTEM_FEATURES.map((feature) => {
          const isEnabled = activeSub.enabledFeatures.includes(feature.key) && !activeSub.hiddenFeatures.includes(feature.key);
          const inPlan = activeSub.enabledFeatures.includes(feature.key);
          return (
            <TouchableOpacity key={feature.key} style={[styles.featureRow, isEnabled && styles.featureEnabled, !inPlan && styles.featureOutPlan]} onPress={() => toggleFeature(feature.key)}>
              <View style={[styles.toggle, isEnabled && styles.toggleOn]}>
                {isEnabled && <Feather name="check" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{feature.titleAr}</Text>
                <Text style={styles.featureDesc}>{feature.descriptionAr}</Text>
              </View>
              {!inPlan ? <Text style={styles.outPlanText}>خارج الباقة</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>العقد</Text>
      <View style={styles.contractBox}>
        <TextInput style={styles.input} value={contractFileName} onChangeText={setContractFileName} placeholder="اسم ملف العقد" placeholderTextColor={Colors.textMuted} textAlign="right" />
        <TextInput style={styles.input} value={contractUrl} onChangeText={setContractUrl} placeholder="رابط العقد أو مسار ملف العقد" placeholderTextColor={Colors.textMuted} textAlign="right" autoCapitalize="none" />
        <View style={styles.contractActions}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveContract}>
            <Feather name="upload-cloud" size={14} color="#fff" />
            <Text style={styles.saveBtnText}>حفظ العقد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, styles.downloadBtn]} onPress={openContract} disabled={!activeSub.contractUrl}>
            <Feather name="download" size={14} color="#fff" />
            <Text style={styles.saveBtnText}>تحميل العقد</Text>
          </TouchableOpacity>
        </View>
        {activeSub.contractFileName ? <Text style={styles.contractSaved}>العقد الحالي: {activeSub.contractFileName}</Text> : <Text style={styles.contractHint}>لم يتم رفع عقد لهذه الشركة بعد.</Text>}
      </View>

      <Text style={styles.sectionTitle}>طلبات الاشتراك المباشرة</Text>
      {DEMO_SERVICE_APPLICATIONS.map((app) => {
        const plan = planByKey(app.selectedPlanKey);
        return (
          <View key={app.id} style={styles.applicationCard}>
            <View style={styles.companyHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.companyName}>{app.companyNameAr}</Text>
                <Text style={styles.companyMeta}>{app.businessTypeAr} · {app.cityAr}</Text>
              </View>
              <Pill text={app.status === "submitted" ? "طلب جديد" : app.status} color={Colors.info} />
            </View>
            <Text style={styles.companyMeta}>الخطة المطلوبة: {plan.titleAr} · الفروع: {app.branchesCount} · الموظفون: {app.employeesCount}</Text>
            <Text style={styles.companyMeta}>الفواتير المتوقعة شهريًا: {app.expectedInvoicesMonthly}</Text>
            <View style={styles.requestedWrap}>
              {app.requestedFeatures.map((key) => {
                const feature = featureByKey(key);
                return feature ? <Text key={key} style={styles.requestedChip}>{feature.titleAr}</Text> : null;
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right", marginTop: 4 },
  planGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  planCard: { flexGrow: 1, minWidth: 190, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: Colors.border, gap: 5 },
  planCardActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + "10" },
  planTitle: { fontSize: 14, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  planPrice: { fontSize: 13, fontWeight: "900", color: Colors.gold, textAlign: "right" },
  planMeta: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  planDesc: { fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 17 },
  companyCard: { padding: 12, borderRadius: 14, backgroundColor: Colors.primary + "08", gap: 7 },
  companyHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  companyName: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right" },
  companyMeta: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 18 },
  pill: { overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, fontSize: 10, fontWeight: "900" },
  featuresWrap: { gap: 8 },
  featureRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  featureEnabled: { backgroundColor: Colors.success + "10", borderColor: Colors.success + "35" },
  featureOutPlan: { opacity: 0.75 },
  toggle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  toggleOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  featureTitle: { fontSize: 13, fontWeight: "900", color: Colors.text, textAlign: "right" },
  featureDesc: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 16 },
  outPlanText: { fontSize: 10, color: Colors.accent, fontWeight: "800" },
  contractBox: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  input: { minHeight: 42, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff", color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  contractActions: { flexDirection: "row-reverse", gap: 8 },
  saveBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.primary },
  downloadBtn: { backgroundColor: Colors.gold },
  saveBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  contractSaved: { fontSize: 11, color: Colors.success, textAlign: "right", fontWeight: "800" },
  contractHint: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  applicationCard: { gap: 7, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border },
  requestedWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  requestedChip: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18, backgroundColor: Colors.info + "12", color: Colors.info, fontSize: 10, fontWeight: "800" },
});
