import { tr } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import type { OrderItem, OrderStatus } from "@/context/OrdersContext";
import { surfaceLabel } from "@/utils/orderFlow";

/** Read-only display of a writing request (cake ticket, review, details). */
export function WritingBlock({ item, status, big }: { item: OrderItem; status?: OrderStatus; big?: boolean }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const w = item.writing;
  if (!w?.text?.trim()) return null;
  const st2 = status === "done" ? { c: Colors.statusDone, t: tr("كُتبت", "Written") } : status === "in_progress" ? { c: Colors.statusInProgress, t: tr("عند الخطاط", "With calligrapher") } : { c: Colors.statusPending, t: tr("بانتظار الخطاط", "Awaiting calligrapher") };
  return (
    <View style={st.box}>
      <View style={st.row}>
        <Feather name="edit-3" size={12} color={Colors.purple} />
        <Text style={st.surface}>{surfaceLabel(item, lang)}{w.color ? ` · ${w.color}` : ""}</Text>
        {status && <View style={[st.pill, { backgroundColor: st2.c + "18" }]}><Text style={[st.pillTxt, { color: st2.c }]}>{st2.t}</Text></View>}
      </View>
      <Text style={[st.text, big && st.textBig]} selectable>«{w.text.trim()}»</Text>
      {w.note ? <Text style={st.note}>{w.note}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  box: { marginTop: 6, backgroundColor: Colors.purple + "0D", borderRadius: 12, padding: 10, gap: 4, borderWidth: 1, borderColor: Colors.purple + "26" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  surface: { flex: 1, fontSize: 12, fontWeight: "800", color: Colors.purple },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillTxt: { fontSize: 10, fontWeight: "800" },
  text: { fontSize: 16, fontWeight: "800", color: Colors.text, lineHeight: 24 },
  textBig: { fontSize: 24, lineHeight: 36, textAlign: "center", paddingVertical: 6 },
  note: { fontSize: 12, color: Colors.textSecondary },
});
