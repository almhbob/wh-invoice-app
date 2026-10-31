import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoleGate } from "@/components/RoleGate";
import { WindowsOverview } from "@/components/windows/WindowsOverview";
import { Colors } from "@/constants/colors";
import { ROLE_CAN_VIEW_BRANCH_FEATURES } from "@/constants/rbac";

/** Sales windows (branches): today's orders from the factory, dispatch, and setup. */
export default function BranchesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <RoleGate allow={ROLE_CAN_VIEW_BRANCH_FEATURES}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <WindowsOverview />
        </ScrollView>
      </View>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, maxWidth: 920, width: "100%", alignSelf: "center" },
});
