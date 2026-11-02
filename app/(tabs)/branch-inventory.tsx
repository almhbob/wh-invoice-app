import { RoleGate } from "@/components/RoleGate";
import { ROLE_CAN_VIEW_BRANCH_FEATURES } from "@/constants/rbac";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BranchInventoryAuditPanel } from "@/components/BranchInventoryAuditPanel";
import { BranchOperationsSyncPanel } from "@/components/BranchOperationsSyncPanel";
import { BranchWorkflowGuidePanel } from "@/components/BranchWorkflowGuidePanel";
import { Colors } from "@/constants/colors";

function BranchInventoryScreenInner() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <BranchWorkflowGuidePanel />
        <BranchOperationsSyncPanel />
        <BranchInventoryAuditPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
});

export default function BranchInventoryScreen() {
  return (
    <RoleGate allow={ROLE_CAN_VIEW_BRANCH_FEATURES}>
      <BranchInventoryScreenInner />
    </RoleGate>
  );
}
