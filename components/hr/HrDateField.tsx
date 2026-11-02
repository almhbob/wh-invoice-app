import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { currentLang, tr } from "@/lib/i18n";
import { addMonths, renewalBase } from "@/utils/hr";
import { riyadhDate } from "@/utils/windowOrders";

const PRESETS: { months: number; ar: string; en: string }[] = [
  { months: 3, ar: "+٣ أشهر", en: "+3 mo" },
  { months: 6, ar: "+٦ أشهر", en: "+6 mo" },
  { months: 12, ar: "+سنة", en: "+1 yr" },
  { months: 24, ar: "+سنتين", en: "+2 yrs" },
];

function fmt(iso: string) {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return {
      g: d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" }),
      h: d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }),
    };
  } catch {
    return { g: iso, h: "" };
  }
}

/**
 * Tap-to-pick date (YYYY-MM-DD). On the web it opens the phone's own date
 * picker; on native a day / month / year sheet. `presets` adds one-tap
 * renewal buttons that extend from the current date (or today when empty).
 */
export function HrDateField({ label, value, onChange, presets, disabled }: {
  label: string;
  value?: string;
  onChange: (iso: string) => void;
  presets?: boolean;
  disabled?: boolean;
}) {
  const [sheet, setSheet] = useState(false);
  const valid = !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const shown = valid ? fmt(value!) : null;

  const box = (
    <View style={[st.box, disabled && { opacity: 0.6 }]}>
      <Feather name="calendar" size={16} color={valid ? Colors.text : Colors.textMuted} />
      <View style={{ flex: 1 }}>
        {shown ? (
          <>
            <Text style={st.value} numberOfLines={1}>{shown.g}</Text>
            {shown.h ? <Text style={st.hijri} numberOfLines={1}>{shown.h}</Text> : null}
          </>
        ) : (
          <Text style={st.placeholder}>{tr("اختر التاريخ", "Pick a date")}</Text>
        )}
      </View>
      {valid && !disabled ? (
        <Pressable onPress={() => onChange("")} hitSlop={10} accessibilityLabel={tr("مسح التاريخ", "Clear the date")} style={{ zIndex: 2 }}>
          <Feather name="x-circle" size={16} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    // minWidth 260: one per row on phones (room for the date + presets), two per row on wide screens
    <View style={{ flex: 1, minWidth: 260, gap: 6 }}>
      <Text style={st.label}>{label}</Text>
      {Platform.OS === "web" ? (
        <View style={{ position: "relative" }}>
          {box}
          {!disabled ? (
            <input
              type="date"
              value={valid ? value : ""}
              onChange={(e: any) => onChange(e.target.value || "")}
              aria-label={label}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "calc(100% - 36px)", height: "100%" } as any}
            />
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => !disabled && setSheet(true)}>{box}</Pressable>
      )}
      {presets && !disabled ? (
        <View style={st.presets}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.months}
              onPress={() => onChange(addMonths(renewalBase(valid ? value : undefined, riyadhDate()), p.months))}
              style={({ pressed }) => [st.chip, pressed && { backgroundColor: Colors.border }]}
            >
              <Text style={st.chipTxt}>{tr(p.ar, p.en)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {sheet ? <NativeSheet value={valid ? value! : riyadhDate()} onClose={() => setSheet(false)} onPick={(d) => { onChange(d); setSheet(false); }} /> : null}
    </View>
  );
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function NativeSheet({ value, onClose, onPick }: { value: string; onClose: () => void; onPick: (iso: string) => void }) {
  const [y0, m0, d0] = value.split("-").map(Number);
  const [y, setY] = useState(y0);
  const [m, setM] = useState(m0);
  const [d, setD] = useState(d0);
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 21 }, (_, i) => thisYear - 10 + i), [thisYear]);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(d, daysIn);
  const months = currentLang() === "ar" || currentLang() === "ur" ? MONTHS_AR : MONTHS_EN;
  const pad = (n: number) => String(n).padStart(2, "0");

  const Col = ({ items, selected, onSelect, render }: { items: number[]; selected: number; onSelect: (n: number) => void; render: (n: number) => string }) => (
    <ScrollView style={st.col} contentContainerStyle={{ gap: 4, paddingVertical: 4 }}>
      {items.map((n) => (
        <Pressable key={n} onPress={() => onSelect(n)} style={[st.cell, n === selected && st.cellOn]}>
          <Text style={[st.cellTxt, n === selected && st.cellTxtOn]}>{render(n)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={{ flexDirection: "row", gap: 8, height: 240 }}>
            <Col items={Array.from({ length: daysIn }, (_, i) => i + 1)} selected={day} onSelect={setD} render={String} />
            <Col items={Array.from({ length: 12 }, (_, i) => i + 1)} selected={m} onSelect={setM} render={(n) => months[n - 1]} />
            <Col items={years} selected={y} onSelect={setY} render={String} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={onClose} style={[st.btn, { backgroundColor: Colors.surfaceSecondary }]}>
              <Text style={[st.btnTxt, { color: Colors.text }]}>{tr("إلغاء", "Cancel")}</Text>
            </Pressable>
            <Pressable onPress={() => onPick(`${y}-${pad(m)}-${pad(day)}`)} style={[st.btn, { backgroundColor: Colors.primary }]}>
              <Text style={st.btnTxt}>{tr("تم", "Done")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  box: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surface },
  value: { fontSize: 14, fontWeight: "800", color: Colors.text },
  hijri: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  placeholder: { fontSize: 14, color: Colors.textMuted },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surfaceSecondary },
  chipTxt: { fontSize: 12, fontWeight: "800", color: Colors.text },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: Colors.surface, borderRadius: 20, padding: 16, gap: 14, maxWidth: 420, width: "100%", alignSelf: "center" },
  col: { flex: 1, backgroundColor: Colors.background, borderRadius: 12 },
  cell: { paddingVertical: 9, borderRadius: 10, alignItems: "center", marginHorizontal: 4 },
  cellOn: { backgroundColor: Colors.primary },
  cellTxt: { fontSize: 14, fontWeight: "700", color: Colors.text },
  cellTxtOn: { color: "#fff" },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
