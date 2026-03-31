import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BranchTransferModal } from "@/components/BranchTransferModal";
import { Colors } from "@/constants/colors";
import { ROLE_LABELS, useEmployee } from "@/context/EmployeeContext";
import {
  BranchTransfer,
  Department,
  EmployeeRef,
  Order,
  OrderStatus,
  useOrders,
} from "@/context/OrdersContext";

interface DeptOrderCardProps {
  order: Order;
  department: Department;
  onStatusChange: (status: OrderStatus, receiver?: EmployeeRef) => void;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; bg: string; next?: OrderStatus; nextLabel?: string }
> = {
  pending: {
    label: "انتظار",
    color: Colors.statusPending,
    bg: "#FEF9E7",
    next: "in_progress",
    nextLabel: "▶  بدء التحضير",
  },
  in_progress: {
    label: "جاري التحضير",
    color: Colors.statusInProgress,
    bg: "#EBF5FB",
    next: "done",
    nextLabel: "✓  تم التسليم",
  },
  done: { label: "تم التسليم", color: Colors.statusDone, bg: "#E9F7EF" },
  cancelled: { label: "ملغي", color: Colors.statusCancelled, bg: "#FDEDEC" },
};

const DEPT_LABEL: Record<Department, string> = {
  halwa: "حلا زفة",
  mawali: "معجنات",
  chocolate: "شوكولاتة",
  cake: "كيك",
  packaging: "التغليف",
};

