import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { pendingSyncCount } = useOrders();
  const { t } = useLang();
  const [offlineShellReady, setOfflineShellReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let mounted = true;
    const refreshReadiness = () => {
      void navigator.serviceWorker.ready
        .then((registration) => {
          if (mounted) setOfflineShellReady(registration.active !== null);
        })
        .catch(() => {
          if (mounted) setOfflineShellReady(false);
        });
    };

    navigator.serviceWorker.addEventListener("controllerchange", refreshReadiness);
    refreshReadiness();

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", refreshReadiness);
    };
  }, []);

  if (isOnline && pendingSyncCount === 0) return null;
  const needsOfflinePreparation = !isOnline && Platform.OS === "web" && !offlineShellReady;

  return (
    <View style={[styles.banner, isOnline && styles.syncBanner]}>
      <Feather name={isOnline ? "refresh-cw" : "wifi-off"} size={14} color="#fff" />
      <View style={styles.textBlock}>
        <Text style={styles.title}>
          {isOnline
            ? t("syncPendingTitle")
            : needsOfflinePreparation
              ? t("offlineShellTitle")
              : t("offlineBanner")}
        </Text>
        <Text style={styles.sub}>
          {needsOfflinePreparation
            ? t("offlineShellSub")
            : isOnline
              ? t("syncPendingSub").replace("{n}", String(pendingSyncCount))
              : t("offlineBannerSub")}
        </Text>
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
  syncBanner: { backgroundColor: "#8a641f" },
  textBlock: { flex: 1 },
  title: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sub:   { color: "rgba(255,255,255,0.8)", fontSize: 11 },
});
