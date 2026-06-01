import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  Modal,
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
  const days: { label: string; sub: string; value: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let label = DAY_AR[d.getDay()];
    if (i === 0) label = "اليوم";
    else if (i === 1) label = "غداً";
    days.push({ label, sub: `${d.getDate()} ${MONTH_AR[d.getMonth()]}`, value: iso });
  }
  return days;
}

function buildTimeSlots() {
  const slots: { display: string; value: string }[] = [];
  for (let h = 8; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const period = h < 12 ? "ص" : "م";
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const mm = m === 0 ? "00" : "30";
      slots.push({ display: `${h12}:${mm} ${period}`, value: `${String(h).padStart(2, "0")}:${mm}` });
    }
  }
  return slots;
}

const DAYS = buildDays(14);
const TIME_SLOTS = buildTimeSlots();

// ── Combined Picker (Modal bottom sheet) ────────────────────────────────────────

interface CombinedProps {
  dateValue: string;
  timeValue: string;
  onDateChange: (iso: string) => void;
  onTimeChange: (time: string) => void;
  accentColor?: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function DeliveryDateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  accentColor = Colors.primary,
  open,
  onOpen,
  onClose,
}: CombinedProps) {
  const selectedDay = useMemo(() => DAYS.find((d) => d.value === dateValue), [dateValue]);
  const selectedSlot = useMemo(() => TIME_SLOTS.find((s) => s.value === timeValue), [timeValue]);

  const dateLabel = selectedDay ? `${selectedDay.label} · ${selectedDay.sub}` : "التاريخ";
  const timeLabel = selectedSlot ? selectedSlot.display : "الوقت";
  const hasValue = Boolean(dateValue || timeValue);

  const clearAll = useCallback(() => {
    onDateChange("");
    onTimeChange("");
  }, [onDateChange, onTimeChange]);

  return (
    <>
      {/* ── Compact trigger pill ── */}
      <TouchableOpacity
        style={[styles.trigger, hasValue && { borderColor: accentColor + "80" }]}
        onPress={() => { Haptics.selectionAsync(); onOpen(); }}
        activeOpacity={0.75}
      >
        <View style={styles.triggerPart}>
          <Feather name="calendar" size={14} color={dateValue ? accentColor : Colors.textMuted} />
          <Text style={[styles.triggerText, dateValue && { color: Colors.text, fontWeight: "700" }]}>
            {dateLabel}
          </Text>
        </View>
        <View style={styles.triggerDivider} />
        <View style={styles.triggerPart}>
          <Feather name="clock" size={14} color={timeValue ? accentColor : Colors.textMuted} />
          <Text style={[styles.triggerText, timeValue && { color: Colors.text, fontWeight: "700" }]}>
            {timeLabel}
          </Text>
        </View>
        {hasValue ? (
          <TouchableOpacity
            onPress={clearAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearBtn}
          >
            <Feather name="x" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <Feather name="chevron-down" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
        )}
      </TouchableOpacity>

      {/* ── Bottom sheet modal ── */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>موعد التسليم</Text>
            {hasValue && (
              <TouchableOpacity onPress={clearAll}>
                <Text style={[styles.clearAllText, { color: accentColor }]}>مسح</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date section */}
          <Text style={styles.sectionLabel}>التاريخ</Text>
          <FlatList
            data={DAYS}
            horizontal
            inverted
            showsHorizontalScrollIndicator={false}
            keyExtractor={(d) => d.value}
            contentContainerStyle={styles.chipRow}
            renderItem={({ item: day }) => {
              const active = dateValue === day.value;
              return (
                <TouchableOpacity
                  style={[styles.dayChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
                  onPress={() => { Haptics.selectionAsync(); onDateChange(day.value); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dayLabel, active && styles.activeText]}>{day.label}</Text>
                  <Text style={[styles.daySub, active && styles.activeSubText]}>{day.sub}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Time section */}
          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>الوقت</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {TIME_SLOTS.map((slot) => {
              const active = timeValue === slot.value;
              return (
                <TouchableOpacity
                  key={slot.value}
                  style={[styles.timeChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
                  onPress={() => { Haptics.selectionAsync(); onTimeChange(slot.value); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.timeText, active && styles.activeText]}>{slot.display}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Confirm */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: accentColor }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.confirmText}>تأكيد</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ── Backward-compatible individual exports ──────────────────────────────────────

interface DatePickerProps {
  value: string;
  onChange: (iso: string, label: string) => void;
  accentColor?: string;
}

export function DeliveryDatePicker({ value, onChange, accentColor = Colors.primary }: DatePickerProps) {
  return (
    <FlatList
      data={DAYS}
      horizontal
      inverted
      showsHorizontalScrollIndicator={false}
      keyExtractor={(d) => d.value}
      contentContainerStyle={styles.chipRow}
      renderItem={({ item: day }) => {
        const active = value === day.value;
        return (
          <TouchableOpacity
            style={[styles.dayChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => { Haptics.selectionAsync(); onChange(day.value, `${day.label} (${day.sub})`); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.dayLabel, active && styles.activeText]}>{day.label}</Text>
            <Text style={[styles.daySub, active && styles.activeSubText]}>{day.sub}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

interface TimePickerProps {
  value: string;
  onChange: (v: string) => void;
  accentColor?: string;
}

export function DeliveryTimePicker({ value, onChange, accentColor = Colors.primary }: TimePickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {TIME_SLOTS.map((slot) => {
        const active = value === slot.value;
        return (
          <TouchableOpacity
            key={slot.value}
            style={[styles.timeChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => { Haptics.selectionAsync(); onChange(slot.value); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.timeText, active && styles.activeText]}>{slot.display}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Trigger pill
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  triggerPart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  triggerDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  triggerText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  clearBtn: {
    marginLeft: 4,
    padding: 2,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // Day chips
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
  daySub: {
    fontSize: 10,
    color: Colors.textMuted,
  },

  // Time chips
  timeChip: {
    paddingVertical: 10,
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

  // Active states
  activeText: { color: "#fff" },
  activeSubText: { color: "rgba(255,255,255,0.8)" },

  // Confirm button
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
