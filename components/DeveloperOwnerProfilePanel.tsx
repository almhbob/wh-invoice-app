import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import {
  DEVELOPER_CREDENTIAL_GROUPS,
  DEVELOPER_OWNER_PROFILE,
  OWNER_PROFILE_PRIVACY_NOTE_AR,
} from "@/constants/developerOwnerProfile";

export function DeveloperOwnerProfilePanel() {
  const openProfile = async () => {
    if (DEVELOPER_OWNER_PROFILE.publicProfileUrl) {
      await Linking.openURL(DEVELOPER_OWNER_PROFILE.publicProfileUrl);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>ع</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{DEVELOPER_OWNER_PROFILE.roleAr}</Text>
          <Text style={styles.name}>{DEVELOPER_OWNER_PROFILE.nameAr}</Text>
          <Text style={styles.nameEn}>{DEVELOPER_OWNER_PROFILE.nameEn}</Text>
        </View>
      </View>

      <Text style={styles.summary}>{DEVELOPER_OWNER_PROFILE.professionalSummaryAr}</Text>

      <TouchableOpacity style={styles.profileBtn} onPress={openProfile} activeOpacity={0.8}>
        <Feather name="award" size={15} color="#fff" />
        <Text style={styles.profileBtnText}>فتح ملف الشهادات العام</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>المجالات المهنية</Text>
      {DEVELOPER_CREDENTIAL_GROUPS.map((group) => (
        <View key={group.titleAr} style={styles.groupCard}>
          <Text style={styles.groupTitle}>{group.titleAr}</Text>
          <Text style={styles.groupDesc}>{group.descriptionAr}</Text>
          <View style={styles.highlightsWrap}>
            {group.highlights.map((item) => (
              <View key={item} style={styles.highlightChip}>
                <Feather name="check-circle" size={11} color={Colors.success} />
                <Text style={styles.highlightText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.privacyBox}>
        <Feather name="shield" size={14} color={Colors.info} />
        <Text style={styles.privacyText}>{OWNER_PROFILE_PRIVACY_NOTE_AR}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  headerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.gold },
  avatarText: { color: Colors.gold, fontSize: 22, fontWeight: "900" },
  title: { fontSize: 18, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  name: { fontSize: 14, fontWeight: "800", color: Colors.text, textAlign: "right", marginTop: 2 },
  nameEn: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  summary: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 20 },
  profileBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 13, backgroundColor: Colors.primary },
  profileBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: Colors.text, textAlign: "right", marginTop: 4 },
  groupCard: { gap: 7, padding: 12, borderRadius: 14, backgroundColor: "#f8fafc" },
  groupTitle: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  groupDesc: { fontSize: 11, color: Colors.textMuted, textAlign: "right", lineHeight: 17 },
  highlightsWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  highlightChip: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18, backgroundColor: Colors.success + "10" },
  highlightText: { fontSize: 10, color: Colors.success, fontWeight: "800" },
  privacyBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: Colors.info + "10" },
  privacyText: { flex: 1, fontSize: 11, color: Colors.info, textAlign: "right", lineHeight: 17, fontWeight: "700" },
});
