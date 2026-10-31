import { Feather } from "@expo/vector-icons";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { db } from "@/lib/firebase";
import { showPlatformAlert } from "@/lib/platformAlert";
import { openWhatsApp } from "@/utils/orderFlow";

type LeadStatus = "new" | "contacted" | "trial" | "won" | "lost";
interface Lead {
  id: string; shopName: string; ownerName: string; phone: string; city: string; email?: string;
  shopType: string; branches: string; plan: string; notes?: string; status: LeadStatus; createdAt: string;
  utm?: Record<string, string>;
}

const STATUS: { key: LeadStatus; label: string; color: string }[] = [
  { key: "new", label: "جديد", color: Colors.gold },
  { key: "contacted", label: "تم التواصل", color: Colors.info },
  { key: "trial", label: "في التجربة", color: Colors.purple },
  { key: "won", label: "اشترك", color: Colors.success },
  { key: "lost", label: "لم يكمل", color: Colors.textMuted },
];
const TYPE: Record<string, string> = { sweets: "حلويات", cakes: "كيك", bakery: "مخبز", chocolate: "شوكولاتة", cafe: "مقهى", other: "أخرى" };
const PLAN: Record<string, string> = { starter: "149", business: "349", enterprise: "799", unsure: "لم يحدد" };

/** Platform staff: trial requests coming from the public /join page. */
export function LeadsPanel() {
  const { currentEmployee } = useEmployee();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  useEffect(() => onSnapshot(
    query(collection(db, "platformLeads"), orderBy("createdAt", "desc"), limit(200)),
    (snap) => { setLeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) }))); setFailed(false); },
    () => setFailed(true)
  ), []);

  const shown = useMemo(() => (leads ?? []).filter((l) => filter === "all" || l.status === filter), [leads, filter]);
  const newCount = (leads ?? []).filter((l) => l.status === "new").length;

  const setStatus = async (l: Lead, status: LeadStatus) => {
    try {
      await updateDoc(doc(db, "platformLeads", l.id), { status, updatedAt: new Date().toISOString(), handledBy: currentEmployee?.employeeId ?? "" });
    } catch {
      showPlatformAlert("تعذّر التحديث", "تحقق من الاتصال وصلاحية المنصة.");
    }
  };

  const contact = (l: Lead) => {
    openWhatsApp(l.phone, `مرحباً ${l.ownerName}، شكراً لطلبك تجربة نظام فوترة لـ«${l.shopName}». متى يناسبك نجهّز لك حسابك ونشرح لك النظام؟`);
    if (l.status === "new") void setStatus(l, "contacted");
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Feather name="inbox" size={18} color={Colors.primary} />
        <Text style={s.title}>طلبات التجربة من صفحة التسجيل</Text>
        {newCount ? <View style={s.badge}><Text style={s.badgeTxt}>{newCount} جديد</Text></View> : null}
      </View>

      <View style={s.filters}>
        {[{ key: "all" as const, label: "الكل", color: Colors.primary }, ...STATUS].map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[s.chip, filter === f.key && { backgroundColor: f.color, borderColor: f.color }]}>
            <Text style={[s.chipTxt, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {failed ? <Text style={s.muted}>لا يمكن عرض الطلبات: هذا الحساب لا يملك صلاحية المنصة.</Text>
        : leads === null ? <ActivityIndicator color={Colors.gold} />
        : !shown.length ? <Text style={s.muted}>لا توجد طلبات بعد. شارك رابط ‎/join‎ في حملتك.</Text>
        : shown.map((l) => {
          const st = STATUS.find((x) => x.key === l.status) ?? STATUS[0];
          return (
            <View key={l.id} style={s.row}>
              <View style={s.rowHead}>
                <Text style={s.shop}>{l.shopName}</Text>
                <View style={[s.pill, { backgroundColor: st.color + "18" }]}><Text style={[s.pillTxt, { color: st.color }]}>{st.label}</Text></View>
              </View>
              <Text style={s.meta}>{l.ownerName} · {l.city} · {TYPE[l.shopType] ?? l.shopType} · فروع {l.branches} · باقة {PLAN[l.plan] ?? l.plan}</Text>
              <Text style={s.meta}>{l.phone}{l.email ? ` · ${l.email}` : ""} · {new Date(l.createdAt).toLocaleString("ar-SA")}{l.utm?.source ? ` · ${l.utm.source}` : ""}</Text>
              {l.notes ? <Text style={s.notes}>{l.notes}</Text> : null}
              <View style={s.actions}>
                <Pressable style={s.wa} onPress={() => contact(l)}><Feather name="message-circle" size={14} color="#fff" /><Text style={s.waTxt}>واتساب</Text></Pressable>
                {STATUS.filter((x) => x.key !== l.status).map((x) => (
                  <Pressable key={x.key} style={s.small} onPress={() => void setStatus(l, x.key)}><Text style={s.smallTxt}>{x.label}</Text></Pressable>
                ))}
              </View>
            </View>
          );
        })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "800", color: Colors.text, textAlign: "right" },
  badge: { backgroundColor: Colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipTxt: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" },
  muted: { color: Colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 },
  row: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10, gap: 4 },
  rowHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  shop: { flex: 1, fontSize: 14, fontWeight: "800", color: Colors.text, textAlign: "right" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillTxt: { fontSize: 11, fontWeight: "800" },
  meta: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  notes: { fontSize: 12, color: Colors.text, textAlign: "right", backgroundColor: Colors.background, borderRadius: 10, padding: 8 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 4 },
  wa: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  waTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  small: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  smallTxt: { fontSize: 11, color: Colors.textSecondary, fontWeight: "700" },
});
