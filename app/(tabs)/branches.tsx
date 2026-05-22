import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BranchDailyProductionRequestPanel } from "@/components/BranchDailyProductionRequestPanel";
import { BranchInventoryAuditPanel } from "@/components/BranchInventoryAuditPanel";
import { BranchOperationsSyncPanel } from "@/components/BranchOperationsSyncPanel";
import { BranchProductionReceivingPanel } from "@/components/BranchProductionReceivingPanel";
import { BranchReturnsDamagePanel } from "@/components/BranchReturnsDamagePanel";
import { BranchSupervisorPanel } from "@/components/BranchSupervisorPanel";
import { BranchWorkflowGuidePanel } from "@/components/BranchWorkflowGuidePanel";
import { EnterpriseOpsPanel } from "@/components/EnterpriseOpsPanel";
import { Colors } from "@/constants/colors";

export default function BranchesScreen() {
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
        <BranchInventoryAuditPanel />
        <EnterpriseOpsPanel />
        <BranchSupervisorPanel />
        <BranchReturnsDamagePanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
});
