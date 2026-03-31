import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import {
  BranchTransfer,
  Department,
  Order,
  OrderItem,
  TRANSFER_REASON_PRESETS,
} from "@/context/OrdersContext";

const DEPT_LABEL: Record<Department, string> = {
  halwa: "قسم حلا زفة و ضيافة  🎂",
  mawali: "قسم معجنات و موالح  🥐",
  chocolate: "قسم شوكولاتة  🍫",
  cake: "قسم الكيك  🎂",
  packaging: "قسم التغليف  📦",
};

const DEPT_COLOR: Record<Department, string> = {
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
};

interface Props {
  visible: boolean;
  order: Order;
  department: Department;
  onConfirm: (transfer: BranchTransfer) => Promise<void>;
  onClose: () => void;
}

export function BranchTransferModal({
  visible,
  order,
  department,
  onConfirm,
  onClose,
}: Props) {
  const { currentEmployee } = useEmployee();
  const DEPT_CYCLE: Record<Department, Department> = {
    halwa: "mawali", mawali: "halwa", chocolate: "cake", cake: "chocolate",
    packaging: "halwa",
  };
  const toDept: Department = DEPT_CYCLE[department];
  const deptItems = order.items.filter((i) => i.department === department);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSelectedIds(new Set());
    setReason("");
    setNote("");
    setSaving(false);
  };

  const handleOpen = () => {
    reset();
    // Auto-select all items by default
    setSelectedIds(new Set(deptItems.map((i) => i.id)));
  };

  const toggleItem = (item: OrderItem) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const selectAll = () => {
    Haptics.selectionAsync();
    setSelectedIds(new Set(deptItems.map((i) => i.id)));
  };

  const deselectAll = () => {
    Haptics.selectionAsync();
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    if (!reason.trim()) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const transfer: BranchTransfer = {
        fromDept: department,
        toDept,
        itemIds: Array.from(selectedIds),
        reason: reason.trim(),
        note: note.trim() || undefined,
        transferredBy: currentEmployee
          ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId }
          : undefined,
        transferredAt: new Date().toISOString(),
      };
      await onConfirm(transfer);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const allSelected = selectedIds.size === deptItems.length;
  const canConfirm = selectedIds.size > 0 && reason.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="share-2" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>تحويل لفرع آخر</Text>
              <Text style={styles.headerSub}>طلب #{order.orderNumber} — {order.customerName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Route indicator */}
          <View style={styles.routeRow}>
            <View style={[styles.routePill, { backgroundColor: DEPT_COLOR[department] + "22", borderColor: DEPT_COLOR[department] + "55" }]}>
              <View style={[styles.routeDot, { backgroundColor: DEPT_COLOR[department] }]} />
              <Text style={[styles.routeText, { color: DEPT_COLOR[department] }]}>{DEPT_LABEL[department]}</Text>
            </View>
            <View style={styles.routeArrow}>
              <Feather name="arrow-left" size={16} color={Colors.textMuted} />
            </View>
            <View style={[styles.routePill, { backgroundColor: DEPT_COLOR[toDept] + "22", borderColor: DEPT_COLOR[toDept] + "55" }]}>
              <View style={[styles.routeDot, { backgroundColor: DEPT_COLOR[toDept] }]} />
              <Text style={[styles.routeText, { color: DEPT_COLOR[toDept] }]}>{DEPT_LABEL[toDept]}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Items selection */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>اختر الأصناف المُحوَّلة</Text>
              <TouchableOpacity onPress={allSelected ? deselectAll : selectAll}>
                <Text style={styles.selectAllBtn}>
                  {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                </Text>
              </TouchableOpacity>
            </View>

            {deptItems.length === 0 ? (
              <View style={styles.emptyItems}>
                <Text style={styles.emptyItemsText}>لا توجد أصناف لهذا القسم</Text>
              </View>
            ) : (
              deptItems.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemRow, selected && styles.itemRowSelected]}
                    onPress={() => toggleItem(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, !selected && styles.itemNameDim]}>
                        <Text style={styles.itemQty}>{item.quantity}× </Text>
                        {item.name}
                      </Text>
                      {item.note ? (
                        <Text style={styles.itemNote}>ملاحظة: {item.note}</Text>
                      ) : null}
                    </View>
                    {selected && (
                      <View style={[styles.transferBadge, { backgroundColor: DEPT_COLOR[toDept] + "22" }]}>
                        <Text style={[styles.transferBadgeText, { color: DEPT_COLOR[toDept] }]}>يُحوَّل</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            {/* Reason */}
            <Text style={styles.sectionTitle}>سبب التحويل *</Text>
            <View style={styles.presets}>
              {TRANSFER_REASON_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.presetChip, reason === p && styles.presetChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setReason(reason === p ? "" : p); }}
                >
                  <Text style={[styles.presetText, reason === p && styles.presetTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.inputBox}
              value={reason}
              onChangeText={setReason}
              placeholder="أو اكتب سبباً مخصصاً..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />

            {/* Note */}
            <Text style={styles.sectionTitle}>ملاحظة للقسم المستلِم (اختياري)</Text>
            <TextInput
              style={[styles.inputBox, { height: 70, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="رسالة توضيحية للقسم الآخر..."
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlign="right"
              textAlignVertical="top"
            />

            {/* Summary box */}
            {selectedIds.size > 0 && reason.trim().length > 0 && (
              <View style={[styles.summaryBox, { borderColor: DEPT_COLOR[toDept] + "40" }]}>
                <Feather name="info" size={14} color={DEPT_COLOR[toDept]} />
                <Text style={[styles.summaryText, { color: DEPT_COLOR[toDept] }]}>
                  سيتم تحويل {selectedIds.size} صنف إلى {DEPT_LABEL[toDept]}
                </Text>
              </View>
            )}

          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: canConfirm ? DEPT_COLOR[toDept] : Colors.border },
                saving && { opacity: 0.7 },
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm || saving}
              activeOpacity={0.85}
            >
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={styles.confirmText}>
                {saving ? "جاري التحويل..." : "تأكيد التحويل"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },

  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: "center", marginTop: 10, marginBottom: 2,
  },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  routeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  routePill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1,
  },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { fontSize: 11, fontWeight: "700" },
  routeArrow: { alignItems: "center" },

  body: { padding: 18, gap: 10, paddingBottom: 8 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, marginTop: 4 },
  selectAllBtn: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  emptyItems: { alignItems: "center", paddingVertical: 16 },
  emptyItemsText: { fontSize: 13, color: Colors.textMuted },

  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: Colors.borderLight,
    marginBottom: 6,
  },
  itemRowSelected: {
    borderColor: Colors.primary + "55", backgroundColor: Colors.primary + "08",
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  itemName: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  itemNameDim: { color: Colors.textMuted },
  itemQty: { fontWeight: "800", color: Colors.primary },
  itemNote: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontStyle: "italic" },
  transferBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
  },
  transferBadgeText: { fontSize: 10, fontWeight: "700" },

  presets: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 8 },
  presetChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  presetChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "14" },
  presetText: { fontSize: 11, color: Colors.textSecondary },
  presetTextActive: { color: Colors.primary, fontWeight: "700" },

  inputBox: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight,
    marginBottom: 4,
  },

  summaryBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12, borderWidth: 1.5,
    backgroundColor: Colors.surfaceSecondary, marginTop: 4,
  },
  summaryText: { fontSize: 12, fontWeight: "600", flex: 1 },

  actions: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center",
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  confirmBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  confirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
