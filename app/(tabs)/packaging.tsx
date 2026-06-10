import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { DeptOrderCard } from "@/components/DeptOrderCard";
import { EmptyState } from "@/components/EmptyState";
import { NewOrderBanner } from "@/components/NewOrderBanner";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { Colors } from "@/constants/colors";
import { canAccessDept } from "@/constants/rbac";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { EmployeeRef, Order, OrderStatus, useOrders } from "@/context/OrdersContext";

export default function PackagingScreen() {
  const { currentEmployee } = useEmployee();
  const { getOrdersForDepartment, updateDepartmentStatus, isLoading, refreshOrders } = useOrders();
  const { t } = useLang();

  const orders = getOrdersForDepartment("packaging");
  const pendingCount    = orders.filter((o) => o.departmentStatuses["packaging"] === "pending").length;
  const inProgressCount = orders.filter((o) => o.departmentStatuses["packaging"] === "in_progress").length;

  const [showBanner, setShowBanner] = useState(false);
  useNewOrderAlert(pendingCount, () => setShowBanner(true));

  const handleStatus = useCallback(
    (order: Order, status: OrderStatus, receiver?: EmployeeRef) =>
      updateDepartmentStatus(order.id, "packaging", status, receiver),
    [updateDepartmentStatus]
  );

  if (currentEmployee && !canAccessDept(currentEmployee.role, "packaging")) {
    return (
      <View style={styles.locked}>
        <View style={[styles.lockedIcon, { backgroundColor: Colors.packaging + "18" }]}>
          <Feather name="lock" size={36} color={Colors.packaging} />
        </View>
        <Text style={styles.lockedTitle}>{t("accessDeniedTitle")}</Text>
        <Text style={styles.lockedSub}>{t("accessDeniedPackaging")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NewOrderBanner visible={showBanner} count={pendingCount} accentColor={Colors.packaging} onDismiss={() => setShowBanner(false)} />
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
        renderItem={({ item }) => (
          <DeptOrderCard
            order={item}
            department="packaging"
            onStatusChange={(status, receiver) => handleStatus(item, status, receiver)}
          />
        )}
        ListEmptyComponent={
          <EmptyState icon="box" title={t("noOrdersNow")} subtitle={t("packagingSubtitle")} />
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshOrders} />}
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
  locked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, backgroundColor: Colors.background },
  lockedIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  lockedSub: { fontSize: 14, color: Colors.textMuted, textAlign: "center" },
});