function fmtTime(str: string) {
  if (str.includes("T")) {
    const d = new Date(str);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return str.length > 10 ? str.slice(11, 16) : str;
}

export function DeptOrderCard({ order, department, onStatusChange }: DeptOrderCardProps) {
  const deptItems = order.items.filter((i) => i.department === department);
  const deptStatus = order.departmentStatuses[department] ?? "pending";
  const status = statusConfig[deptStatus];
  const DEPT_COLORS: Record<Department, string> = {
    halwa: Colors.halwa, mawali: Colors.mawali,
    chocolate: Colors.chocolate, cake: Colors.cake,
    packaging: Colors.packaging,
  };
  const deptColor = DEPT_COLORS[department] ?? Colors.halwa;
  const receiver = order.departmentReceivers?.[department];
  const { currentEmployee } = useEmployee();
  const { transferToBranch } = useOrders();
  const [transferModalVisible, setTransferModalVisible] = useState(false);

  const transfer = order.branchTransfer;
  const isReceivedTransfer = transfer?.toDept === department;
  const isSentTransfer = transfer?.fromDept === department;
  const canTransfer = deptStatus === "pending" || deptStatus === "in_progress";

  const handleStatusPress = () => {
    if (!status.next) return;
    if (status.next === "in_progress" && !currentEmployee) {
      Alert.alert(
        "تسجيل الدخول مطلوب",
        "يجب عليك تسجيل الدخول أولاً لاستلام الطلب. اضغط على اسمك في الرأس.",
        [{ text: "حسناً" }]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const empRef: EmployeeRef | undefined =
      status.next === "in_progress" && currentEmployee
        ? {
            name: currentEmployee.name,
            employeeId: currentEmployee.employeeId,
            timestamp: new Date().toISOString(),
          }
        : undefined;
    onStatusChange(status.next, empRef);
  };

  const handleTransferConfirm = async (t: BranchTransfer) => {
    await transferToBranch(order.id, t);
  };

  const DEPT_CYCLE: Record<Department, Department> = {
    halwa: "mawali", mawali: "halwa", chocolate: "cake", cake: "chocolate",
    packaging: "halwa",
  };
  const toDept: Department = DEPT_CYCLE[department];
  const toDeptColor = DEPT_COLORS[toDept] ?? Colors.mawali;
  const canTransferFromDept = department !== "packaging";

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: deptColor }]} />
      <View style={styles.body}>

        {/* Received-transfer banner */}
        {isReceivedTransfer && (
          <View style={[styles.transferBanner, { borderColor: deptColor + "50", backgroundColor: deptColor + "12" }]}>
            <View style={[styles.transferBannerIcon, { backgroundColor: deptColor }]}>
              <Feather name="share-2" size={12} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.transferBannerTitle, { color: deptColor }]}>
                محوَّل من {DEPT_LABEL[transfer!.fromDept]}
              </Text>
              <Text style={styles.transferBannerSub}>
                {transfer!.reason}
                {transfer!.note ? `  ·  ${transfer!.note}` : ""}
                {transfer!.transferredBy ? `  ·  بواسطة: ${transfer!.transferredBy.name}` : ""}
              </Text>
            </View>
            <View style={[styles.newBadge, { backgroundColor: deptColor }]}>
              <Text style={styles.newBadgeText}>جديد</Text>
            </View>
          </View>
        )}

        {/* Sent-transfer indicator */}
        {isSentTransfer && !isReceivedTransfer && (
          <View style={styles.sentTransferRow}>
            <Feather name="share-2" size={11} color={Colors.textMuted} />
            <Text style={styles.sentTransferText}>
              تم تحويل {transfer!.itemIds.length} صنف إلى {DEPT_LABEL[transfer!.toDept]}
              {" · "}{transfer!.reason}
            </Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.num}>#{order.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.time}>{fmtTime(order.receivedAt)}</Text>
        </View>

        {/* Customer */}
        <View style={styles.customerRow}>
          <View style={styles.infoItem}>
            <Feather name="user" size={13} color={Colors.primary} />
            <Text style={styles.customerName}>{order.customerName}</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="phone" size={12} color={Colors.textMuted} />
            <Text style={styles.customerPhone}>
              {order.customerPhone}
              {order.customerPhone2 ? ` / ${order.customerPhone2}` : ""}
            </Text>
          </View>
        </View>

        {/* Items for this dept */}
        <View style={styles.itemsBox}>
          <Text style={styles.itemsTitle}>الأصناف</Text>
          {deptItems.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={[styles.bullet, { backgroundColor: deptColor }]} />
              <Text style={styles.itemName} numberOfLines={1}>
                <Text style={styles.itemQty}>{item.quantity}×  </Text>
                {item.name}
              </Text>
              {item.note ? (
                <Text style={styles.itemNote} numberOfLines={1}>({item.note})</Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Delivery & insurance */}
        {(order.deliveryTime || order.insuranceAmount != null) && (
          <View style={styles.metaRow}>
            {order.deliveryTime ? (
              <View style={styles.infoItem}>
                <Feather name="clock" size={12} color={Colors.success} />
                <Text style={styles.metaText}>تسليم: {order.deliveryTime}</Text>
              </View>
            ) : null}
            {order.insuranceAmount != null ? (
              <View style={styles.infoItem}>
                <Feather name="shield" size={12} color={Colors.gold} />
                <Text style={[styles.metaText, { color: Colors.gold, fontWeight: "700" }]}>
                  {order.insuranceAmount} ر.س
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Employee trail */}
        <View style={styles.trailBox}>
          {order.cashierEmployee && (
            <View style={styles.trailRow}>
              <Feather name="edit-3" size={12} color={Colors.gold} />
              <Text style={styles.trailLabel}>أدخل الطلب:</Text>
              <Text style={styles.trailName}>{order.cashierEmployee.name}</Text>
              <Text style={styles.trailId}>#{order.cashierEmployee.employeeId}</Text>
            </View>
          )}
          {receiver ? (
            <View style={styles.trailRow}>
              <Feather name="check-square" size={12} color={deptColor} />
              <Text style={styles.trailLabel}>استلم في القسم:</Text>
              <Text style={[styles.trailName, { color: deptColor }]}>{receiver.name}</Text>
              <Text style={styles.trailId}>#{receiver.employeeId}</Text>
            </View>
          ) : deptStatus !== "pending" ? null : (
            currentEmployee ? (
              <View style={styles.trailRow}>
                <Feather name="user-check" size={12} color={Colors.textMuted} />
                <Text style={[styles.trailLabel, { color: Colors.textMuted }]}>
                  سيُسجَّل باسمك عند الاستلام
                </Text>
              </View>
            ) : null
          )}
        </View>

        {order.imageUri && (
          <Image source={{ uri: order.imageUri }} style={styles.img} contentFit="cover" />
        )}

        {order.notes ? (
          <View style={styles.infoItem}>
            <Feather name="file-text" size={12} color={Colors.textMuted} />
            <Text style={styles.notesText} numberOfLines={1}>{order.notes}</Text>
          </View>
        ) : null}

        {/* Transfer button (only when order is active and no transfer done yet OR received) */}
        {canTransfer && canTransferFromDept && !isSentTransfer && (
          <TouchableOpacity
            style={[styles.transferBtn, { borderColor: toDeptColor + "60" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTransferModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Feather name="share-2" size={14} color={toDeptColor} />
            <Text style={[styles.transferBtnText, { color: toDeptColor }]}>
              تحويل لـ {DEPT_LABEL[toDept]}
            </Text>
          </TouchableOpacity>
        )}

        {/* Main action */}
        {status.next ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: status.color }]}
            onPress={handleStatusPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{status.nextLabel}</Text>
            {status.next === "in_progress" && !currentEmployee && (
              <Text style={styles.actionSubText}>(يتطلب تسجيل دخول)</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.doneRow, { backgroundColor: status.bg }]}>
            <Feather name="check-circle" size={15} color={status.color} />
            <Text style={[styles.doneText, { color: status.color }]}>{status.label}</Text>
          </View>
        )}
      </View>

      {/* Transfer Modal */}
      <BranchTransferModal
        visible={transferModalVisible}
        order={order}
        department={department}
        onConfirm={handleTransferConfirm}
        onClose={() => setTransferModalVisible(false)}
      />
    </View>
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
  stripe: { width: 5 },
  body: { flex: 1, padding: 14, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  num: {
    fontSize: 20, fontWeight: "800", color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: "700" },
  time: { fontSize: 13, color: Colors.textMuted, fontWeight: "500" },
  customerRow: { flexDirection: "row", gap: 16 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  customerName: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  customerPhone: { fontSize: 13, color: Colors.textSecondary },
  itemsBox: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: 10, gap: 6,
  },
  itemsTitle: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", marginBottom: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  itemName: { flex: 1, fontSize: 14, color: Colors.text },
  itemQty: { fontWeight: "700", color: Colors.primary },
  itemNote: { fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },
  metaRow: { flexDirection: "row", gap: 16 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  trailBox: {
    backgroundColor: Colors.primary + "07",
    borderRadius: 10, padding: 10, gap: 7,
    borderWidth: 1, borderColor: Colors.primary + "15",
  },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  trailLabel: { fontSize: 11, color: Colors.textSecondary },
  trailName: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  trailId: { fontSize: 11, color: Colors.textMuted },
  img: { width: "100%", height: 110, borderRadius: 8 },
  notesText: { fontSize: 12, color: Colors.textMuted, flex: 1, fontStyle: "italic" },

  // Transfer received banner
  transferBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, padding: 10, borderWidth: 1.5,
  },
  transferBannerIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  transferBannerTitle: { fontSize: 12, fontWeight: "700" },
  transferBannerSub: { fontSize: 10, color: Colors.textMuted, marginTop: 2, lineHeight: 14 },
  newBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
  },
  newBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  // Sent transfer indicator
  sentTransferRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  sentTransferText: { fontSize: 11, color: Colors.textMuted, flex: 1 },

  // Transfer button
  transferBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: 12, paddingVertical: 10,
    borderWidth: 1.5, backgroundColor: Colors.surfaceSecondary,
  },
  transferBtnText: { fontSize: 13, fontWeight: "700" },

  // Action button
  actionBtn: {
    borderRadius: 12, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
  },
  actionText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  actionSubText: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  doneRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, paddingVertical: 10,
  },
  doneText: { fontSize: 13, fontWeight: "700" },
});
