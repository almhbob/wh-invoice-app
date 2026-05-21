import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompanySubscriptionsPanel } from "@/components/CompanySubscriptionsPanel";
import { DeveloperControlCenterPanel } from "@/components/DeveloperControlCenterPanel";
import { DeveloperOwnerProfilePanel } from "@/components/DeveloperOwnerProfilePanel";
import { DeveloperSubscriptionsPanel } from "@/components/DeveloperSubscriptionsPanel";
import { ProductionReadinessPanel } from "@/components/ProductionReadinessPanel";
import { ReleaseStatusPanel } from "@/components/ReleaseStatusPanel";
import { Colors } from "@/constants/colors";

const DEVELOPER_UNLOCK_KEY = "@fawtara_developer_code_unlock_v2";
const LEGACY_DEVELOPER_UNLOCK_KEY = "@fawtara_developer_unlock_v1";
const OWNER_DEVELOPER_CODE = "Almhbob2013#";

function AccessDenied({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");

  const submit = () => {
    if (code.trim() !== OWNER_DEVELOPER_CODE) {
      Alert.alert("رمز غير صحيح", "رمز قسم المطور غير صحيح.");
      return;
    }
    setCode("");
    onUnlock();
  };

  return (
    <View style={styles.deniedCard}>
      <View style={styles.deniedIcon}>
        <Feather name="lock" size={24} color={Colors.accent} />
      </View>
      <Text style={styles.deniedTitle}>قسم المطور مغلق</Text>
      <Text style={styles.deniedText}>أدخل رمز المطور لفتح أدوات الخوادم والاشتراكات والإعدادات الحساسة.</Text>
      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={setCode}
        placeholder="رمز المطور"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        textAlign="center"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
      />
      <TouchableOpacity style={styles.unlockBtn} onPress={submit} activeOpacity={0.85}>
        <Feather name="unlock" size={16} color="#fff" />
        <Text style={styles.unlockText}>فتح قسم المطور</Text>
      </TouchableOpacity>
      <Text style={styles.deniedHint}>لا يعتمد الفتح على صلاحية الموظف وحدها. الرمز مطلوب لهذا القسم.</Text>
    </View>
  );
}

export default function DeveloperScreen() {
  const insets = useSafeAreaInsets();
  const [codeUnlocked, setCodeUnlocked] = useState(false);

  useEffect(() => {
    AsyncStorage.removeItem(LEGACY_DEVELOPER_UNLOCK_KEY).catch(() => undefined);
    AsyncStorage.getItem(DEVELOPER_UNLOCK_KEY)
      .then((value) => setCodeUnlocked(value === "1"))
      .catch(() => setCodeUnlocked(false));
  }, []);

  const unlockWithCode = async () => {
    setCodeUnlocked(true);
    await AsyncStorage.setItem(DEVELOPER_UNLOCK_KEY, "1");
  };

  const lockDeveloperSection = async () => {
    setCodeUnlocked(false);
    await AsyncStorage.removeItem(DEVELOPER_UNLOCK_KEY);
    await AsyncStorage.removeItem(LEGACY_DEVELOPER_UNLOCK_KEY);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {codeUnlocked ? (
          <>
            <TouchableOpacity style={styles.lockBtn} onPress={lockDeveloperSection} activeOpacity={0.85}>
              <Feather name="lock" size={14} color={Colors.accent} />
              <Text style={styles.lockText}>إغلاق قسم المطور</Text>
            </TouchableOpacity>
            <ReleaseStatusPanel />
            <ProductionReadinessPanel />
            <DeveloperControlCenterPanel />
            <DeveloperOwnerProfilePanel />
            <DeveloperSubscriptionsPanel />
            <CompanySubscriptionsPanel />
          </>
        ) : (
          <AccessDenied onUnlock={unlockWithCode} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, flexGrow: 1 },
  deniedCard: { flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fff", borderRadius: 22, padding: 22, borderWidth: 1, borderColor: Colors.border },
  deniedIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent + "12" },
  deniedTitle: { fontSize: 20, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  deniedText: { fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
  deniedHint: { fontSize: 11, color: Colors.textMuted, textAlign: "center", lineHeight: 18 },
  codeInput: { width: "100%", maxWidth: 360, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontSize: 15, fontWeight: "800" },
  unlockBtn: { width: "100%", maxWidth: 360, minHeight: 48, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  unlockText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  lockBtn: { alignSelf: "flex-start", minHeight: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 7, backgroundColor: Colors.accent + "12", borderWidth: 1, borderColor: Colors.accent + "25" },
  lockText: { color: Colors.accent, fontSize: 12, fontWeight: "900" },
});
