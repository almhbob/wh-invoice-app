import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { useTaxProfile } from "@/hooks/useTaxProfile";
import { tr, trf } from "@/lib/i18n";
import { showPlatformAlert } from "@/lib/platformAlert";
import { normalizeTaxProfile, TaxProfile, taxProfileError, vatBreakdown } from "@/utils/zatca";

/**
 * Admin: VAT registration printed on every invoice. When on, invoices become
 * "simplified tax invoices" with the VAT breakdown and the ZATCA QR code.
 */
export function TaxSettingsPanel() {
  const { currentEmployee } = useEmployee();
  const { profile, loaded, save } = useTaxProfile();
  const [draft, setDraft] = useState<TaxProfile>(profile);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(profile); }, [profile]);

  const error = useMemo(() => taxProfileError(normalizeTaxProfile(draft)), [draft]);
  const dirty = JSON.stringify(normalizeTaxProfile(draft)) !== JSON.stringify(normalizeTaxProfile(profile));
  const sample = vatBreakdown(115, 0, normalizeTaxProfile(draft).vatRate);

  if (currentEmployee?.role !== "admin") return null;

  const errorText =
    error === "seller_required" ? tr("اكتب اسم المنشأة كما هو مسجل في هيئة الزكاة.", "Enter the business name as registered with ZATCA.")
    : error === "vat_invalid" ? tr("الرقم الضريبي ١٥ رقماً يبدأ وينتهي بالرقم ٣.", "The VAT number is 15 digits starting and ending with 3.")
    : error === "rate_invalid" ? tr("نسبة الضريبة غير صحيحة.", "Invalid VAT rate.")
    : null;

  const onSave = async () => {
    if (error) { showPlatformAlert(tr("بيانات ناقصة", "Missing details"), errorText ?? ""); return; }
    setBusy(true);
    try {
      await save(draft, currentEmployee.employeeId);
      showPlatformAlert(
        tr("تم الحفظ", "Saved"),
        draft.enabled
          ? tr("ستُطبع الفواتير من الآن كفاتورة ضريبية مبسطة مع رمز QR المعتمد.", "Invoices now print as simplified tax invoices with the ZATCA QR.")
          : tr("تم إيقاف الفاتورة الضريبية.", "Tax invoices are off.")
      );
    } catch {
      showPlatformAlert(tr("تعذّر الحفظ", "Could not save"), tr("تحقق من الاتصال ومن أنك مسجّل كمسؤول الشركة.", "Check the connection and that you're signed in as the company admin."));
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<TaxProfile>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}><Feather name="file-text" size={16} color={Colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{tr("الفاتورة الضريبية (هيئة الزكاة)", "Tax invoice (ZATCA)")}</Text>
          <Text style={s.sub}>{tr("فاتورة ضريبية مبسطة: الرقم الضريبي، تفصيل الضريبة، ورمز QR المعتمد.", "Simplified tax invoice: VAT number, VAT breakdown and the official QR code.")}</Text>
        </View>
        {!loaded ? <ActivityIndicator color={Colors.gold} /> : (
          <Switch value={draft.enabled} onValueChange={(v) => set({ enabled: v })} trackColor={{ true: Colors.success, false: Colors.border }} />
        )}
      </View>

      <Text style={s.label}>{tr("اسم المنشأة المسجل", "Registered business name")}</Text>
      <TextInput style={s.input} value={draft.sellerName} onChangeText={(v) => set({ sellerName: v })} placeholder={tr("كما في شهادة التسجيل الضريبي", "As on the VAT certificate")} placeholderTextColor={Colors.textMuted} textAlign="right" maxLength={120} />

      <Text style={s.label}>{tr("الرقم الضريبي", "VAT number")}</Text>
      <TextInput style={[s.input, s.ltr]} value={draft.vatNumber} onChangeText={(v) => set({ vatNumber: v })} placeholder="3XXXXXXXXXXXXX3" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" maxLength={20} />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{tr("السجل التجاري (اختياري)", "CR number (optional)")}</Text>
          <TextInput style={[s.input, s.ltr]} value={draft.crNumber ?? ""} onChangeText={(v) => set({ crNumber: v })} keyboardType="number-pad" maxLength={12} placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={{ width: 96 }}>
          <Text style={s.label}>{tr("النسبة %", "Rate %")}</Text>
          <TextInput style={[s.input, s.ltr]} value={String(draft.vatRate)} onChangeText={(v) => set({ vatRate: Number(v.replace(/[^\d.]/g, "")) || 0 })} keyboardType="decimal-pad" maxLength={5} />
        </View>
      </View>

      <Text style={s.label}>{tr("العنوان (اختياري)", "Address (optional)")}</Text>
      <TextInput style={s.input} value={draft.address ?? ""} onChangeText={(v) => set({ address: v })} textAlign="right" maxLength={200} placeholderTextColor={Colors.textMuted} />

      <View style={s.note}>
        <Feather name="info" size={14} color={Colors.info} />
        <Text style={s.noteTxt}>
          {trf(
            "الأسعار تُعامل كأسعار شاملة الضريبة كما يشترط النظام للمستهلك. مثال: ١١٥ ر.س = {n} قبل الضريبة + {v} ضريبة. تأمين الصواني المسترد خارج الضريبة.",
            "Prices are treated as VAT-inclusive, as required for consumers. Example: 115 SAR = {n} before VAT + {v} VAT. Refundable tray deposits are outside VAT.",
            { n: sample.totalWithoutVat.toFixed(2), v: sample.vat.toFixed(2) }
          )}
        </Text>
      </View>
      <View style={s.note}>
        <Feather name="alert-circle" size={14} color={Colors.warning} />
        <Text style={s.noteTxt}>
          {tr(
            "هذه متطلبات المرحلة الأولى (إصدار الفاتورة). الربط مع منصة فاتورة (المرحلة الثانية) يتم عند وصول دعوة الهيئة لمنشأتك ويحتاج تسجيل الجهاز لديها.",
            "This covers phase 1 (invoice generation). Phase 2 integration with Fatoora starts when ZATCA invites your business and needs device onboarding."
          )}
        </Text>
      </View>

      {errorText && draft.enabled ? <Text style={s.err}>{errorText}</Text> : null}

      <Pressable style={[s.save, (!dirty || busy) && { opacity: 0.5 }]} disabled={!dirty || busy} onPress={onSave}>
        {busy ? <ActivityIndicator color="#fff" /> : <Feather name="check" size={16} color="#fff" />}
        <Text style={s.saveTxt}>{tr("حفظ", "Save")}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight, padding: 16, gap: 8, marginTop: 14 },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 4 },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary + "10", alignItems: "center", justifyContent: "center" },
  title: { color: Colors.text, fontSize: 15, fontWeight: "800", textAlign: "right" },
  sub: { color: Colors.textSecondary, fontSize: 12, textAlign: "right", lineHeight: 18 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", textAlign: "right", marginTop: 4 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#FAFAF8", paddingHorizontal: 12, color: Colors.text, fontSize: 14 },
  ltr: { textAlign: "left", letterSpacing: 1 },
  row: { flexDirection: "row-reverse", gap: 10 },
  note: { flexDirection: "row-reverse", gap: 8, alignItems: "flex-start", backgroundColor: Colors.background, borderRadius: 12, padding: 10, marginTop: 4 },
  noteTxt: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: "right" },
  err: { color: Colors.accent, fontSize: 12, fontWeight: "700", textAlign: "right" },
  save: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, minHeight: 48, marginTop: 6 },
  saveTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
