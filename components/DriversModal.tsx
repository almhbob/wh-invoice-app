import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useOrders, useOrderHistory } from "@/context/OrdersContext";
import { Driver, useDrivers } from "@/hooks/useDrivers";
import { callPhone, driverStats } from "@/utils/orderFlow";

type Entry = Driver & { account?: boolean };

interface Props {
  visible: boolean;
  onClose: () => void;
  /** When provided the modal works as a picker: tapping a driver selects them. */
  onPick?: (driver: Driver) => void;
  currentDriverId?: string;
  onUnassign?: () => void;
  /** Open drivers on duty count per driver (for the picker). */
  loadByDriver?: Record<string, number>;
}

export function DriversModal({ visible, onClose, onPick, currentDriverId, onUnassign, loadByDriver }: Props) {
  const { lang, isRTL } = useLang();
  const ar = lang === "ar";
  const { drivers, loading, addDriver, updateDriver, removeDriver } = useDrivers();
  const { employees } = useEmployee();
  const { orders } = useOrders();
  useOrderHistory(visible && !onPick ? 366 : 0);
  // Drivers with an app account (role "driver") come first; they see their deliveries in the app.
  const accountDrivers: Entry[] = employees
    .filter((e) => e.role === "driver")
    .map((e) => ({ id: e.employeeId, name: e.name, phone: e.phone ?? "", active: e.status !== "suspended", createdAt: e.createdAt, account: true }));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);
  const align = isRTL ? "right" : "left";
  const picker = !!onPick;
  const all: Entry[] = [...accountDrivers, ...drivers];
  const list = picker ? all.filter((d) => d.active) : all;

  const save = async () => {
    if (!name.trim() || phone.replace(/\D/g, "").length < 9) {
      Alert.alert(ar ? "بيانات ناقصة" : "Missing data", ar ? "أدخل اسم السائق ورقم جوال صحيح." : "Enter the driver's name and a valid phone.");
      return;
    }
    setSaving(true);
    try {
      const d = await addDriver({ name, phone, vehicle });
      setName(""); setPhone(""); setVehicle(""); setAdding(false);
      if (picker) onPick!(d);
    } catch {
      Alert.alert(ar ? "تعذّر الحفظ" : "Save failed", ar ? "تحقق من الاتصال وحاول مجدداً." : "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (d: Driver) => {
    Alert.alert(ar ? "حذف السائق" : "Remove driver", `${d.name}?`, [
      { text: ar ? "إلغاء" : "Cancel", style: "cancel" },
      { text: ar ? "حذف" : "Remove", style: "destructive", onPress: () => void removeDriver(d.id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.handle} />
          <View style={st.head}>
            <Text style={st.title}>{picker ? (ar ? "اختر السائق" : "Choose driver") : (ar ? "إدارة السائقين" : "Manage drivers")}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={22} color={Colors.textSecondary} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
            {picker && currentDriverId && onUnassign && (
              <Pressable style={st.unassign} onPress={onUnassign}>
                <Feather name="user-x" size={16} color={Colors.accent} />
                <Text style={[st.unassignTxt]}>{ar ? "إلغاء تعيين السائق الحالي" : "Unassign current driver"}</Text>
              </Pressable>
            )}

            {loading && <ActivityIndicator color={Colors.gold} />}
            {!loading && list.length === 0 && !adding && (
              <View style={st.empty}>
                <Feather name="truck" size={28} color={Colors.textMuted} />
                <Text style={st.emptyTxt}>{ar ? "لا يوجد سائقون بعد. أضف أول سائق." : "No drivers yet. Add your first driver."}</Text>
              </View>
            )}

            {list.map((d) => {
              const load = loadByDriver?.[d.id] ?? 0;
              const selected = d.id === currentDriverId;
              return (
                <Pressable key={d.id} disabled={!picker} onPress={() => onPick?.(d)} style={[st.row, selected && st.rowSelected, !d.active && { opacity: 0.55 }]}>
                  <View style={st.avatar}><Text style={st.avatarTxt}>{d.name.charAt(0)}</Text></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.name}>{d.name}</Text>
                    <Text style={st.sub}>{d.phone || (ar ? "بدون رقم" : "No phone")}{d.vehicle ? ` · ${d.vehicle}` : ""}</Text>
                    {d.account ? <Text style={st.account}>{ar ? "● حساب في التطبيق" : "● App account"}</Text> : null}
                    {!picker && (() => {
                      const s = driverStats(orders, d.id);
                      return (
                        <View style={st.stats}>
                          {[[ar ? "اليوم" : "Today", s.today], [ar ? "الشهر" : "Month", s.month], [ar ? "السنة" : "Year", s.year]].map(([l, v]) => (
                            <View key={String(l)} style={st.stat}>
                              <Text style={st.statNum}>{(v as { assigned: number }).assigned}</Text>
                              <Text style={st.statLbl}>{String(l)}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                  {picker ? (
                    <View style={[st.load, load > 0 && { backgroundColor: Colors.gold + "22" }]}>
                      <Text style={[st.loadTxt, load > 0 && { color: Colors.primary }]}>{load > 0 ? (ar ? `${load} طلب` : `${load} open`) : (ar ? "متاح" : "Free")}</Text>
                    </View>
                  ) : (
                    <View style={st.actions}>
                      {d.phone ? <Pressable hitSlop={8} onPress={() => callPhone(d.phone)}><Feather name="phone" size={18} color={Colors.success} /></Pressable> : null}
                      {d.account ? null : <>
                      <Switch value={d.active} onValueChange={(v) => void updateDriver(d.id, { active: v })} trackColor={{ true: Colors.success, false: Colors.border }} />
                      <Pressable hitSlop={8} onPress={() => confirmRemove(d)}><Feather name="trash-2" size={18} color={Colors.accent} /></Pressable>
                      </>}
                    </View>
                  )}
                  {selected && <Feather name="check-circle" size={18} color={Colors.success} />}
                </Pressable>
              );
            })}

            {adding ? (
              <View style={st.form}>
                <TextInput style={[st.input, { textAlign: align }]} value={name} onChangeText={setName} placeholder={ar ? "اسم السائق" : "Driver name"} placeholderTextColor={Colors.textMuted} />
                <TextInput style={[st.input, { textAlign: align }]} value={phone} onChangeText={setPhone} placeholder={ar ? "رقم الجوال 05xxxxxxxx" : "Phone 05xxxxxxxx"} placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
                <TextInput style={[st.input, { textAlign: align }]} value={vehicle} onChangeText={setVehicle} placeholder={ar ? "المركبة (اختياري)" : "Vehicle (optional)"} placeholderTextColor={Colors.textMuted} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[st.btn, st.btnGhost]} onPress={() => setAdding(false)}><Text style={st.btnGhostTxt}>{ar ? "إلغاء" : "Cancel"}</Text></Pressable>
                  <Pressable style={[st.btn, st.btnPrimary, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.btnPrimaryTxt}>{picker ? (ar ? "حفظ واختيار" : "Save & choose") : (ar ? "حفظ" : "Save")}</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
              {!picker && (
                <Text style={st.hint}>{ar ? "لإنشاء سائق يدخل التطبيق بحسابه: المشرف ← إضافة موظف ← الدور «سائق». أو أضف سائقاً خارجياً هنا (بدون حساب):" : "For a driver with an app login: Admin → Add employee → role “Driver”. Or add an external driver here (no login):"}</Text>
              )}
              <Pressable style={st.addBtn} onPress={() => setAdding(true)}>
                <Feather name="user-plus" size={16} color={Colors.primary} />
                <Text style={st.addTxt}>{ar ? "إضافة سائق" : "Add driver"}</Text>
              </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "800", color: Colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.borderLight },
  rowSelected: { borderColor: Colors.success },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: Colors.goldLight, fontWeight: "900", fontSize: 16 },
  name: { fontSize: 14, fontWeight: "800", color: Colors.text },
  sub: { fontSize: 12, color: Colors.textSecondary },
  account: { fontSize: 11, color: Colors.success, fontWeight: "700", marginTop: 2 },
  stats: { flexDirection: "row", gap: 6, marginTop: 6 },
  stat: { alignItems: "center", backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 54 },
  statNum: { fontSize: 14, fontWeight: "900", color: Colors.primary },
  statLbl: { fontSize: 10, color: Colors.textMuted, fontWeight: "700" },
  load: { backgroundColor: Colors.success + "18", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  loadTxt: { fontSize: 11, fontWeight: "800", color: Colors.success },
  actions: { flexDirection: "row", alignItems: "center", gap: 14 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyTxt: { color: Colors.textMuted, fontSize: 13 },
  unassign: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: Colors.accent + "12" },
  unassignTxt: { color: Colors.accent, fontWeight: "700" },
  form: { gap: 10, backgroundColor: Colors.surface, borderRadius: 16, padding: 12 },
  input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.text },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: Colors.surfaceSecondary },
  btnGhostTxt: { color: Colors.textSecondary, fontWeight: "700" },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryTxt: { color: "#fff", fontWeight: "800" },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.gold, borderRadius: 14, paddingVertical: 12 },
  addTxt: { color: Colors.primary, fontWeight: "800" },
});
