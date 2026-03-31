import { Image } from "expo-image";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

interface AppHeaderProps {
  subtitle?: string;
  accentColor?: string;
}

export function AppHeader({ subtitle, accentColor }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.inner}>
        <View style={styles.logoWrapper}>
          <Image
            source={require("@/assets/images/logo.jpg")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <View style={styles.divider} />
        {subtitle ? (
          <View style={[styles.subtitleBadge, accentColor ? { backgroundColor: accentColor } : {}]}>
            <Text style={styles.subtitleText}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  logoWrapper: {
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    width: 52,
    height: 52,
  },
  logo: {
    width: 52,
    height: 52,
  },
  divider: {
    flex: 1,
  },
  subtitleBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  subtitleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
