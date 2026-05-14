import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors } from "@/constants/colors";
import { RELEASE_INFO } from "@/constants/releaseInfo";

export function ReleaseStatusPanel() {
  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <View style={styles.iconBox}>
          <Feather name="git-commit" size={16} color={Colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>حالة الإصدار والنشر</Text>
          <Text style={styles.version}>{RELEASE_INFO.version}</Text>
        </View>
      </View>

      <Text style={styles.label}>{RELEASE_INFO.labelAr}</Text>
      <Text style={styles.marker}>Marker: {RELEASE_INFO.deploymentMarker}</Text>
      <Text style={styles.hint}>{RELEASE_INFO.latestRequiredCommitHint}</Text>

      <View style={styles.routesBox}>
        <Text style={styles.sectionTitle}>المسارات المتوقعة</Text>
        {RELEASE_INFO.expectedRoutes.map((route) => (
          <Text key={route} style={styles.routeText}>• {route}</Text>
        ))}
      </View>

      <View style={styles.notesBox}>
        {RELEASE_INFO.notesAr.map((note) => (
          <View key={note} style={styles.noteRow}>
            <Feather name="check-circle" size={12} color={Colors.info} />
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "900", color: Colors.primary, textAlign: "right" },
  version: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  label: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 19, fontWeight: "700" },
  marker: { fontSize: 10, color: Colors.textMuted, textAlign: "right" },
  hint: { fontSize: 11, color: Colors.accent, textAlign: "right", lineHeight: 17, fontWeight: "800" },
  routesBox: { gap: 4, padding: 10, borderRadius: 12, backgroundColor: "#f8fafc" },
  sectionTitle: { fontSize: 12, fontWeight: "900", color: Colors.text, textAlign: "right" },
  routeText: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  notesBox: { gap: 6 },
  noteRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6 },
  noteText: { flex: 1, fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 17 },
});
