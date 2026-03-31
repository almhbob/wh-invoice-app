import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { PackagingOrderCard } from "@/components/PackagingOrderCard";
import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";

export default function PackagingScreen() {
  const { getOrdersForDepartment, isLoading } = useOrders();
  const { t } = useLang();

  const orders = getOrdersForDepartment("packaging");
  const pendingCount    = orders.filter((o) => o.departmentStatuses["packaging"] === "pending").length;
  const inProgressCount = orders.filter((o) => o.departmentStatuses["packaging"] === "in_progress").length;

  return (
    <View style={styles.container}>
      {/* dept banner */}
      <View style={[styles.banner, { backgroundColor: Colors.packaging }]}>
        <Text style={styles.bannerTitle}>{t("deptPackaging")}</Text>
        <Text style={styles.bannerSub}>{t("packagingSubtitle")}</Text>
        <View style={styles.bannerStats}>
          {pendingCount > 0 && (
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{pendingCount}</Text>
              <Text style={styles.statLabel}>{t("waiting")}</Text>
            </View>
          )}
          {inProgressCount > 0 && (
            <View style={[styles.statPill, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Text style={styles.statNum}>{inProgressCount}</Text>
              <Text style={styles.statLabel}>{t("preparing")}</Text>
            </View>
          )}
          {pendingCount === 0 && inProgressCount === 0 && (
            <Text style={styles.allClearText}>{t("noPendingOrders")}</Text>
          )}
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, orders.length === 0 && { flex: 1 }]}
        renderItem={({ item }) => <PackagingOrderCard order={item} />}
        ListEmptyComponent={
          <EmptyState icon="box" title={t("noOrdersNow")} subtitle={t("packagingSubtitle")} />
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => {}} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  banner: { paddingHorizontal: 20, paddingVertical: 14, gap: 4 },
  bannerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  bannerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  bannerStats: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 },
  statPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  statNum: { fontSize: 16, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  allClearText: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  list: { padding: 16 },
});
