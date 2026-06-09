import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { DeptOrderCard } from "@/components/DeptOrderCard";
import { EmptyState } from "@/components/EmptyState";
import { NewOrderBanner } from "@/components/NewOrderBanner";
import { Colors } from "@/constants/colors";
import { canAccessDept } from "@/constants/rbac";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { EmployeeRef, Order, OrderStatus, useOrders } from "@/context/OrdersContext";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";

export default function HalwaScreen() {
  const { currentEmployee } = useEmployee();
  const { getOrdersForDepartment, updateDepartmentStatus, isLoading, refreshOrders } = useOrders();
  const { t } = useLang();
  const orders = getOrdersForDepartment("halwa");
  const pendingCount = orders.filter((o) => o.departmentStatuses["halwa"] === "pending").length;
  const inProgressCount = orders.filter((o) => o.departmentStatuses["halwa"] === "in_progress").length;

  const [showBanner, setShowBanner] = useState(false);
  useNewOrderAlert(pendingCount, () => setShowBanner(true));

  const handleStatus = useCallback(
    (order: Order, status: OrderStatus, receiver?: EmployeeRef) =>
      updateDepartmentStatus(order.id, "halwa", status, receiver),
    [updateDepartmentStatus]
  );

  if (currentEmployee && !canAccessDept(currentEmployee.role, "halwa")) {
    return (
      <View style={styles.locked}>
        <View style={[styles.lockedIcon, { backgroundColor: Colors.halwa + "18" }]}>
          <Feather name="lock" size={36} color={Colors.halwa} />
        </View>
        <Text style={styles.lockedTitle}>لا تملك صلاحية الوصول</Text>
        <Text style={styles.lockedSub}>هذا القسم مخصص لموظفي قسم الحلا</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NewOrderBanner
        visible={showBanner}
        count={pendingCount}
        accentColor={Colors.halwa}
        onDismiss={() => setShowBanner(false)}
      />

      <View style={[styles.deptBanner, { backgroundColor: Colors.halwa }]}>
        <Text style={styles.bannerTitle}>{t("deptHalwa")}</Text>
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
            department="halwa"
            onStatusChange={(status, receiver) => handleStatus(item, status, receiver)}
          />
        )}
        ListEmptyComponent={
          <EmptyState icon="coffee" title={t("noOrdersNow")} subtitle={t("halwaSubtitle")} />
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshOrders} />}
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
  locked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, backgroundColor: Colors.background },
  lockedIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  lockedSub: { fontSize: 14, color: Colors.textMuted, textAlign: "center" },
});
