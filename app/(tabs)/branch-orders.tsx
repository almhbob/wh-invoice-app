import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoleGate } from "@/components/RoleGate";
import { WindowOrderPanel } from "@/components/windows/WindowOrderPanel";
import { Colors } from "@/constants/colors";
import { ROLE_CAN_VIEW_WINDOW_ORDER } from "@/constants/rbac";

/** A sales window's daily order from the factory. */
export default function BranchOrdersScreen() {
  const insets = useSafeAreaInsets();
  return (
    <RoleGate allow={ROLE_CAN_VIEW_WINDOW_ORDER}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <WindowOrderPanel />
        </ScrollView>
      </View>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, maxWidth: 820, width: "100%", alignSelf: "center" },
});
