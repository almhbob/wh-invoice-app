import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { Department, Order, OrderStatus } from "@/context/OrdersContext";

interface OrderCardProps {
  order: Order;
  onStatusChange?: (status: OrderStatus) => void;
  onPress?: () => void;
  compact?: boolean;
}

const departmentLabels: Record<Department, string> = {
  halwa: "حلا",
  mawali: "موالح",
};

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; bg: string; next?: OrderStatus; nextLabel?: string }
> = {
  pending: {
    label: "انتظار",
    color: Colors.statusPending,
    bg: "#FEF9E7",
    next: "in_progress",
    nextLabel: "بدء التحضير",
  },
  in_progress: {
    label: "جاري التحضير",
    color: Colors.statusInProgress,
    bg: "#EBF5FB",
    next: "done",
    nextLabel: "تم التسليم",
  },
  done: { label: "تم التسليم", color: Colors.statusDone, bg: "#E9F7EF" },
  cancelled: { label: "ملغي", color: Colors.statusCancelled, bg: "#FDEDEC" },
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export function OrderCard({ order, onStatusChange, onPress, compact = false }: OrderCardProps) {
  const status = statusConfig[order.status];
  const deptColor = order.department === "halwa" ? Colors.halwa : Colors.mawali;

  const handleStatusPress = () => {
    if (status.next && onStatusChange) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStatusChange(status.next);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.deptStripe, { backgroundColor: deptColor }]} />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            <View style={[styles.deptBadge, { backgroundColor: deptColor + "20" }]}>
              <Text style={[styles.deptText, { color: deptColor }]}>
                {departmentLabels[order.department]}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.customerBlock}>
          <View style={styles.customerRow}>
            <Feather name="user" size={13} color={Colors.primary} />
            <Text style={styles.customerName}>{order.customerName}</Text>
          </View>
          <View style={styles.customerRow}>
            <Feather name="phone" size={13} color={Colors.textSecondary} />
            <Text style={styles.customerPhone}>{order.customerPhone}</Text>
          </View>
        </View>

        {/* Time Row */}
        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Feather name="download" size={12} color={Colors.textMuted} />
            <Text style={styles.timeLabel}>الاستلام</Text>
            <Text style={styles.timeValue}>{order.receivedAt}</Text>
          </View>
          {order.deliveryTime ? (
            <>
              <View style={styles.timeDivider} />
              <View style={styles.timeItem}>
                <Feather name="upload" size={12} color={Colors.success} />
                <Text style={styles.timeLabel}>التسليم</Text>
                <Text style={[styles.timeValue, { color: Colors.success }]}>{order.deliveryTime}</Text>
              </View>
            </>
          ) : null}
          {order.insuranceAmount != null ? (
            <>
              <View style={styles.timeDivider} />
              <View style={styles.timeItem}>
                <Feather name="shield" size={12} color={Colors.gold} />
                <Text style={styles.timeLabel}>تأمين</Text>
                <Text style={[styles.timeValue, { color: Colors.gold, fontWeight: "700" }]}>
                  {order.insuranceAmount} ر.س
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Items */}
        {!compact && order.items.length > 0 && (
          <View style={styles.itemsSection}>
            {order.items.slice(0, 3).map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemBullet} />
                <Text style={styles.itemText}>
                  {item.quantity}x {item.name}
                  {item.note ? <Text style={styles.itemNote}> ({item.note})</Text> : null}
                </Text>
              </View>
            ))}
            {order.items.length > 3 && (
              <Text style={styles.moreItems}>+{order.items.length - 3} عناصر أخرى</Text>
            )}
          </View>
        )}

        {order.notes && !compact && (
          <View style={styles.notesRow}>
            <Feather name="file-text" size={13} color={Colors.textMuted} />
            <Text style={styles.notesText} numberOfLines={1}>{order.notes}</Text>
          </View>
        )}

        {order.imageUri && !compact && (
          <Image source={{ uri: order.imageUri }} style={styles.orderImage} contentFit="cover" />
        )}

        <View style={styles.footer}>
          <Text style={styles.dateText}>{fmtDate(order.createdAt)}</Text>
          {status.next && onStatusChange && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: status.color }]}
              onPress={handleStatusPress}
            >
              <Text style={styles.actionBtnText}>{status.nextLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  deptStripe: { width: 4 },
  content: { flex: 1, padding: 14, gap: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderNum: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
  },
  deptBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deptText: { fontSize: 12, fontWeight: "600" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  customerBlock: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customerName: { fontSize: 14, fontWeight: "700", color: Colors.primary, flex: 1, textAlign: "right" },
  customerPhone: { fontSize: 13, color: Colors.textSecondary, flex: 1, textAlign: "right" },
  timeRow: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  timeItem: { flex: 1, alignItems: "center", gap: 3 },
  timeLabel: { fontSize: 10, color: Colors.textMuted },
  timeValue: { fontSize: 11, color: Colors.text, fontWeight: "600", textAlign: "center" },
  timeDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },
  itemsSection: { gap: 4, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.gold },
  itemText: { fontSize: 13, color: Colors.text, flex: 1 },
  itemNote: { color: Colors.textMuted, fontSize: 12 },
  moreItems: { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginRight: 13 },
  notesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notesText: { fontSize: 12, color: Colors.textMuted, flex: 1, fontStyle: "italic" },
  orderImage: { width: "100%", height: 120, borderRadius: 8 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  dateText: { fontSize: 12, color: Colors.textMuted },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
