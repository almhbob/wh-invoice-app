import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useEmployee, ROLE_LABELS } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";

// Picking a profile is not authentication. Switching employees requires a new
// Firebase sign-in; this modal only displays the verified current account.
export function EmployeeSelectorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { currentEmployee, setCurrentEmployee } = useEmployee();
  const { lang } = useLang();
  const ar = lang === "ar";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}><View style={styles.card}>
        <Feather name="user-check" size={28} color="#897443" />
        <Text style={styles.name}>{currentEmployee?.name || (ar ? "حساب الموظف" : "Employee account")}</Text>
        <Text style={styles.body}>{currentEmployee ? ROLE_LABELS[currentEmployee.role] : ""}</Text>
        <Text style={styles.body}>{ar ? "لتبديل الموظف، سجّل الخروج ثم ادخل بالحساب الآخر. لا يمكن اختيار هوية موظف من قائمة." : "To switch employees, sign out and authenticate with the other account. Profiles cannot be selected from a list."}</Text>
        <TouchableOpacity style={styles.logout} onPress={() => { onClose(); void setCurrentEmployee(null); }}><Text style={styles.logoutText}>{ar ? "تسجيل الخروج والتبديل" : "Sign out to switch"}</Text></TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={styles.close}>{ar ? "إغلاق" : "Close"}</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.4)", padding: 24, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, alignItems: "center" },
  name: { fontSize: 20, fontWeight: "700", marginTop: 16, color: "#302B23" },
  body: { fontSize: 14, color: "#77746D", textAlign: "center", lineHeight: 23, marginTop: 12 },
  logout: { width: "100%", backgroundColor: "#302B23", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 24 },
  logoutText: { color: "#FFF", fontWeight: "600" },
  close: { color: "#897443", padding: 16 },
});
