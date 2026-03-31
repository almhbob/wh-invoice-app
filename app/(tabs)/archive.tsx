import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Colors } from "@/constants/colors";
import { Department, OrderStatus, PAYMENT_LABELS, useOrders } from "@/context/OrdersContext";

const DEPT_FILTERS: { value: Department | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "halwa", label: "حلا" },
  { value: "mawali", label: "موالح" },
];

const STATUS_FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "pending", label: "انتظار" },
  { value: "in_progress", label: "تحضير" },
  { value: "done", label: "تم" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function ArchiveCard({ order }: { order: any }) {
  const depts = [...new Set(order.items.map((i: any) => i.department))] as Department[];
  const halwaItems = order.items.filter((i: any) => i.department === "halwa");
  const mawaliItems = order.items.filter((i: any) => i.department === "mawali");

  return (
    <View style={styles.archiveCard}>
      {/* Header */}
      <View style={styles.archiveHeader}>
        <View style={styles.archiveHeaderLeft}>
          <Text style={styles.archiveNum}>#{order.orderNumber}</Text>
          <Text style={styles.archiveDate}>{fmtDate(order.createdAt)}</Text>
        </View>
        <View style={styles.deptTags}>
          {depts.includes("halwa") && (
            <View style={[styles.deptTag, { backgroundColor: Colors.halwa }]}>
              <Text style={styles.deptTagText}>حلا</Text>
            </View>
          )}
          {depts.includes("mawali") && (
            <View style={[styles.deptTag, { backgroundColor: Colors.mawali }]}>
              <Text style={styles.deptTagText}>موالح</Text>
            </View>
          )}
        </View>
      </View>

      {/* Customer */}
      <View style={styles.customerBlock}>
        <View style={styles.customerRow}>
          <Feather name="user" size={13} color={Colors.primary} />
          <Text style={styles.customerName}>{order.customerName}</Text>
        </View>
        <View style={styles.customerRow}>
          <Feather name="phone" size={12} color={Colors.textMuted} />
          <Text style={styles.customerPhone}>{order.customerPhone}</Text>
        </View>
      </View>

      {/* Items grouped by dept */}
      {halwaItems.length > 0 && (
        <View style={[styles.deptSection, { borderLeftColor: Colors.halwa }]}>
          <Text style={[styles.deptSectionTitle, { color: Colors.halwa }]}>قسم الحلا</Text>
          {halwaItems.map((item: any, i: number) => (
            <Text key={i} style={styles.archiveItem}>
              • {item.quantity}× {item.name}{item.note ? ` (${item.note})` : ""}
            </Text>
          ))}
          <StatusRow status={order.departmentStatuses?.halwa} />
        </View>
      )}
      {mawaliItems.length > 0 && (
        <View style={[styles.deptSection, { borderLeftColor: Colors.mawali }]}>
          <Text style={[styles.deptSectionTitle, { color: Colors.mawali }]}>قسم الموالح</Text>
          {mawaliItems.map((item: any, i: number) => (
            <Text key={i} style={styles.archiveItem}>
              • {item.quantity}× {item.name}{item.note ? ` (${item.note})` : ""}
            </Text>
          ))}
          <StatusRow status={order.departmentStatuses?.mawali} />
        </View>
      )}

      {/* Employee accountability trail */}
      <View style={styles.trailBox}>
        {order.cashierEmployee && (
          <View style={styles.trailRow}>
            <Feather name="edit-3" size={11} color={Colors.gold} />
            <Text style={styles.trailLabel}>أدخله:</Text>
            <Text style={styles.trailName}>{order.cashierEmployee.name}</Text>
            <Text style={styles.trailId}>#{order.cashierEmployee.employeeId}</Text>
          </View>
        )}
        {order.departmentReceivers?.halwa && (
          <View style={styles.trailRow}>
            <Feather name="check-square" size={11} color={Colors.halwa} />
            <Text style={[styles.trailLabel, { color: Colors.halwa }]}>استلم الحلا:</Text>
            <Text style={[styles.trailName, { color: Colors.halwa }]}>{order.departmentReceivers.halwa.name}</Text>
            <Text style={styles.trailId}>#{order.departmentReceivers.halwa.employeeId}</Text>
          </View>
        )}
        {order.departmentReceivers?.mawali && (
          <View style={styles.trailRow}>
            <Feather name="check-square" size={11} color={Colors.mawali} />
            <Text style={[styles.trailLabel, { color: Colors.mawali }]}>استلم الموالح:</Text>
            <Text style={[styles.trailName, { color: Colors.mawali }]}>{order.departmentReceivers.mawali.name}</Text>
            <Text style={styles.trailId}>#{order.departmentReceivers.mawali.employeeId}</Text>
          </View>
        )}
      </View>

      {/* Footer: timing & insurance */}
      <View style={styles.archiveFooter}>
        <View style={styles.footerItem}>
          <Feather name="download" size={11} color={Colors.textMuted} />
          <Text style={styles.footerText}>{order.receivedAt}</Text>
        </View>
        {order.deliveryTime && (
          <View style={styles.footerItem}>
            <Feather name="upload" size={11} color={Colors.success} />
            <Text style={[styles.footerText, { color: Colors.success }]}>{order.deliveryTime}</Text>
          </View>
        )}
        {order.totalAmount != null && (
          <View style={styles.footerItem}>
            <Feather name="dollar-sign" size={11} color={Colors.success} />
            <Text style={[styles.footerText, { color: Colors.success, fontWeight: "700" }]}>
              {order.totalAmount.toFixed(2)} ر.س
            </Text>
          </View>
        )}
        {order.insuranceAmount != null && !order.totalAmount && (
          <View style={styles.footerItem}>
            <Feather name="shield" size={11} color={Colors.gold} />
            <Text style={[styles.footerText, { color: Colors.gold, fontWeight: "700" }]}>
              تأمين {order.insuranceAmount} ر.س
            </Text>
          </View>
        )}
        {order.paymentMethod && (
          <View style={styles.footerItem}>
            <Feather name="credit-card" size={11} color={Colors.info} />
            <Text style={[styles.footerText, { color: Colors.info }]}>
              {PAYMENT_LABELS[order.paymentMethod]}
            </Text>
          </View>
        )}
        {order.discount && order.discount.value > 0 && (
          <View style={styles.footerItem}>
            <Feather name="tag" size={11} color={Colors.warning} />
            <Text style={[styles.footerText, { color: Colors.warning, fontWeight: "700" }]}>
              {order.discount.type === "percentage"
                ? `خصم ${order.discount.value}%`
                : `خصم ${order.discount.value.toFixed(2)} ر.س`}
              {order.discount.reason ? ` · ${order.discount.reason}` : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatusRow({ status }: { status?: OrderStatus }) {
  const conf: Record<OrderStatus, { label: string; color: string }> = {
    pending: { label: "انتظار", color: Colors.statusPending },
    in_progress: { label: "جاري التحضير", color: Colors.statusInProgress },
    done: { label: "تم التسليم", color: Colors.statusDone },
    cancelled: { label: "ملغي", color: Colors.statusCancelled },
  };
  if (!status) return null;
  const c = conf[status];
  return (
    <View style={[styles.statusRow, { backgroundColor: c.color + "18" }]}>
      <View style={[styles.statusDot, { backgroundColor: c.color }]} />
      <Text style={[styles.statusLabel, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

export default function ArchiveScreen() {
  const { orders } = useOrders();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [dateFilter, setDateFilter] = useState("");

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (deptFilter !== "all") {
          if (!o.items.some((i) => i.department === deptFilter)) return false;
        }
        if (dateFilter && !o.createdAt.includes(dateFilter)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !o.orderNumber.toString().includes(q) &&
            !o.customerName?.toLowerCase().includes(q) &&
            !o.customerPhone?.includes(q) &&
            !o.items.some((i) => i.name.toLowerCase().includes(q))
          ) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, deptFilter, dateFilter, search]);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="بحث بالرقم أو الاسم أو الهاتف أو الصنف..."
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filters */}
      <View style={styles.filterBar}>
        <View style={styles.filterGroup}>
          {DEPT_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, deptFilter === f.value && styles.chipActive]}
              onPress={() => setDeptFilter(f.value as any)}
            >
              <Text style={[styles.chipText, deptFilter === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.searchRow, { marginHorizontal: 0, marginTop: 6 }]}>
          <Feather name="calendar" size={14} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={dateFilter}
            onChangeText={setDateFilter}
            placeholder="تصفية بالتاريخ (مثال: 2025-01-15)"
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
          />
          {dateFilter ? (
            <TouchableOpacity onPress={() => setDateFilter("")}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.countRow}>
        <Feather name="file-text" size={13} color={Colors.textMuted} />
        <Text style={styles.countText}>{filtered.length} فاتورة</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
        renderItem={({ item }) => <ArchiveCard order={item} />}
        ListEmptyComponent={
          <EmptyState icon="archive" title="لا توجد فواتير"
            subtitle="لم يتم العثور على فواتير تطابق البحث" />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  filterBar: { marginHorizontal: 16, marginTop: 10 },
  filterGroup: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  countRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  countText: { fontSize: 13, color: Colors.textMuted },
  list: { padding: 16, paddingTop: 4 },
  archiveCard: {
    backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 14, padding: 14,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, gap: 10,
  },
  archiveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  archiveHeaderLeft: { gap: 2 },
  archiveNum: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  archiveDate: { fontSize: 12, color: Colors.textMuted },
  deptTags: { flexDirection: "row", gap: 6 },
  deptTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deptTagText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  customerBlock: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  customerName: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  customerPhone: { fontSize: 13, color: Colors.textSecondary },
  deptSection: {
    borderLeftWidth: 3, paddingLeft: 12, gap: 4,
    paddingVertical: 6,
  },
  deptSectionTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  archiveItem: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  statusRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 4, alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: "600" },
  trailBox: {
    backgroundColor: Colors.primary + "07", borderRadius: 10,
    padding: 10, gap: 6, borderWidth: 1, borderColor: Colors.primary + "15",
  },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  trailLabel: { fontSize: 11, color: Colors.textSecondary },
  trailName: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  trailId: { fontSize: 11, color: Colors.textMuted },
  archiveFooter: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: Colors.textMuted },
});
