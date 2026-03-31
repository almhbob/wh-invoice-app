import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { Order } from "@/context/OrdersContext";

interface StatsBarProps {
  orders: Order[];
}

export function StatsBar({ orders }: StatsBarProps) {
  const pending = orders.filter((o) => o.status === "pending").length;
  const inProgress = orders.filter((o) => o.status === "in_progress").length;
  const done = orders.filter((o) => o.status === "done").length;

  return (
    <View style={styles.container}>
      <StatItem label="انتظار" value={pending} color={Colors.statusPending} />
      <View style={styles.divider} />
      <StatItem label="تحضير" value={inProgress} color={Colors.statusInProgress} />
      <View style={styles.divider} />
      <StatItem label="تم" value={done} color={Colors.statusDone} />
      <View style={styles.divider} />
      <StatItem label="المجموع" value={orders.length} color={Colors.primary} />
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  item: {
    flex: 1,
    alignItems: "center",
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
  },
  label: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
});
