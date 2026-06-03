import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  phone: string;
  name: string;
  orders: Order[];
  totalSpent: number;
  lastOrderAt: string;
}

type TabKey = "all" | "frequent" | "vip";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return (
    n.toLocaleString("ar-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " ر.س"
  );
}

function isVIP(c: Customer): boolean {
  return c.orders.length >= 5 || c.totalSpent >= 500;
}

function openWhatsApp(phone: string, message?: string) {
  const raw = phone.replace(/\D/g, "");
  const intl = raw.startsWith("0") ? "966" + raw.slice(1) : raw;
  const url = message
    ? `whatsapp://send?phone=${intl}&text=${encodeURIComponent(message)}`
    : `whatsapp://send?phone=${intl}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/${intl}`));
}

function getFavoriteDepartment(orders: Order[]): string {
  const tally: Record<string, number> = {};
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const dept = item.department ?? "غير محدد";
      tally[dept] = (tally[dept] ?? 0) + (item.quantity ?? 1);
    });
  });
  if (Object.keys(tally).length === 0) return "—";
  const topKey = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
  const labels: Record<string, string> = {
    halwa: "حلوى",
    mawali: "موالح",
    chocolate: "شوكولاتة",
    cake: "كيك",
    packaging: "تغليف",
  };
  return labels[topKey] ?? topKey;
}

function getTotalItems(orders: Order[]): number {
  return orders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + (i.quantity ?? 1), 0),
    0
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={[styles.statIcon]}>{icon}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Customer History Modal ────────────────────────────────────────────────────

function CustomerHistoryModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const vip = isVIP(customer);
  const totalItems = getTotalItems(customer.orders);
  const favDept = getFavoriteDepartment(customer.orders);
  const whatsappMsg = `مرحباً ${customer.name}، شكراً لتعاملك معنا 🎂`;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        {/* ── Modal Header ── */}
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: vip ? Colors.gold : Colors.primary },
          ]}
        >
          <View style={styles.modalAvatarWrap}>
            <View
              style={[
                styles.modalAvatar,
                { backgroundColor: vip ? "#fff5d6" : "rgba(255,255,255,0.2)" },
              ]}
            >
              <Text
                style={[
                  styles.modalAvatarText,
                  { color: vip ? Colors.gold : "#fff" },
                ]}
              >
                {customer.name.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.modalNameRow}>
                <Text style={styles.modalTitle}>{customer.name}</Text>
                {vip && (
                  <View style={styles.modalVipBadge}>
                    <Text style={styles.modalVipText}>⭐ VIP</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modalPhone}>{customer.phone}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.modalStatsRow}>
          <View style={styles.modalStatItem}>
            <Text style={[styles.modalStatValue, { color: Colors.primary }]}>
              {customer.orders.length}
            </Text>
            <Text style={styles.modalStatLabel}>{t("custOrders")}</Text>
          </View>
          <View style={styles.modalStatDivider} />
          <View style={styles.modalStatItem}>
            <Text style={[styles.modalStatValue, { color: Colors.gold }]}>
              {fmtCurrency(customer.totalSpent)}
            </Text>
            <Text style={styles.modalStatLabel}>{t("custTotalSpent")}</Text>
          </View>
          <View style={styles.modalStatDivider} />
          <View style={styles.modalStatItem}>
            <Text style={[styles.modalStatValue, { color: Colors.success }]}>
              {totalItems}
            </Text>
            <Text style={styles.modalStatLabel}>{t("custTotalItems")}</Text>
          </View>
        </View>

        {/* ── Favorite Department ── */}
        <View style={styles.favDeptRow}>
          <Feather name="star" size={13} color={Colors.gold} />
          <Text style={styles.favDeptText}>
            {t("custFavDept")}:{" "}
            <Text style={{ fontWeight: "700", color: Colors.text }}>
              {favDept}
            </Text>
          </Text>
        </View>

        {/* ── Quick Contact Row ── */}
        <View style={styles.quickContactRow}>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: Colors.success }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL(`tel:${customer.phone}`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="phone" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>{t("custCall")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#25D366" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openWhatsApp(customer.phone, whatsappMsg);
            }}
            activeOpacity={0.8}
          >
            <Feather name="message-circle" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>{t("custWhatsappBtn")}</Text>
          </TouchableOpacity>
        </View>

        {/* ── History List ── */}
        <Text style={styles.historyTitle}>{t("custHistory")}</Text>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {customer.orders.length === 0 ? (
            <Text style={styles.noOrdersText}>{t("custNoOrders")}</Text>
          ) : (
            customer.orders
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((order) => (
                <View key={order.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyNumWrap}>
                      <Text style={styles.historyNum}>
                        #{order.orderNumber}
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>
                      {fmtDate(order.createdAt, lang)}
                    </Text>
                    <Text style={styles.historyAmount}>
                      {fmtCurrency(order.totalAmount ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.historyItemsWrap}>
                    {order.items.map((item, i) => (
                      <View key={i} style={styles.historyItemRow}>
                        <View style={styles.historyItemDot} />
                        <Text style={styles.historyItem}>
                          {item.quantity}× {item.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CustomersScreen() {
  const { t, lang } = useLang();
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [isExporting, setIsExporting] = useState<"pdf" | "csv" | null>(null);

  // Build customer map from orders
  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();
    orders.forEach((o) => {
      const phone = o.customerPhone;
      if (!map.has(phone)) {
        map.set(phone, {
          phone,
          name: o.customerName,
          orders: [],
          totalSpent: 0,
          lastOrderAt: o.createdAt,
        });
      }
      const c = map.get(phone)!;
      c.orders.push(o);
      c.totalSpent += o.totalAmount ?? 0;
      if (o.createdAt > c.lastOrderAt) {
        c.lastOrderAt = o.createdAt;
        c.name = o.customerName;
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      b.lastOrderAt.localeCompare(a.lastOrderAt)
    );
  }, [orders]);

  // Stats
  const totalCustomers = customers.length;
  const vipCount = useMemo(
    () => customers.filter(isVIP).length,
    [customers]
  );
  const totalRevenue = useMemo(
    () => customers.reduce((s, c) => s + c.totalSpent, 0),
    [customers]
  );

  // Filtered list
  const filtered = useMemo(() => {
    let list = customers;
    if (tab === "frequent") list = list.filter((c) => c.orders.length >= 3);
    if (tab === "vip") list = list.filter(isVIP);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }
    return list;
  }, [customers, search, tab]);

  // ── Export helpers ───────────────────────────────────────────────────────
  const buildExportRows = () =>
    filtered.map((c) => ({
      name: c.name,
      phone: c.phone,
      orders: c.orders.length,
      totalSpent: c.totalSpent,
      lastOrder: fmtDate(c.lastOrderAt, lang),
      vip: isVIP(c) ? "⭐ VIP" : "",
      favDept: getFavoriteDepartment(c.orders),
      totalItems: getTotalItems(c.orders),
    }));

  const handleExportPDF = async () => {
    setIsExporting("pdf");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const rows = buildExportRows();
      const now = new Date().toLocaleDateString("ar-SA");
      const tableRows = rows
        .map(
          (r, i) => `
          <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
            <td>${i + 1}</td>
            <td style="font-weight:700">${r.name}</td>
            <td dir="ltr">${r.phone}</td>
            <td>${r.orders}</td>
            <td style="color:#16a34a;font-weight:700">${r.totalSpent.toFixed(2)} ر.س</td>
            <td>${r.vip}</td>
            <td>${r.favDept}</td>
            <td>${r.totalItems}</td>
            <td style="font-size:11px;color:#666">${r.lastOrder}</td>
          </tr>`
        )
        .join("");

      const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"/>
      <style>
        * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin:0; padding:0; box-sizing:border-box; }
        body { padding: 24px; color: #1a1a1a; font-size: 13px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 22px; color: #7c3aed; margin-bottom: 4px; }
        .header p { color: #666; font-size: 12px; }
        .stats { display: flex; gap: 12px; margin-bottom: 20px; justify-content: center; }
        .stat { background: #f3f0ff; border-radius: 8px; padding: 10px 20px; text-align: center; }
        .stat-num { font-size: 20px; font-weight: 900; color: #7c3aed; }
        .stat-label { font-size: 11px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #7c3aed; color: #fff; padding: 8px 6px; font-size: 11px; text-align: center; }
        td { padding: 7px 6px; border-bottom: 1px solid #eee; text-align: center; font-size: 12px; }
        .footer { margin-top: 16px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 12px; } }
      </style></head>
      <body>
        <div class="header">
          <h1>🌹 Laviviane — قائمة العملاء</h1>
          <p>تاريخ التصدير: ${now} · إجمالي العملاء: ${rows.length}</p>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat-num">${rows.length}</div><div class="stat-label">إجمالي العملاء</div></div>
          <div class="stat"><div class="stat-num">${rows.filter((r) => r.vip).length}</div><div class="stat-label">⭐ VIP</div></div>
          <div class="stat"><div class="stat-num">${rows.reduce((s, r) => s + r.orders, 0)}</div><div class="stat-label">إجمالي الطلبات</div></div>
          <div class="stat"><div class="stat-num" style="color:#16a34a">${rows.reduce((s, r) => s + r.totalSpent, 0).toFixed(0)} ر.س</div><div class="stat-label">إجمالي الإيرادات</div></div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>الاسم</th><th>الهاتف</th><th>الطلبات</th>
            <th>الإجمالي</th><th>VIP</th><th>القسم المفضل</th><th>الأصناف</th><th>آخر طلب</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">Laviviane Maison de Pâtisserie · ${now}</div>
      </body></html>`;

      if (Platform.OS === "web") {
        const win = (globalThis as any).window?.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          setTimeout(() => win.print(), 400);
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: t("custExportPDF"),
        });
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting("csv");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const rows = buildExportRows();
      const headers = ["الاسم", "الهاتف", "عدد الطلبات", "الإجمالي (ر.س)", "VIP", "القسم المفضل", "إجمالي الأصناف", "آخر طلب"];
      const csvLines = [
        headers.join(","),
        ...rows.map((r) =>
          [
            `"${r.name}"`,
            `"${r.phone}"`,
            r.orders,
            r.totalSpent.toFixed(2),
            r.vip ? "VIP" : "",
            `"${r.favDept}"`,
            r.totalItems,
            `"${r.lastOrder}"`,
          ].join(",")
        ),
      ];
      // UTF-8 BOM so Arabic renders correctly in Excel
      const csv = "﻿" + csvLines.join("\n");
      const fileName = `laviviane-customers-${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = (globalThis as any).document?.createElement("a");
        if (a) {
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const fileUri = (FileSystem.documentDirectory ?? "") + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: t("custExportCSV"),
        });
      }
    } finally {
      setIsExporting(null);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: t("custAll") },
    { key: "frequent", label: t("custFrequent") },
    { key: "vip", label: "⭐ VIP" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Stats Header ── */}
      <View style={styles.statsRow}>
        <StatCard
          label={t("custTotalCustomers")}
          value={String(totalCustomers)}
          icon="👥"
          accent={Colors.primary}
        />
        <StatCard
          label={t("custVIPCount")}
          value={String(vipCount)}
          icon="⭐"
          accent={Colors.gold}
        />
        <StatCard
          label={t("custRevenue")}
          value={fmtCurrency(totalRevenue)}
          icon="💰"
          accent={Colors.success}
        />
      </View>

      {/* ── Search ── */}
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

      {/* ── Tabs ── */}
      <View style={styles.tabRow}>
        {tabs.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setTab(key);
            }}
          >
            <Text
              style={[
                styles.tabBtnText,
                tab === key && styles.tabBtnTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Export Bar ── */}
      {filtered.length > 0 && (
        <View style={styles.exportBar}>
          <Text style={styles.exportCount}>
            {filtered.length} {t("custTotalCustomers").replace("إجمالي ", "")}
          </Text>
          <View style={styles.exportBtns}>
            <TouchableOpacity
              style={[styles.exportBtn, isExporting === "pdf" && styles.exportBtnDisabled]}
              onPress={handleExportPDF}
              disabled={isExporting !== null}
              activeOpacity={0.8}
            >
              {isExporting === "pdf" ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Feather name="file-text" size={14} color={Colors.accent} />
              )}
              <Text style={[styles.exportBtnText, { color: Colors.accent }]}>
                {t("custExportPDF")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, styles.exportBtnExcel, isExporting === "csv" && styles.exportBtnDisabled]}
              onPress={handleExportCSV}
              disabled={isExporting !== null}
              activeOpacity={0.8}
            >
              {isExporting === "csv" ? (
                <ActivityIndicator size="small" color={Colors.success} />
              ) : (
                <Feather name="download" size={14} color={Colors.success} />
              )}
              <Text style={[styles.exportBtnText, { color: Colors.success }]}>
                {t("custExportCSV")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Customer List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.phone}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 16,
          gap: 10,
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t("custNoResults")}</Text>
          </View>
        }
        renderItem={({ item: c }) => {
          const vip = isVIP(c);
          return (
            <View
              style={[
                styles.customerCard,
                vip && styles.customerCardVip,
              ]}
            >
              {/* Top row: avatar + info + orders badge + chevron */}
              <TouchableOpacity
                style={styles.cardTopRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelected(c);
                }}
                activeOpacity={0.8}
              >
                {/* Avatar */}
                <View
                  style={[
                    styles.avatarCircle,
                    {
                      backgroundColor: vip
                        ? Colors.gold + "25"
                        : Colors.primary + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: vip ? Colors.gold : Colors.primary },
                    ]}
                  >
                    {c.name.charAt(0)}
                  </Text>
                </View>

                {/* Name + phone + last order */}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.custName}>{c.name}</Text>
                    {vip && (
                      <View style={styles.vipBadge}>
                        <Text style={styles.vipBadgeText}>⭐ VIP</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.custPhone}>{c.phone}</Text>
                  <Text style={styles.custMeta}>
                    {t("custLastOrder")} {fmtDate(c.lastOrderAt, lang)}
                  </Text>
                </View>

                {/* Orders badge */}
                <View style={styles.ordersBadge}>
                  <Text
                    style={[
                      styles.ordersNum,
                      { color: vip ? Colors.gold : Colors.primary },
                    ]}
                  >
                    {c.orders.length}
                  </Text>
                  <Text style={styles.ordersLabel}>{t("custOrders")}</Text>
                </View>

                <Feather
                  name="chevron-left"
                  size={16}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.cardDivider} />

              {/* Bottom row: total spent + quick actions */}
              <View style={styles.cardBottomRow}>
                <View style={styles.spentWrap}>
                  <Feather
                    name="dollar-sign"
                    size={12}
                    color={Colors.gold}
                  />
                  <Text style={styles.spentText}>
                    {fmtCurrency(c.totalSpent)}
                  </Text>
                </View>

                <View style={styles.quickActionsRow}>
                  {/* Call */}
                  <TouchableOpacity
                    style={[
                      styles.quickBtn,
                      { backgroundColor: Colors.success + "18" },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      Linking.openURL(`tel:${c.phone}`);
                    }}
                    activeOpacity={0.75}
                  >
                    <Feather name="phone" size={14} color={Colors.success} />
                    <Text
                      style={[
                        styles.quickBtnText,
                        { color: Colors.success },
                      ]}
                    >
                      اتصال
                    </Text>
                  </TouchableOpacity>

                  {/* WhatsApp */}
                  <TouchableOpacity
                    style={[
                      styles.quickBtn,
                      { backgroundColor: "#25D36618" },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      openWhatsApp(c.phone);
                    }}
                    activeOpacity={0.75}
                  >
                    <Feather
                      name="message-circle"
                      size={14}
                      color="#25D366"
                    />
                    <Text
                      style={[styles.quickBtnText, { color: "#25D366" }]}
                    >
                      واتساب
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* ── History Modal ── */}
      {selected && (
        <CustomerHistoryModal
          customer={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: { fontSize: 20, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "900" },
  statLabel: { fontSize: 10, color: Colors.textMuted, textAlign: "center" },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabBtnTextActive: { color: "#fff" },

  // Export bar
  exportBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  exportCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  exportBtns: {
    flexDirection: "row",
    gap: 8,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.accent + "12",
    borderWidth: 1,
    borderColor: Colors.accent + "30",
  },
  exportBtnExcel: {
    backgroundColor: Colors.success + "12",
    borderColor: Colors.success + "30",
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Customer card
  customerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  customerCardVip: {
    borderColor: Colors.gold + "66",
    shadowColor: Colors.gold,
    shadowOpacity: 0.15,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  custName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  vipBadge: {
    backgroundColor: Colors.gold + "22",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.gold + "55",
  },
  vipBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.gold },
  custPhone: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  custMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  ordersBadge: { alignItems: "center", paddingHorizontal: 10 },
  ordersNum: { fontSize: 20, fontWeight: "900" },
  ordersLabel: { fontSize: 10, color: Colors.textMuted },
  cardDivider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: 14 },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  spentWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  spentText: { fontSize: 13, fontWeight: "700", color: Colors.gold },
  quickActionsRow: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  quickBtnText: { fontSize: 12, fontWeight: "600" },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },

  // ── Modal ──
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 18,
  },
  modalAvatarWrap: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: { fontSize: 22, fontWeight: "900" },
  modalNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  modalVipBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  modalVipText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  modalPhone: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal stats row
  modalStatsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalStatItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 2,
  },
  modalStatDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 10 },
  modalStatValue: { fontSize: 15, fontWeight: "900" },
  modalStatLabel: { fontSize: 11, color: Colors.textMuted },

  // Favorite department
  favDeptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold + "12",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  favDeptText: { fontSize: 13, color: Colors.textSecondary },

  // Quick contact row
  quickContactRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  contactBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // History
  historyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    padding: 16,
    paddingBottom: 8,
  },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  historyNumWrap: {
    backgroundColor: Colors.primary + "15",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  historyNum: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  historyDate: { flex: 1, fontSize: 12, color: Colors.textMuted },
  historyAmount: { fontSize: 14, fontWeight: "700", color: Colors.gold },
  historyItemsWrap: { gap: 3 },
  historyItemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyItemDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary + "40",
  },
  historyItem: { fontSize: 12, color: Colors.textSecondary },
  noOrdersText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    padding: 24,
  },
});
