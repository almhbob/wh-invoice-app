import React from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";

interface ResponsiveShellProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ResponsiveShell({ children, maxWidth = 960, style, contentStyle }: ResponsiveShellProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={[styles.content, Platform.OS === "web" ? { maxWidth } : null, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minHeight: "100%" as any,
    alignItems: "center",
  },
  content: {
    width: "100%",
  },
});
