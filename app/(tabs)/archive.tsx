import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { EmptyState } from "@/components/EmptyState";
import EditOrderModal from "@/components/EditOrderModal";
import { Colors } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";
import { canDo, ROLE_CAN_DELETE_ORDERS, ROLE_CAN_EDIT_ORDERS } from "@/constants/rbac";
import { useLang } from "@/context/LanguageContext";
import { useEmployee } from "@/context/EmployeeContext";
import { Department, Order, OrderStatus, PAYMENT_LABELS, useOrders } from "@/context/OrdersContext";
import { fmtDate, fmtDateTime } from "@/utils/dateUtils";

const DEPT_CONFIG: Record<Department, { labelKey: TranslationKey; shortKey: TranslationKey; color: string }> = {
  halwa:     { labelKey: "deptHalwaLabel",     shortKey: "deptHalwaShort",     color: Colors.halwa },
  mawali:    { labelKey: "deptMawaliLabel",    shortKey: "deptMawaliShort",    color: Colors.mawali },
  chocolate: { labelKey: "deptChocolateLabel", shortKey: "deptChocolateShort", color: Colors.chocolate },
  cake:      { labelKey: "deptCakeLabel",      shortKey: "deptCakeShort",      color: Colors.cake },
  packaging: { labelKey: "deptPackagingLabel", shortKey: "deptPackagingShort", color: Colors.packaging },
};

const DEPT_FILTER_KEYS: { value: Department | "all"; labelKey: TranslationKey }[] = [
  { value: "all",       labelKey: "archiveAll" },
  { value: "halwa",     labelKey: "deptHalwaShort" },
  { value: "mawali",    labelKey: "deptMawaliShort" },
  { value: "chocolate", labelKey: "deptChocolateShort" },
  { value: "cake",      labelKey: "deptCakeShort" },
  { value: "packaging", labelKey: "deptPackagingShort" },
];

