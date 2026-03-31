import React, { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { DeptOrderCard } from "@/components/DeptOrderCard";
import { EmptyState } from "@/components/EmptyState";
import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { EmployeeRef, Order, OrderStatus, useOrders } from "@/context/OrdersContext";

export default function MawaliScreen() {
  const { getOrdersForDepartment, updateDepartmentStatus, isLoading } = useOrders();
  const { t } = useLang();
  const orders = getOrdersForDepartment("mawali");
  const pendingCount = orders.filter((o) => o.departmentStatuses["mawali"] === "pending").length;
  const inProgressCount = orders.filter((o) => o.departmentStatuses["mawali"] === "in_progress").length;

  const handleStatus = useCallback(
    (order: Order, status: OrderStatus, receiver?: EmployeeRef) =>
      updateDepartmentStatus(order.id, "mawali", status, receiver),
    [updateDepartmentStatus]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.deptBanner, { backgroundColor: Colors.mawali }]}>
        <Text style={styles.bannerTitle}>{t("deptMawali")}</Text>
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
        renderItem={({ item }) => (
          <DeptOrderCard
            order={item}
            department="mawali"
            onStatusChange={(status, receiver) => handleStatus(item, status, receiver)}
          />
        )}
        ListEmptyComponent={
          <EmptyState icon="package" title={t("noOrdersNow")} subtitle={t("mawaliSubtitle")} />
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => {}} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  deptBanner: { paddingHorizontal: 20, paddingVertical: 14, gap: 6 },
  bannerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  bannerStats: { flexDirection: "row", gap: 10, alignItems: "center" },
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
