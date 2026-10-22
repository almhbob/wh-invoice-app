import { RoleGate } from "@/components/RoleGate";
import { ROLE_CAN_VIEW_BRANCH_FEATURES } from "@/constants/rbac";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BranchDailyProductionRequestPanel } from "@/components/BranchDailyProductionRequestPanel";
import { BranchOperationsSyncPanel } from "@/components/BranchOperationsSyncPanel";
import { BranchProductionReceivingPanel } from "@/components/BranchProductionReceivingPanel";
import { BranchWorkflowGuidePanel } from "@/components/BranchWorkflowGuidePanel";
import { Colors } from "@/constants/colors";

function BranchOrdersScreenInner() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <BranchWorkflowGuidePanel />
        <BranchOperationsSyncPanel />
        <BranchDailyProductionRequestPanel />
        <BranchProductionReceivingPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
});

export default function BranchOrdersScreen() {
  return (
    <RoleGate allow={ROLE_CAN_VIEW_BRANCH_FEATURES}>
      <BranchOrdersScreenInner />
    </RoleGate>
  );
}
