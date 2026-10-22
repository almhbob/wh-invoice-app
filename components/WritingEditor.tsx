import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import type { CakeWriting } from "@/context/OrdersContext";
import { WRITING_SURFACES } from "@/utils/orderFlow";

/**
 * Compact editor attached to an order item: the phrase for the calligrapher
 * and the surface it goes on (cream, jelly, jelly on sugar, sugar print, card, other).
 */
export function WritingEditor({ value, onChange, defaultOpen }: { value?: CakeWriting; onChange: (w: CakeWriting | undefined) => void; defaultOpen?: boolean }) {
  const { lang, isRTL } = useLang();
  const ar = lang === "ar";
  const [open, setOpen] = useState(!!value?.text || !!defaultOpen);
  const align = isRTL ? "right" : "left";
  const w: CakeWriting = value ?? { text: "", surface: "cream" };
  const set = (patch: Partial<CakeWriting>) => onChange({ ...w, ...patch });

  if (!open) {
    return (
      <Pressable style={st.add} onPress={() => setOpen(true)}>
        <Feather name="edit-3" size={14} color={Colors.purple} />
        <Text style={st.addTxt}>{ar ? "إضافة عبارة للخطاط" : "Add writing for calligrapher"}</Text>
      </Pressable>
    );
  }

  return (
    <View style={st.box}>
      <View style={st.head}>
        <Feather name="edit-3" size={14} color={Colors.purple} />
        <Text style={st.title}>{ar ? "عبارة الخطاط" : "Calligraphy"}</Text>
        <Pressable hitSlop={8} onPress={() => { onChange(undefined); setOpen(false); }}>
          <Feather name="trash-2" size={15} color={Colors.textMuted} />
        </Pressable>
      </View>
      <TextInput
        style={[st.input, st.text, { textAlign: align }]}
        value={w.text}
        onChangeText={(text) => set({ text })}
        placeholder={ar ? "العبارة كما تُكتب بالضبط…" : "Exact phrase to write…"}
        placeholderTextColor={Colors.textMuted}
        multiline
      />
      <Text style={st.label}>{ar ? "تُكتب على" : "Written on"}</Text>
      <View style={st.chips}>
        {WRITING_SURFACES.map((s) => {
          const on = w.surface === s.key;
          return (
            <Pressable key={s.key} style={[st.chip, on && st.chipOn]} onPress={() => set({ surface: s.key })}>
              <Feather name={s.icon as never} size={12} color={on ? "#fff" : Colors.textSecondary} />
              <Text style={[st.chipTxt, on && { color: "#fff" }]}>{ar ? s.ar : s.en}</Text>
            </Pressable>
          );
        })}
      </View>
      {w.surface === "other" && (
        <TextInput style={[st.input, { textAlign: align }]} value={w.surfaceOther ?? ""} onChangeText={(surfaceOther) => set({ surfaceOther })}
          placeholder={ar ? "حدّد مكان الكتابة" : "Describe the surface"} placeholderTextColor={Colors.textMuted} />
      )}
      <View style={{ gap: 8 }}>
        <TextInput style={[st.input, { textAlign: align }]} value={w.color ?? ""} onChangeText={(color) => set({ color })}
          placeholder={ar ? "اللون (اختياري)" : "Color (optional)"} placeholderTextColor={Colors.textMuted} />
        <TextInput style={[st.input, { textAlign: align }]} value={w.note ?? ""} onChangeText={(note) => set({ note })}
          placeholder={ar ? "ملاحظة للخطاط: الخط، المكان…" : "Note: font, placement…"} placeholderTextColor={Colors.textMuted} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  add: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: Colors.purple + "12", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 6 },
  addTxt: { color: Colors.purple, fontSize: 12, fontWeight: "800" },
  box: { marginTop: 8, gap: 8, backgroundColor: Colors.purple + "0C", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: Colors.purple + "30" },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: "800", color: Colors.purple },
  input: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: Colors.text },
  text: { fontSize: 16, fontWeight: "700", minHeight: 48 },
  label: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  chipOn: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  chipTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
});
