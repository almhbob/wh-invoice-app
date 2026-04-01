import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { Order, useOrders } from "@/context/OrdersContext";
import { fmtDate } from "@/utils/dateUtils";

interface Customer {
  phone: string;
  name: string;
  orders: Order[];
  totalSpent: number;
  lastOrderAt: string;
}

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

function CustomerHistoryModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{customer.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalMeta}>
          <View style={styles.metaRow}>
            <Feather name="phone" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{customer.phone}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="shopping-bag" size={13} color={Colors.primary} />
            <Text style={styles.metaText}>{customer.orders.length} {t("custOrders")}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="dollar-sign" size={13} color={Colors.gold} />
            <Text style={styles.metaText}>{t("custTotalSpent")} {fmtCurrency(customer.totalSpent)}</Text>
          </View>
        </View>
        <Text style={styles.historyTitle}>{t("custHistory")}</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {customer.orders.length === 0 ? (
            <Text style={styles.noOrdersText}>{t("custNoOrders")}</Text>
          ) : (
            customer.orders.map((order) => (
              <View key={order.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyNum}>#{order.orderNumber}</Text>
                  <Text style={styles.historyDate}>{fmtDate(order.createdAt, lang)}</Text>
                  <Text style={styles.historyAmount}>{fmtCurrency(order.totalAmount ?? 0)}</Text>
                </View>
                {order.items.map((item, i) => (
                  <Text key={i} style={styles.historyItem}>• {item.quantity}× {item.name}</Text>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CustomersScreen() {
  const { t, lang } = useLang();
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [tab, setTab] = useState<"all" | "frequent">("all");

  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();
    orders.forEach((o) => {
      const phone = o.customerPhone;
      if (!map.has(phone)) {
        map.set(phone, { phone, name: o.customerName, orders: [], totalSpent: 0, lastOrderAt: o.createdAt });
      }
      const c = map.get(phone)!;
      c.orders.push(o);
      c.totalSpent += o.totalAmount ?? 0;
      if (o.createdAt > c.lastOrderAt) { c.lastOrderAt = o.createdAt; c.name = o.customerName; }
    });
    return Array.from(map.values()).sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
  }, [orders]);

  const filtered = useMemo(() => {
    let list = customers;
    if (tab === "frequent") list = list.filter((c) => c.orders.length >= 3);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [customers, search, tab]);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("custSearch")}
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([["all", t("custAllCustomers")], ["frequent", t("custFrequent")]] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabBtnText, tab === key && styles.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.phone}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t("custNoResults")}</Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <TouchableOpacity style={styles.customerCard} onPress={() => setSelected(c)} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{c.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.custName}>{c.name}</Text>
              <Text style={styles.custPhone}>{c.phone}</Text>
              <Text style={styles.custMeta}>
                {t("custLastOrder")} {fmtDate(c.lastOrderAt, lang)}
              </Text>
            </View>
            <View style={styles.ordersBadge}>
              <Text style={styles.ordersNum}>{c.orders.length}</Text>
              <Text style={styles.ordersLabel}>{t("custOrders")}</Text>
            </View>
            <Feather name="chevron-left" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      {selected && (
        <CustomerHistoryModal customer={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  customerCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  custName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  custPhone: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  custMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  ordersBadge: { alignItems: "center", paddingHorizontal: 10 },
  ordersNum: { fontSize: 20, fontWeight: "900", color: Colors.primary },
  ordersLabel: { fontSize: 10, color: Colors.textMuted },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, backgroundColor: Colors.primary,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  modalMeta: { backgroundColor: Colors.surface, padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 14, color: Colors.text },
  historyTitle: { fontSize: 15, fontWeight: "800", color: Colors.text, padding: 16, paddingBottom: 8 },
  historyCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  historyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  historyNum: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  historyDate: { flex: 1, fontSize: 12, color: Colors.textMuted },
  historyAmount: { fontSize: 14, fontWeight: "700", color: Colors.gold },
  historyItem: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  noOrdersText: { fontSize: 14, color: Colors.textMuted, textAlign: "center", padding: 24 },
});
