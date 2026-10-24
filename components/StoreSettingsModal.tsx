import { tr } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { OnlineStoreSettings } from "@/constants/onlineStore";
import { useLang } from "@/context/LanguageContext";
import { useProducts } from "@/context/TenantProductsContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";

const DAYS = [
  [0, "الأحد"], [1, "الإثنين"], [2, "الثلاثاء"], [3, "الأربعاء"], [4, "الخميس"], [5, "الجمعة"], [6, "السبت"],
] as const;

const CAT_AR: Record<string, string> = {
  "New Cake Collection": "تشكيلة الكيك الجديدة", "Laviviane Cakes": "كيك لافيفيان", "Celebration Bites": "قطع الاحتفالات",
  "Mousse Cake": "كيك الموس", "Laviviane Bites": "قطع لافيفيان", Sandwich: "ساندويتشات", "Luxury Chocolate": "شوكولاتة فاخرة",
  "Occasion Chocolate": "شوكولاتة المناسبات", "Distributions and Gifts": "توزيعات وهدايا",
};

/** Admin editor for the public ordering link rules. */
export function StoreSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { lang, isRTL } = useLang();
  const ar = lang === "ar";
  const align = isRTL ? "right" : "left";
  const { settings, save } = useStoreSettings();
  const { products } = useProducts();
  const [s, setS] = useState<OnlineStoreSettings>(settings);
  const [closed, setClosed] = useState("");
  const [branchName, setBranchName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setS(settings); setClosed(settings.closedDates.join("، ")); }
  }, [visible, settings]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const set = (patch: Partial<OnlineStoreSettings>) => setS((p) => ({ ...p, ...patch }));
  const numIn = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);

  const submit = async () => {
    const dates = closed.split(/[\s,،]+/).map((x) => x.trim()).filter(Boolean);
    const bad = dates.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
    if (bad.length) { Alert.alert(tr("تاريخ غير صحيح", "Bad date"), `${bad.join(", ")}\n${tr("الصيغة: 2026-12-31", "Format: 2026-12-31")}`); return; }
    if (!/^\d{2}:\d{2}$/.test(s.openFrom) || !/^\d{2}:\d{2}$/.test(s.openTo) || s.openFrom >= s.openTo) {
      Alert.alert(tr("ساعات العمل", "Hours"), tr("اكتب الوقت بصيغة 24 ساعة مثل 10:00 و 23:00", "Use 24h format like 10:00 and 23:00"));
      return;
    }
    setBusy(true);
    try {
      await save({ ...s, closedDates: dates });
      onClose();
    } catch {
      Alert.alert(tr("تعذّر الحفظ", "Save failed"), tr("تحقق من الاتصال والصلاحيات.", "Check connection and permissions."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.head}>
            <Text style={st.title}>{tr("إعدادات المتجر الأونلاين", "Online store settings")}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={22} color={Colors.textSecondary} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
            <Card>
              <Row label={tr("استقبال الطلبات الأونلاين", "Accept online orders")}>
                <Switch value={s.enabled} onValueChange={(v) => set({ enabled: v })} trackColor={{ true: Colors.success, false: Colors.border }} />
              </Row>
              <Text style={st.lbl}>{tr("رسالة تظهر للعملاء أعلى الصفحة (اختياري)", "Notice shown to customers")}</Text>
              <TextInput style={[st.in, { textAlign: align }]} value={s.notice} onChangeText={(notice) => set({ notice })} placeholder={tr("مثال: نستقبل طلبات الكيك قبل 24 ساعة", "e.g. cakes need 24h notice")} placeholderTextColor={Colors.textMuted} maxLength={200} />
            </Card>

            <Card title={tr("أيام وساعات العمل", "Days & hours")}>
              <View style={st.chips}>
                {DAYS.map(([d, l]) => {
                  const on = s.openDays.includes(d);
                  return (
                    <Pressable key={d} style={[st.chip, on && st.chipOn]} onPress={() => set({ openDays: on ? s.openDays.filter((x) => x !== d) : [...s.openDays, d].sort() })}>
                      <Text style={[st.chipTxt, on && { color: "#fff" }]}>{tr(l)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={st.two}>
                <Field label={tr("من", "From")} value={s.openFrom} onChange={(openFrom) => set({ openFrom })} placeholder="10:00" />
                <Field label={tr("آخر موعد", "Last slot")} value={s.openTo} onChange={(openTo) => set({ openTo })} placeholder="23:00" />
              </View>
              <Text style={st.lbl}>{tr("مدة كل موعد", "Slot length")}</Text>
              <View style={st.chips}>
                {[15, 30, 60].map((m) => (
                  <Pressable key={m} style={[st.chip, s.slotMinutes === m && st.chipOn]} onPress={() => set({ slotMinutes: m })}>
                    <Text style={[st.chipTxt, s.slotMinutes === m && { color: "#fff" }]}>{m} {tr("دقيقة", "min")}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={st.lbl}>{tr("أيام مغلقة (إجازات) — مثال: 2026-12-31، 2027-01-01", "Closed dates")}</Text>
              <TextInput style={[st.in, { textAlign: align }]} value={closed} onChangeText={setClosed} placeholder="2026-12-31" placeholderTextColor={Colors.textMuted} />
            </Card>

            <Card title={tr("مدة التحضير (بالساعات)", "Preparation lead time (hours)")}>
              <Field label={tr("الحد الأدنى لكل الطلبات", "Default")} value={String(s.defaultLeadHours)} onChange={(v) => set({ defaultLeadHours: numIn(v) })} numeric />
              {categories.map((c) => (
                <Field key={c} label={tr(CAT_AR[c] ?? c, c)} value={String(s.categoryLeadHours[c] ?? "")} placeholder={String(s.defaultLeadHours)}
                  onChange={(v) => set({ categoryLeadHours: { ...s.categoryLeadHours, [c]: numIn(v) } })} numeric />
              ))}
              <Field label={tr("أقصى عدد أيام للحجز مقدماً", "Max days ahead")} value={String(s.maxDaysAhead)} onChange={(v) => set({ maxDaysAhead: Math.max(1, numIn(v)) })} numeric />
            </Card>

            <Card title={tr("الطاقة الاستيعابية (0 = بلا حد)", "Capacity (0 = unlimited)")}>
              <View style={st.two}>
                <Field label={tr("طلبات أونلاين في اليوم", "Orders per day")} value={String(s.maxOrdersPerDay)} onChange={(v) => set({ maxOrdersPerDay: numIn(v) })} numeric />
                <Field label={tr("طلبات في الموعد الواحد", "Orders per slot")} value={String(s.maxOrdersPerSlot)} onChange={(v) => set({ maxOrdersPerSlot: numIn(v) })} numeric />
              </View>
              <Field label={tr("الحد الأدنى للطلب (ر.س)", "Minimum order (SAR)")} value={String(s.minOrder)} onChange={(v) => set({ minOrder: numIn(v) })} numeric />
            </Card>

            <Card title={tr("التوصيل", "Delivery")}>
              <Row label={tr("متاح التوصيل", "Delivery available")}>
                <Switch value={s.delivery.enabled} onValueChange={(v) => set({ delivery: { ...s.delivery, enabled: v } })} trackColor={{ true: Colors.success, false: Colors.border }} />
              </Row>
              {s.delivery.enabled && (
                <View style={st.two}>
                  <Field label={tr("رسوم التوصيل (ر.س)", "Fee (SAR)")} value={String(s.delivery.fee)} onChange={(v) => set({ delivery: { ...s.delivery, fee: numIn(v) } })} numeric />
                  <Field label={tr("مجاني فوق (ر.س، 0 = لا)", "Free over (SAR)")} value={String(s.delivery.freeOver)} onChange={(v) => set({ delivery: { ...s.delivery, freeOver: numIn(v) } })} numeric />
                </View>
              )}
            </Card>

            <Card title={tr("الفروع (للاستلام)", "Pickup branches")}>
              {s.branches.length === 0 && <Text style={st.muted}>{tr("بدون فروع: يُستلم الطلب من الفرع الرئيسي.", "No branches: single location.")}</Text>}
              {s.branches.map((b) => (
                <View key={b.id} style={st.branch}>
                  <Feather name="map-pin" size={14} color={Colors.primary} />
                  <Text style={{ flex: 1, fontWeight: "700", color: Colors.text }}>{b.name}</Text>
                  <Pressable onPress={() => set({ branches: s.branches.filter((x) => x.id !== b.id) })} hitSlop={8}><Feather name="trash-2" size={16} color={Colors.accent} /></Pressable>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={[st.in, { flex: 1, textAlign: align }]} value={branchName} onChangeText={setBranchName} placeholder={tr("اسم الفرع، مثل: فرع الملقا", "Branch name")} placeholderTextColor={Colors.textMuted} />
                <Pressable style={st.add} onPress={() => {
                  const n = branchName.trim();
                  if (!n) return;
                  set({ branches: [...s.branches, { id: `b${Date.now().toString(36)}`, name: n }] });
                  setBranchName("");
                }}><Feather name="plus" size={18} color="#fff" /></Pressable>
              </View>
            </Card>
          </ScrollView>
          <Pressable style={[st.save, busy && { opacity: 0.6 }]} onPress={() => void submit()} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Feather name="save" size={18} color={Colors.goldLight} />}
            <Text style={st.saveTxt}>{tr("حفظ الإعدادات", "Save settings")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <View style={st.card}>{title ? <Text style={st.cardTitle}>{title}</Text> : null}{children}</View>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={st.row}><Text style={st.rowTxt}>{label}</Text>{children}</View>;
}
function Field({ label, value, onChange, placeholder, numeric }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean }) {
  const { isRTL } = useLang();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={st.lbl}>{label}</Text>
      <TextInput style={[st.in, { textAlign: isRTL ? "right" : "left" }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={numeric ? "numeric" : "default"} />
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: "94%", width: "100%", maxWidth: 720, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "900", color: Colors.text },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  cardTitle: { fontSize: 13, fontWeight: "800", color: Colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTxt: { fontSize: 14, fontWeight: "800", color: Colors.text },
  lbl: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  in: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: Colors.text },
  two: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: Colors.surfaceSecondary },
  chipOn: { backgroundColor: Colors.primary },
  chipTxt: { fontSize: 12, fontWeight: "700", color: Colors.text },
  muted: { fontSize: 12, color: Colors.textMuted },
  branch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: 10 },
  add: { width: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  save: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, marginTop: 10 },
  saveTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
