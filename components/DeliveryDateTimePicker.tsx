import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import type { Lang } from "@/constants/translations";
import { t as translate } from "@/constants/translations";

// ── Helpers ────────────────────────────────────────────────────────────────────

const LOCALE_MAP: Record<Lang, string> = {
  ar: "ar-SA",
  en: "en",
  ur: "ur",
  hi: "hi",
  bn: "bn",
};

function buildDays(count = 14, lang: Lang = "ar") {
  const locale = LOCALE_MAP[lang];
  const days: { label: string; sub: string; value: string; date: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let label = dayFmt.format(d);
    if (i === 0) label = translate("today", lang);
    else if (i === 1) label = translate("tomorrow", lang);
    const sub = dateFmt.format(d);
    days.push({ label, sub, value: iso, date: d });
  }
  return days;
}

function buildTimeSlots(lang: Lang = "ar") {
  const locale = LOCALE_MAP[lang];
  const slots: { display: string; value: string }[] = [];
  for (let h = 8; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const d = new Date(2000, 0, 1, h, m);
      const display = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d);
      const value = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
      slots.push({ display, value });
    }
  }
  return slots;
}

// ── Date Picker ─────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;
  onChange: (iso: string, label: string) => void;
  accentColor?: string;
  lang?: Lang;
}

export function DeliveryDatePicker({ value, onChange, accentColor = Colors.primary, lang = "ar" }: DatePickerProps) {
  const listRef = useRef<FlatList>(null);
  const days = useMemo(() => buildDays(14, lang), [lang]);

  const handleSelect = useCallback((day: ReturnType<typeof buildDays>[0]) => {
    Haptics.selectionAsync();
    onChange(day.value, `${day.label} (${day.sub})`);
  }, [onChange]);

  return (
    <FlatList
      ref={listRef}
      data={days}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(d) => d.value}
      contentContainerStyle={styles.dateRow}
      inverted
      renderItem={({ item: day }) => {
        const active = value === day.value;
        return (
          <TouchableOpacity
            style={[styles.dayChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => handleSelect(day)}
            activeOpacity={0.75}
          >
            <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.label}</Text>
            <Text style={[styles.daySub, active && styles.daySubActive]}>{day.sub}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── Time Picker ─────────────────────────────────────────────────────────────────

interface TimePickerProps {
  value: string;
  onChange: (v: string) => void;
  accentColor?: string;
  lang?: Lang;
}

export function DeliveryTimePicker({ value, onChange, accentColor = Colors.primary, lang = "ar" }: TimePickerProps) {
  const slots = useMemo(() => buildTimeSlots(lang), [lang]);

  const handleSelect = useCallback((slot: ReturnType<typeof buildTimeSlots>[0]) => {
    Haptics.selectionAsync();
    onChange(slot.value);
  }, [onChange]);

  const rows = useMemo(() => {
    const result: (typeof slots)[] = [];
    for (let i = 0; i < slots.length; i += 4) {
      result.push(slots.slice(i, i + 4));
    }
    return result;
  }, [slots]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.timeScrollContent}
    >
      <View style={styles.timeGrid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.timeRow}>
            {row.map((slot) => {
              const active = value === slot.value;
              return (
                <TouchableOpacity
                  key={slot.value}
                  style={[styles.timeChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
                  onPress={() => handleSelect(slot)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.timeText, active && styles.timeTextActive]}>
                    {slot.display}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dateRow: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: "row",
  },
  dayChip: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 2,
    minWidth: 72,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  dayLabelActive: { color: "#fff" },
  daySub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  daySubActive: { color: "rgba(255,255,255,0.85)" },

  timeScrollContent: {
    paddingHorizontal: 4,
  },
  timeGrid: {
    gap: 6,
  },
  timeRow: {
    flexDirection: "row",
    gap: 6,
  },
  timeChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    minWidth: 78,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  timeTextActive: { color: "#fff" },
});
