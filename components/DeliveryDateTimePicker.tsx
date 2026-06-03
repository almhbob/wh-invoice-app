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

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function buildDays(count = 14) {
  const days: { label: string; sub: string; value: string; date: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = DAY_AR[d.getDay()];
    const dayNum = d.getDate();
    const month = MONTH_AR[d.getMonth()];
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    let label = dayName;
    if (i === 0) label = "اليوم";
    else if (i === 1) label = "غداً";
    const sub = `${dayNum} ${month}`;
    days.push({ label, sub, value: iso, date: d });
  }
  return days;
}

// Time slots: 8:00 AM to 11:00 PM in 30-min steps
function buildTimeSlots() {
  const slots: { display: string; value: string }[] = [];
  for (let h = 8; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const period = h < 12 ? "ص" : "م";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const mm = m === 0 ? "00" : "30";
      const display = `${h12}:${mm} ${period}`;
      const value = `${String(h).padStart(2, "0")}:${mm}`;
      slots.push({ display, value });
    }
  }
  return slots;
}

const DAYS = buildDays(14);
const TIME_SLOTS = buildTimeSlots();

// ── Date Picker ─────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string; // ISO date string "YYYY-MM-DD" or empty
  onChange: (iso: string, label: string) => void;
  accentColor?: string;
}

export function DeliveryDatePicker({ value, onChange, accentColor = Colors.primary }: DatePickerProps) {
  const listRef = useRef<FlatList>(null);

  const handleSelect = useCallback((day: typeof DAYS[0]) => {
    Haptics.selectionAsync();
    onChange(day.value, `${day.label} (${day.sub})`);
  }, [onChange]);

  return (
    <FlatList
      ref={listRef}
      data={DAYS}
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
  value: string; // "HH:MM" or empty
  onChange: (v: string) => void;
  accentColor?: string;
}

export function DeliveryTimePicker({ value, onChange, accentColor = Colors.primary }: TimePickerProps) {
  const handleSelect = useCallback((slot: typeof TIME_SLOTS[0]) => {
    Haptics.selectionAsync();
    onChange(slot.value);
  }, [onChange]);

  // Split into rows of 4
  const rows = useMemo(() => {
    const result: (typeof TIME_SLOTS)[] = [];
    for (let i = 0; i < TIME_SLOTS.length; i += 4) {
      result.push(TIME_SLOTS.slice(i, i + 4));
    }
    return result;
  }, []);

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
  // Date chips
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

  // Time grid
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
