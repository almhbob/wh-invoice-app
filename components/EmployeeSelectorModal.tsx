import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import {
  Employee,
  EmployeeRole,
  ROLE_LABELS,
  useEmployee,
} from "@/context/EmployeeContext";

const ROLE_COLORS: Record<EmployeeRole, string> = {
  cashier: Colors.primary,
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
  admin: Colors.gold,
};

const ROLE_ICONS: Record<EmployeeRole, string> = {
  cashier: "dollar-sign",
  halwa: "coffee",
  mawali: "package",
  chocolate: "gift",
  cake: "layers",
  packaging: "box",
  admin: "shield",
};

const ROLES: EmployeeRole[] = ["cashier", "halwa", "mawali", "chocolate", "cake", "packaging", "admin"];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function EmployeeSelectorModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { employees, currentEmployee, setCurrentEmployee, addEmployee, removeEmployee } =
    useEmployee();
  const [tab, setTab] = useState<"select" | "add">("select");
  const [newName, setNewName] = useState("");
  const [newEmpId, setNewEmpId] = useState("");
  const [newRole, setNewRole] = useState<EmployeeRole>("cashier");
  const [saving, setSaving] = useState(false);

  const handleSelect = (emp: Employee) => {
    Haptics.selectionAsync();
    setCurrentEmployee(emp);
    onClose();
  };

  const handleLogout = () => {
    setCurrentEmployee(null);
    onClose();
  };

  const handleAddEmployee = async () => {
    if (!newName.trim()) { Alert.alert("خطأ", "أدخل اسم الموظف"); return; }
    if (!newEmpId.trim()) { Alert.alert("خطأ", "أدخل الرقم الوظيفي"); return; }
    const exists = employees.find(
      (e) => e.employeeId.toLowerCase() === newEmpId.trim().toLowerCase()
    );
    if (exists) { Alert.alert("خطأ", "هذا الرقم الوظيفي مستخدم مسبقاً"); return; }
    setSaving(true);
    try {
      await addEmployee({
        name: newName.trim(),
        employeeId: newEmpId.trim().toUpperCase(),
        role: newRole,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewName(""); setNewEmpId(""); setNewRole("cashier");
      setTab("select");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (emp: Employee) => {
    Alert.alert(
      "حذف الموظف",
      `هل تريد حذف "${emp.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => removeEmployee(emp.id),
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>الموظفون</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === "select" && styles.tabActive]}
            onPress={() => setTab("select")}
          >
            <Text style={[styles.tabText, tab === "select" && styles.tabTextActive]}>
              اختيار الموظف
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "add" && styles.tabActive]}
            onPress={() => setTab("add")}
          >
            <Text style={[styles.tabText, tab === "add" && styles.tabTextActive]}>
              إضافة موظف
            </Text>
          </TouchableOpacity>
        </View>

        {tab === "select" ? (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {currentEmployee && (
              <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
                <Feather name="log-out" size={15} color={Colors.accent} />
                <Text style={styles.logoutText}>تسجيل خروج "{currentEmployee.name}"</Text>
              </TouchableOpacity>
            )}

            {employees.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="users" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>لا يوجد موظفون</Text>
                <Text style={styles.emptySubText}>اضغط "إضافة موظف" لإضافة أول موظف</Text>
              </View>
            ) : (
              ROLES.map((role) => {
                const roleEmps = employees.filter((e) => e.role === role);
                if (roleEmps.length === 0) return null;
                return (
                  <View key={role} style={styles.roleGroup}>
                    <View style={[styles.roleHeader, { backgroundColor: ROLE_COLORS[role] + "15" }]}>
                      <Feather name={ROLE_ICONS[role] as any} size={14} color={ROLE_COLORS[role]} />
                      <Text style={[styles.roleTitle, { color: ROLE_COLORS[role] }]}>
                        {ROLE_LABELS[role]}
                      </Text>
                    </View>
                    {roleEmps.map((emp) => {
                      const isCurrent = currentEmployee?.id === emp.id;
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          style={[styles.empCard, isCurrent && styles.empCardActive]}
                          onPress={() => handleSelect(emp)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.empAvatar,
                              { backgroundColor: ROLE_COLORS[role] + (isCurrent ? "FF" : "25") },
                            ]}
                          >
                            <Text
                              style={[
                                styles.empAvatarText,
                                { color: isCurrent ? "#fff" : ROLE_COLORS[role] },
                              ]}
                            >
                              {emp.name.charAt(0)}
                            </Text>
                          </View>
                          <View style={styles.empInfo}>
                            <Text style={styles.empName}>{emp.name}</Text>
                            <Text style={styles.empIdText}>#{emp.employeeId}</Text>
                          </View>
                          {isCurrent ? (
                            <Feather name="check-circle" size={20} color={ROLE_COLORS[role]} />
                          ) : null}
                          <TouchableOpacity
                            style={styles.delBtn}
                            onPress={() => handleRemove(emp)}
                            hitSlop={10}
                          >
                            <Feather name="trash-2" size={15} color={Colors.textMuted} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.addContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>اسم الموظف *</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="أدخل الاسم الكامل"
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>الرقم الوظيفي *</Text>
            <TextInput
              style={styles.input}
              value={newEmpId}
              onChangeText={setNewEmpId}
              placeholder="مثال: EMP001"
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>الدور الوظيفي</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChip,
                    newRole === r && {
                      backgroundColor: ROLE_COLORS[r],
                      borderColor: ROLE_COLORS[r],
                    },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setNewRole(r); }}
                >
                  <Feather
                    name={ROLE_ICONS[r] as any}
                    size={14}
                    color={newRole === r ? "#fff" : ROLE_COLORS[r]}
                  />
                  <Text
                    style={[
                      styles.roleChipText,
                      newRole === r ? { color: "#fff" } : { color: ROLE_COLORS[r] },
                    ]}
                  >
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAddEmployee}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>
                {saving ? "جاري الحفظ..." : "إضافة الموظف"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.primary },
  tabs: {
    flexDirection: "row", marginHorizontal: 16, marginVertical: 12,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  listContent: { padding: 16, gap: 16 },
  logoutRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: Colors.accent + "10", borderRadius: 12,
    borderWidth: 1, borderColor: Colors.accent + "25",
  },
  logoutText: { fontSize: 13, color: Colors.accent, fontWeight: "600" },
  emptyBox: { alignItems: "center", gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, fontWeight: "600" },
  emptySubText: { fontSize: 13, color: Colors.textMuted, textAlign: "center" },
  roleGroup: { gap: 8 },
  roleHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  roleTitle: { fontSize: 13, fontWeight: "700" },
  empCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  empCardActive: { borderColor: Colors.primary + "60", backgroundColor: Colors.primary + "05" },
  empAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  empAvatarText: { fontSize: 18, fontWeight: "800" },
  empInfo: { flex: 1, gap: 3 },
  empName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  empIdText: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  delBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  addContent: { padding: 20, gap: 10 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600", marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    color: Colors.text, backgroundColor: Colors.surface,
  },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  roleChipText: { fontSize: 13, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 15,
    marginTop: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
