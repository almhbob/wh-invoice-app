import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { LoyaltySettings, pointsValue } from "@/constants/loyalty";
import { useCompany } from "@/context/CompanyContext";
import { adjustPoints, saveLoyaltySettings } from "@/lib/loyalty";
import { tr, trf } from "@/lib/i18n";

function Field({ label, hint, value, onChange, suffix }: { label: string; hint?: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <View style={s.field}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <View style={s.inputWrap}>
        <TextInput style={s.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" textAlign="center" />
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

/** Admin: program rules (earn rate, point value, redemption limits, tiers). */
export function LoyaltySettingsModal({ visible, settings, onClose }: { visible: boolean; settings: LoyaltySettings; onClose: () => void }) {
  const { companyId } = useCompany();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setDraft(settings); }, [settings, visible]);
  const setNum = (k: keyof LoyaltySettings) => (v: string) => setDraft((d) => ({ ...d, [k]: Number(v.replace(/[^\d.]/g, "")) || 0 }));
  const cashback = Math.round(draft.pointsPerRiyal * draft.pointValue * 1000) / 10;

  const save = async () => {
    setSaving(true);
    try {
      await saveLoyaltySettings(companyId, draft);
      onClose();
    } catch {
      Alert.alert(tr("تعذّر الحفظ", "Could not save"), tr("تحقق من الاتصال ثم أعد المحاولة.", "Check the connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>{tr("إعدادات برنامج الولاء", "Loyalty program settings")}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={Colors.textSecondary} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
            <View style={s.field}>
              <Text style={[s.label, { flex: 1 }]}>{tr("تفعيل البرنامج", "Program enabled")}</Text>
              <Switch value={draft.enabled} onValueChange={(v) => setDraft((d) => ({ ...d, enabled: v, startAt: v && !d.enabled ? new Date().toISOString() : d.startAt }))} trackColor={{ true: Colors.gold }} />
            </View>
            <Field label={tr("نقاط لكل 1 ريال", "Points per 1 SAR")} value={String(draft.pointsPerRiyal)} onChange={setNum("pointsPerRiyal")} suffix={tr("نقطة", "pts")} />
            <Field label={tr("قيمة النقطة عند الاستبدال", "Value of a point when redeemed")} hint={trf("100 نقطة = {v} ر.س", "100 pts = {v} SAR", { v: pointsValue(100, draft).toFixed(2) })} value={String(draft.pointValue)} onChange={setNum("pointValue")} suffix={tr("ر.س", "SAR")} />
            <Field label={tr("أقل عدد نقاط للاستبدال", "Minimum points to redeem")} value={String(draft.minRedeemPoints)} onChange={setNum("minRedeemPoints")} suffix={tr("نقطة", "pts")} />
            <Field label={tr("أقصى نسبة تُدفع بالنقاط", "Max share paid with points")} hint={tr("من قيمة الفاتورة", "of the invoice")} value={String(draft.maxRedeemPercent)} onChange={setNum("maxRedeemPercent")} suffix="%" />
            <View style={s.summary}>
              <Feather name="info" size={14} color={Colors.info} />
              <Text style={s.summaryTxt}>{trf("يسترد العميل {c}% من مشترياته كنقاط في الفئة الأساسية، وأكثر في الفئات الأعلى.", "Customers get {c}% back in points at the base tier, more in higher tiers.", { c: cashback })}</Text>
            </View>
            <Text style={s.section}>{tr("الفئات (حسب إجمالي المشتريات)", "Tiers (by lifetime spend)")}</Text>
            {draft.tiers.map((t, i) => (
              <View key={t.id} style={s.tier}>
                <TextInput style={[s.input, { flex: 1 }]} value={t.name} onChangeText={(v) => setDraft((d) => ({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, name: v } : x)) }))} textAlign="right" />
                <View style={s.inputWrap}>
                  <TextInput style={s.input} editable={i > 0} value={String(t.minSpent)} keyboardType="number-pad" textAlign="center"
                    onChangeText={(v) => setDraft((d) => ({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, minSpent: Number(v.replace(/\D/g, "")) || 0 } : x)) }))} />
                  <Text style={s.suffix}>{tr("ر.س", "SAR")}</Text>
                </View>
                <View style={s.inputWrap}>
                  <TextInput style={s.input} value={String(t.multiplier)} keyboardType="decimal-pad" textAlign="center"
                    onChangeText={(v) => setDraft((d) => ({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, multiplier: Number(v.replace(/[^\d.]/g, "")) || 0 } : x)) }))} />
                  <Text style={s.suffix}>×</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Pressable style={[s.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>{tr("حفظ الإعدادات", "Save settings")}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Manager: add or deduct points for one customer, with a reason (kept in the audit trail). */
export function AdjustPointsModal({
  visible, phone, name, balance, by, onClose,
}: { visible: boolean; phone: string; name: string; balance: number; by: { name: string; employeeId: string }; onClose: () => void }) {
  const { companyId } = useCompany();
  const [amount, setAmount] = useState("");
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) { setAmount(""); setReason(""); setSign(1); } }, [visible]);

  const submit = async () => {
    const n = Math.round(Number(amount));
    if (!n || n < 0) { Alert.alert(tr("تنبيه", "Notice"), tr("أدخل عدد النقاط.", "Enter the number of points.")); return; }
    if (!reason.trim()) { Alert.alert(tr("تنبيه", "Notice"), tr("اكتب سبب التعديل.", "Write the reason for the change.")); return; }
    setSaving(true);
    try {
      await adjustPoints(companyId, phone, name, sign * n, reason.trim(), by);
      onClose();
    } catch {
      Alert.alert(tr("تعذّر الحفظ", "Could not save"), tr("تحقق من الاتصال ثم أعد المحاولة.", "Check the connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.backdrop, { justifyContent: "center", padding: 20 }]}>
        <View style={[s.sheet, { borderRadius: 24 }]}>
          <View style={s.head}>
            <Text style={s.title}>{trf("تعديل نقاط {n}", "Adjust points: {n}", { n: name })}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={Colors.textSecondary} /></Pressable>
          </View>
          <Text style={s.hint}>{trf("الرصيد الحالي: {b} نقطة", "Current balance: {b} pts", { b: balance })}</Text>
          <View style={s.segment}>
            {([1, -1] as const).map((v) => (
              <Pressable key={v} style={[s.segBtn, sign === v && { backgroundColor: v === 1 ? Colors.success : Colors.accent }]} onPress={() => setSign(v)}>
                <Text style={[s.segTxt, sign === v && { color: "#fff" }]}>{v === 1 ? tr("إضافة", "Add") : tr("خصم", "Deduct")}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={[s.input, s.big]} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ""))} placeholder={tr("عدد النقاط", "Points")} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" textAlign="center" />
          <TextInput style={[s.input, s.big, { textAlign: "right" }]} value={reason} onChangeText={setReason} placeholder={tr("السبب (مثال: تعويض عن تأخير)", "Reason (e.g. delay compensation)")} placeholderTextColor={Colors.textMuted} />
          <Pressable style={[s.save, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>{tr("حفظ", "Save")}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 12, maxHeight: "90%", width: "100%", maxWidth: 560, alignSelf: "center" },
  head: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  title: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  field: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.borderLight },
  label: { color: Colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  hint: { color: Colors.textMuted, fontSize: 11, textAlign: "right" },
  inputWrap: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  input: { minWidth: 70, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface },
  big: { fontSize: 15, paddingVertical: 12 },
  suffix: { color: Colors.textSecondary, fontSize: 12 },
  summary: { flexDirection: "row-reverse", gap: 8, alignItems: "center", backgroundColor: Colors.info + "12", borderRadius: 12, padding: 10 },
  summaryTxt: { flex: 1, color: Colors.info, fontSize: 12, textAlign: "right" },
  section: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", textAlign: "right", marginTop: 4 },
  tier: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  save: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  segment: { flexDirection: "row-reverse", gap: 8 },
  segBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: Colors.surfaceSecondary },
  segTxt: { color: Colors.textSecondary, fontWeight: "700" },
});
