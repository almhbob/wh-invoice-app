import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompanySubscriptionsPanel } from "@/components/CompanySubscriptionsPanel";
import { DeveloperControlCenterPanel } from "@/components/DeveloperControlCenterPanel";
import { DeveloperOwnerProfilePanel } from "@/components/DeveloperOwnerProfilePanel";
import { DeveloperSubscriptionsPanel } from "@/components/DeveloperSubscriptionsPanel";
import { Colors } from "@/constants/colors";

export default function DeveloperScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <DeveloperControlCenterPanel />
        <DeveloperOwnerProfilePanel />
        <DeveloperSubscriptionsPanel />
        <CompanySubscriptionsPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
});