function ArchiveCard({ order, canDelete, canEdit, onDelete, onEdit }: { order: Order; canDelete?: boolean; canEdit?: boolean; onDelete?: (o: Order) => void; onEdit?: (o: Order) => void }) {
  const { lang, t } = useLang();
  const depts = [...new Set(order.items.map((i) => i.department))] as Department[];

  return (
    <View style={styles.archiveCard}>
      {/* Header */}
      <View style={styles.archiveHeader}>
        <View style={styles.archiveHeaderLeft}>
          <Text style={styles.archiveNum}>#{order.orderNumber}</Text>
          <Text style={styles.archiveDate}>{fmtDate(order.createdAt, lang)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.deptTags}>
            {(Object.keys(DEPT_CONFIG) as Department[]).map((key) =>
              depts.includes(key) ? (
                <View key={key} style={[styles.deptTag, { backgroundColor: DEPT_CONFIG[key].color }]}>
                  <Text style={styles.deptTagText}>{t(DEPT_CONFIG[key].shortKey)}</Text>
                </View>
              ) : null
            )}
          </View>
          {canEdit && onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(order)}
              style={[styles.deleteBtn, { backgroundColor: Colors.primary + "12" }]}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {canDelete && onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(order)}
              style={styles.deleteBtn}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={15} color={Colors.accent} />
            </TouchableOpacity>
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

      {/* Delivery badge */}
      {order.orderType === "delivery" && (
        <View style={styles.deliverySection}>
          <View style={styles.deliveryBadge}>
            <Feather name="truck" size={11} color={Colors.info} />
            <Text style={styles.deliveryBadgeText}>{t("delivery")}</Text>
          </View>
          {order.deliveryAddress ? (
            <View style={styles.footerItem}>
              <Feather name="map-pin" size={11} color={Colors.textMuted} />
              <Text style={styles.footerText}>{order.deliveryAddress}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Items grouped by dept */}
      {(Object.keys(DEPT_CONFIG) as Department[]).map((key) => {
        const deptItems = order.items.filter((i) => i.department === key);
        if (deptItems.length === 0) return null;
        const meta = DEPT_CONFIG[key];
        return (
          <View key={key} style={[styles.deptSection, { borderRightColor: meta.color }]}>
            <Text style={[styles.deptSectionTitle, { color: meta.color }]}>{t(meta.labelKey)}</Text>
            {deptItems.map((item, i) => (
              <Text key={i} style={styles.archiveItem}>
                • {item.quantity}× {item.name}{item.note ? ` (${item.note})` : ""}
              </Text>
            ))}
            <StatusRow status={order.departmentStatuses?.[key]} />
          </View>
        );
      })}

      {/* Notes */}
      {order.notes ? (
        <View style={styles.notesRow}>
          <Feather name="file-text" size={12} color={Colors.textMuted} />
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      {/* Employee accountability trail */}
      {(order.cashierEmployee || Object.values(order.departmentReceivers ?? {}).some(Boolean)) && (
        <View style={styles.trailBox}>
          {order.cashierEmployee && (
            <View style={styles.trailRow}>
              <Feather name="edit-3" size={11} color={Colors.gold} />
              <Text style={styles.trailLabel}>{t("archiveEnteredBy")}</Text>
              <Text style={styles.trailName}>{order.cashierEmployee.name}</Text>
              <Text style={styles.trailId}>#{order.cashierEmployee.employeeId}</Text>
            </View>
          )}
          {order.departmentReceivers && (Object.keys(DEPT_CONFIG) as Department[]).map((key) => {
            const receiver = order.departmentReceivers?.[key];
            if (!receiver) return null;
            const meta = DEPT_CONFIG[key];
            return (
              <View key={key} style={styles.trailRow}>
                <Feather name="check-square" size={11} color={meta.color} />
                <Text style={[styles.trailLabel, { color: meta.color }]}>
                  {t("archiveReceivedBy")} {t(meta.shortKey)}:
                </Text>
                <Text style={[styles.trailName, { color: meta.color }]}>{receiver.name}</Text>
                <Text style={styles.trailId}>#{receiver.employeeId}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Footer: timing & amounts */}
      <View style={styles.archiveFooter}>
        <View style={styles.footerItem}>
          <Feather name="download" size={11} color={Colors.textMuted} />
          <Text style={styles.footerText}>{fmtDateTime(order.receivedAt, lang)}</Text>
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
              {order.totalAmount.toFixed(2)} {t("sar")}
            </Text>
          </View>
        )}
        {order.insuranceAmount != null && order.insuranceAmount > 0 && (
          <View style={styles.footerItem}>
            <Feather name="shield" size={11} color={Colors.gold} />
            <Text style={[styles.footerText, { color: Colors.gold, fontWeight: "700" }]}>
              {t("insurance_short")} {order.insuranceAmount} {t("sar")}
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
                ? `${t("discount")} ${order.discount.value}%`
                : `${t("discount")} ${order.discount.value.toFixed(2)} ${t("sar")}`}
              {order.discount.reason ? ` · ${order.discount.reason}` : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatusRow({ status }: { status?: OrderStatus }) {
  const { t } = useLang();
  const conf: Record<OrderStatus, { labelKey: TranslationKey; color: string }> = {
    pending:     { labelKey: "waiting",     color: Colors.statusPending },
    in_progress: { labelKey: "preparing",   color: Colors.statusInProgress },
    done:        { labelKey: "statusDone",  color: Colors.statusDone },
    cancelled:   { labelKey: "statusCancelled", color: Colors.statusCancelled },
  };
  if (!status) return null;
  const c = conf[status];
  return (
    <View style={[styles.statusRow, { backgroundColor: c.color + "18" }]}>
      <View style={[styles.statusDot, { backgroundColor: c.color }]} />
      <Text style={[styles.statusLabel, { color: c.color }]}>{t(c.labelKey)}</Text>
    </View>
  );
}

function DeletedCard({ order, onRestore }: { order: Order; onRestore: (id: string) => void }) {
  const { lang, t } = useLang();
  return (
    <View style={[styles.archiveCard, { borderRightWidth: 3, borderRightColor: Colors.accent }]}>
      <View style={styles.archiveHeader}>
        <View style={styles.archiveHeaderLeft}>
          <Text style={styles.archiveNum}>#{order.orderNumber}</Text>
          <Text style={styles.archiveDate}>{fmtDate(order.createdAt, lang)}</Text>
        </View>
        <View style={[styles.deptTag, { backgroundColor: Colors.accent + "18", borderRadius: 8 }]}>
          <Text style={[styles.deptTagText, { color: Colors.accent }]}>{t("archiveDeletedLabel")}</Text>
        </View>
      </View>
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
      {order.deletedAt && (
        <View style={styles.trailRow}>
          <Feather name="trash-2" size={11} color={Colors.accent} />
          <Text style={styles.trailLabel}>{t("archiveDeletedAt")}</Text>
          <Text style={[styles.trailName, { color: Colors.accent }]}>{fmtDate(order.deletedAt, lang)}</Text>
          {order.deletedBy && (
            <Text style={styles.trailId}>· {order.deletedBy.name}</Text>
          )}
        </View>
      )}
      <TouchableOpacity
        style={styles.restoreBtn}
        onPress={() => onRestore(order.id)}
        activeOpacity={0.8}
      >
        <Feather name="rotate-ccw" size={14} color="#fff" />
        <Text style={styles.restoreBtnText}>{t("archiveRestoreInv")}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ArchiveScreen() {
  const { orders, deletedOrders, deleteOrder, restoreOrder, updateOrder } = useOrders();
  const { currentEmployee } = useEmployee();
  const { t, lang } = useLang();
  const isAdmin = canDo(currentEmployee?.role, ROLE_CAN_DELETE_ORDERS);
  const canEdit = canDo(currentEmployee?.role, ROLE_CAN_EDIT_ORDERS);
  const [activeTab, setActiveTab] = useState<"archive" | "trash">("archive");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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

  const handleDelete = (order: Order) => {
    const doDelete = () => deleteOrder(
      order.id,
      currentEmployee ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId } : undefined
    );
    if (Platform.OS === "web") {
      if ((window as any).confirm(`${t("archiveDelete")} #${order.orderNumber} — "${order.customerName}"?`)) doDelete();
      return;
    }
    Alert.alert(
      `${t("archiveDelete")} #${order.orderNumber}`,
      `"${order.customerName}"?`,
      [{ text: t("cancel"), style: "cancel" }, { text: t("delete"), style: "destructive", onPress: doDelete }]
    );
  };

  const handlePrint = () => {
    if (Platform.OS !== "web") return;
    const grandTotal = filtered.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const deptLabel = deptFilter !== "all" ? ` — ${t(DEPT_CONFIG[deptFilter as Department].labelKey)}` : "";
    const dateLabel = dateFilter ? ` — ${fmtDate(dateFilter, lang)}` : "";
    const rows = filtered.map(o => {
      const itemsHtml = (Object.keys(DEPT_CONFIG) as Department[]).map((key) => {
        const meta = DEPT_CONFIG[key];
        const di = o.items.filter(i => i.department === key);
        if (!di.length) return "";
        return `<div style="margin:3px 0;border-right:3px solid ${meta.color};padding-right:7px">
          <b style="color:${meta.color}">${t(meta.labelKey)}</b><br/>
          ${di.map(i => `${i.quantity}× ${i.name}${i.note ? ` (${i.note})` : ""}`).join("<br/>")}
        </div>`;
      }).join("");
      const discount = o.discount?.value && o.discount.value > 0
        ? (o.discount.type === "percentage"
            ? `${t("discount")} ${o.discount.value}%`
            : `${t("discount")} ${o.discount.value.toFixed(2)} ${t("sar")}`)
        : "";
      return `<tr>
        <td>#${o.orderNumber}</td>
        <td>${o.customerName || "-"}<br/><small>${o.customerPhone || ""}</small></td>
        <td>${itemsHtml}</td>
        <td style="font-weight:700">${o.totalAmount != null ? `${o.totalAmount.toFixed(2)} ${t("sar")}` : "-"}</td>
        <td>${o.paymentMethod ? (PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod) : "-"}</td>
        <td>${discount}</td>
        <td>${fmtDate(o.createdAt, lang)}</td>
      </tr>`;
    }).join("");
    const title = `${t("archiveTitle")}${dateLabel}${deptLabel}`;
    const html = `<!DOCTYPE html><html dir="rtl" lang="${lang}"><head><meta charset="UTF-8"/>
<title>${title}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;direction:rtl;margin:20px}
h2{text-align:center;margin-bottom:12px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#0A1628;color:#fff}
tr:nth-child(even){background:#f7f7f7}
@media print{body{margin:0}}
</style></head><body>
<h2>${title} — ${filtered.length} ${t("invoiceCount")}</h2>
<table><thead><tr>
<th>#</th>
<th>${t("customerName")}</th>
<th>${t("itemsDetails")}</th>
<th>${t("totalAmount")}</th>
<th>${t("paymentMethod")}</th>
<th>${t("discount")}</th>
<th>${t("today")}</th>
</tr></thead><tbody>${rows}</tbody>
<tfoot><tr style="background:#0A1628;color:#fff">
<td colspan="3" style="text-align:center;font-weight:700;padding:8px">${t("grandTotal")}</td>
<td style="font-weight:700;font-size:13px">${grandTotal.toFixed(2)} ${t("sar")}</td>
<td colspan="3"></td>
</tr></tfoot></table>
</body></html>`;
    const w = (window as any).open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      {isAdmin && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === "archive" && styles.tabItemActive]}
            onPress={() => setActiveTab("archive")}
          >
            <Feather name="archive" size={14} color={activeTab === "archive" ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === "archive" && styles.tabLabelActive]}>
              {t("archiveTitle")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === "trash" && styles.tabItemActive]}
            onPress={() => setActiveTab("trash")}
          >
            <Feather name="trash-2" size={14} color={activeTab === "trash" ? Colors.accent : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === "trash" && { color: Colors.accent, fontWeight: "700" }]}>
              {t("archiveTrashTab")} {deletedOrders.length > 0 ? `(${deletedOrders.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === "trash" && isAdmin ? (
        /* ── Trash tab ── */
        <FlatList
          data={deletedOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, deletedOrders.length === 0 && { flex: 1 }]}
          renderItem={({ item }) => <DeletedCard order={item} onRestore={restoreOrder} />}
          ListEmptyComponent={
            <EmptyState icon="trash-2" title={t("noTrashOrders")} subtitle={t("noTrashOrdersSub")} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        /* ── Archive tab ── */
        <View style={[styles.archiveContent, Platform.OS === "web" && styles.archiveContentWide]}>
          <View style={styles.searchRow}>
            <Feather name="search" size={17} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t("archiveSearch")}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filterBar}>
            <View style={styles.filterGroup}>
              {DEPT_FILTER_KEYS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.chip, deptFilter === f.value && styles.chipActive]}
                  onPress={() => setDeptFilter(f.value as any)}
                >
                  <Text style={[styles.chipText, deptFilter === f.value && styles.chipTextActive]}>
                    {t(f.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.searchRow, { marginHorizontal: 0, marginTop: 6 }]}>
              <Feather name="calendar" size={14} color={Colors.textMuted} />
              {Platform.OS === "web" ? (
                <View style={styles.webDateWrapper}>
                  <Text style={[styles.searchInput, { flex: 1, paddingVertical: 0, color: dateFilter ? Colors.text : Colors.textMuted }]}>
                    {dateFilter ? fmtDate(dateFilter, lang) : t("dateFilterPicker")}
                  </Text>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e: any) => setDateFilter(e.target.value)}
                    style={{
                      position: "absolute", inset: 0, opacity: 0, cursor: "pointer",
                      width: "100%", height: "100%",
                    } as any}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.searchInput}
                  value={dateFilter}
                  onChangeText={setDateFilter}
                  placeholder={t("dateFilterPicker")}
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                  keyboardType="numeric"
                />
              )}
              {dateFilter ? (
                <TouchableOpacity onPress={() => setDateFilter("")}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.countRow}>
            <Feather name="file-text" size={13} color={Colors.textMuted} />
            <Text style={[styles.countText, { flex: 1 }]}>{filtered.length} {t("invoiceCount")}</Text>
            {Platform.OS === "web" && filtered.length > 0 && (
              <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.75}>
                <Feather name="printer" size={13} color={Colors.primary} />
                <Text style={styles.printBtnText}>{t("archivePrintShort")}</Text>
              </TouchableOpacity>
            )}
          </View>

          <EditOrderModal
            order={editingOrder}
            visible={editingOrder !== null}
            onClose={() => setEditingOrder(null)}
            onSave={(id: string, patch: Parameters<typeof updateOrder>[1]) => { updateOrder(id, patch); setEditingOrder(null); }}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
            renderItem={({ item }) => (
              <ArchiveCard
                order={item}
                canDelete={isAdmin}
                canEdit={canEdit}
                onDelete={handleDelete}
                onEdit={setEditingOrder}
              />
            )}
            ListEmptyComponent={
              <EmptyState icon="archive" title={t("noInvoices")} subtitle={t("noInvoicesSub")} />
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  tabItem: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
  },
  tabItemActive: {
    backgroundColor: Colors.primary + "12",
    borderBottomWidth: 2, borderBottomColor: Colors.primary,
  },
  tabLabel: { fontSize: 13, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: "700" },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.accent + "12",
    alignItems: "center", justifyContent: "center",
  },
  restoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, marginTop: 4,
  },
  restoreBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  webDateWrapper: { flex: 1, position: "relative" as const, flexDirection: "row" as const, alignItems: "center" as const },
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
  printBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary + "12", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.primary + "25",
  },
  printBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "700" },
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
  deptSection: { borderRightWidth: 3, paddingRight: 12, paddingLeft: 4, gap: 4, paddingVertical: 6 },
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
  deliverySection: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  deliveryBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.info + "15", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.info + "30",
  },
  deliveryBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.info },
  notesRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: Colors.surface, borderRadius: 8,
    padding: 9, borderWidth: 1, borderColor: Colors.borderLight,
  },
  notesText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  archiveContent: { flex: 1 },
  archiveContentWide: { maxWidth: 800, width: "100%", alignSelf: "center" as const },
});
