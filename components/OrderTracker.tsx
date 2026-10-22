import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { Order } from "@/context/OrdersContext";
import { useLang } from "@/context/LanguageContext";
import { orderStage, stepIndex, STAGE_META, trackerSteps } from "@/utils/orderFlow";

/** Horizontal progress stepper: received → production → ready → (driver →) delivered / picked up. */
export function OrderTracker({ order, compact }: { order: Order; compact?: boolean }) {
  const { lang } = useLang();
  const steps = trackerSteps(order);
  const current = stepIndex(order);
  const stage = orderStage(order);
  const failed = stage === "delivery_failed";
  const cancelled = stage === "cancelled";

  return (
    <View style={st.wrap}>
      <View style={st.row}>
        {steps.map((s, i) => {
          const done = i < current || (i === current && (s === "delivered" || s === "picked_up"));
          const active = i === current && !done;
          const meta = STAGE_META[s];
          const color = cancelled ? Colors.textMuted : done ? Colors.statusDone : active ? (failed ? Colors.statusCancelled : meta.color) : Colors.border;
          return (
            <React.Fragment key={s}>
              {i > 0 && <View style={[st.line, { backgroundColor: i <= current && !cancelled ? Colors.statusDone : Colors.border }]} />}
              <View style={st.step}>
                <View style={[st.dot, compact && st.dotCompact, { borderColor: color, backgroundColor: done ? color : active ? color + "1A" : Colors.surface }]}>
                  <Feather
                    name={(done ? "check" : failed && active ? "alert-triangle" : meta.icon) as never}
                    size={compact ? 10 : 13}
                    color={done ? "#fff" : color}
                  />
                </View>
                {!compact && (
                  <Text style={[st.label, (done || active) && { color: Colors.text, fontWeight: "700" }]} numberOfLines={2}>
                    {lang === "ar" ? meta.ar : meta.en}
                  </Text>
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

export function StageBadge({ order, size = "md" }: { order: Order; size?: "sm" | "md" }) {
  const { lang } = useLang();
  const stage = orderStage(order);
  const meta = STAGE_META[stage];
  return (
    <View style={[st.badge, size === "sm" && st.badgeSm, { backgroundColor: meta.color + "16", borderColor: meta.color + "40" }]}>
      <Feather name={meta.icon as never} size={size === "sm" ? 10 : 12} color={meta.color} />
      <Text style={[st.badgeTxt, size === "sm" && { fontSize: 10 }, { color: meta.color }]}>{lang === "ar" ? meta.ar : meta.en}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:     { paddingVertical: 4 },
  row:      { flexDirection: "row", alignItems: "flex-start" },
  step:     { alignItems: "center", gap: 6, width: 58 },
  dot:      { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dotCompact: { width: 20, height: 20, borderRadius: 10 },
  line:     { flex: 1, height: 2, marginTop: 13, borderRadius: 1 },
  label:    { fontSize: 10, color: Colors.textMuted, textAlign: "center", fontWeight: "600" },
  badge:    { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeSm:  { paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: "800" },
});
