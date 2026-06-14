import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLang } from "@/context/LanguageContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { t } = useLang();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={14} color="#fff" />
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t("offlineBanner")}</Text>
        <Text style={styles.sub}>{t("offlineBannerSub")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#b91c1c",
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 999,
  },
  textBlock: { flex: 1 },
  title: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sub:   { color: "rgba(255,255,255,0.8)", fontSize: 11 },
});
