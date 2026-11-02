import { tr, trf } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DriversModal } from "@/components/DriversModal";
import { OrderDetailsSheet } from "@/components/OrderDetailsSheet";
import { OrderTracker, StageBadge } from "@/components/OrderTracker";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { Colors } from "@/constants/colors";
import { canDo, ROLE_CAN_VIEW_DELIVERY } from "@/constants/rbac";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Order, useOrders } from "@/context/OrdersContext";
import {
  byDueThenNewest,
  DEPT_COLOR,
  dueLabel,
  dueUrgency,
  hasOpenDriverRequest,
  isOrderOpen,
  orderDepartments,
  orderStage,
  OrderStage,
  parseDue,
  URGENCY_COLOR,
} from "@/utils/orderFlow";

type Filter = "active" | "production" | "ready" | "driver" | "late" | "requests" | "done";
type Scope = "today" | "upcoming" | "all";

const FILTERS: { key: Filter; ar: string; en: string; stages?: OrderStage[] }[] = [
  { key: "active",     ar: "المفتوحة",     en: "Open" },
  { key: "production", ar: "قيد التحضير",  en: "In production", stages: ["received", "in_production"] },
  { key: "ready",      ar: "جاهزة",        en: "Ready",         stages: ["ready", "delivery_failed"] },
  { key: "driver",     ar: "مع السائق",    en: "With driver",   stages: ["out_for_delivery"] },
  { key: "late",       ar: "متأخرة",       en: "Late" },
  { key: "requests",   ar: "طلبات السائقين", en: "Driver requests" },
  { key: "done",       ar: "مكتملة",       en: "Completed",     stages: ["delivered", "picked_up"] },
];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function relevantDate(o: Order) {
  return parseDue(o.deliveryTime) ?? new Date(o.createdAt);
}

export default function TrackingScreen() {
  const { orders, isLoading, refreshOrders } = useOrders();
  const { currentEmployee } = useEmployee();
  const { lang } = useLang();
  const ar = lang === "ar";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [filter, setFilter] = useState<Filter>("active");
  const [scope, setScope] = useState<Scope>("today");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDrivers, setShowDrivers] = useState(false);

  const scoped = useMemo(() => {
    const today = dayKey(new Date());
    const now = Date.now();
    return orders.filter((o) => {
      const d = relevantDate(o);
      if (scope === "today") return dayKey(d) === today || (isOrderOpen(o) && d.getTime() < now);
      if (scope === "upcoming") return d.getTime() > now && dayKey(d) !== today;
      return true;
    });
  }, [orders, scope]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { active: 0, production: 0, ready: 0, driver: 0, late: 0, requests: 0, done: 0 };
    scoped.forEach((o) => {
      const s = orderStage(o);
      if (isOrderOpen(o)) c.active++;
      FILTERS.forEach((f) => { if (f.stages?.includes(s)) c[f.key]++; });
      if (dueUrgency(o) === "overdue") c.late++;
      if (hasOpenDriverRequest(o)) c.requests++;
    });
    return c;
  }, [scoped]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const f = FILTERS.find((x) => x.key === filter)!;
    return scoped
      .filter((o) => {
        if (q) {
          const hay = `${o.orderNumber} ${o.customerName} ${o.customerPhone} ${o.customerPhone2 ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filter === "active") return isOrderOpen(o);
        if (filter === "late") return dueUrgency(o) === "overdue";
        if (filter === "requests") return hasOpenDriverRequest(o);
        return f.stages!.includes(orderStage(o));
      })
      .sort(filter === "done" ? (a, b) => b.updatedAt.localeCompare(a.updatedAt) : byDueThenNewest);
  }, [scoped, filter, search]);

  if (currentEmployee && !canDo(currentEmployee.role, ROLE_CAN_VIEW_DELIVERY)) {
    return (
      <View style={st.locked}>
        <Feather name="lock" size={32} color={Colors.textMuted} />
        <Text style={st.lockedTxt}>{tr("هذه الشاشة للكاشير ومشرف الفرع", "For cashiers and branch supervisors")}</Text>
      </View>
    );
  }

  return (
    <View style={st.screen}>
      <ScrollView
        contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshOrders} />}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={{ gap: 12 }}>
          <SyncStatusBanner />
          {counts.requests > 0 && (
            <Pressable style={st.reqBanner} onPress={() => setFilter("requests")}>
              <Feather name="life-buoy" size={16} color={Colors.warning} />
              <Text style={st.reqBannerTxt}>{trf("{p0} طلب من السائقين بانتظار المعالجة (دعم / تحويل)", "{p0} driver request(s) waiting (support / transfer)", { p0: counts.requests })}</Text>
              <Feather name={ar ? "chevron-left" : "chevron-right"} size={16} color={Colors.warning} />
            </Pressable>
          )}
          <View style={st.summary}>
            {[
              { k: "production" as Filter, icon: "loader", color: Colors.statusInProgress },
              { k: "ready" as Filter, icon: "check-circle", color: Colors.statusDone },
              { k: "driver" as Filter, icon: "truck", color: Colors.gold },
              { k: "late" as Filter, icon: "alert-circle", color: Colors.statusCancelled },
            ].map((x) => {
              const f = FILTERS.find((y) => y.key === x.k)!;
              return (
                <Pressable key={x.k} style={[st.sumCard, filter === x.k && { borderColor: x.color }]} onPress={() => setFilter(x.k)}>
                  <Feather name={x.icon as never} size={16} color={x.color} />
                  <Text style={[st.sumNum, { color: x.color }]}>{counts[x.k]}</Text>
                  <Text style={st.sumLbl} numberOfLines={1}>{tr(f.ar, f.en)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sticky controls */}
        <View style={st.controls}>
          <View style={st.searchRow}>
            <View style={st.search}>
              <Feather name="search" size={16} color={Colors.textMuted} />
              <TextInput
                style={st.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={tr("رقم الطلب، الاسم أو الجوال", "Order #, name or phone")}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <Pressable style={st.driversBtn} onPress={() => setShowDrivers(true)}>
              <Feather name="users" size={16} color={Colors.primary} />
              <Text style={st.driversTxt}>{tr("السائقون", "Drivers")}</Text>
            </Pressable>
          </View>
          <View style={st.scopeRow}>
            {([["today", "اليوم", "Today"], ["upcoming", "القادمة", "Upcoming"], ["all", "الكل", "All"]] as const).map(([k, a, e]) => (
              <Pressable key={k} style={[st.scope, scope === k && st.scopeOn]} onPress={() => setScope(k)}>
                <Text style={[st.scopeTxt, scope === k && st.scopeTxtOn]}>{tr(a, e)}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filters}>
            {FILTERS.map((f) => (
              <Pressable key={f.key} style={[st.filter, filter === f.key && st.filterOn]} onPress={() => setFilter(f.key)}>
                <Text style={[st.filterTxt, filter === f.key && st.filterTxtOn]}>{tr(f.ar, f.en)}</Text>
                <View style={[st.count, filter === f.key && { backgroundColor: Colors.goldLight }]}>
                  <Text style={[st.countTxt, filter === f.key && { color: Colors.primary }]}>{counts[f.key]}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <View style={[st.list, wide && st.listWide]}>
          {list.length === 0 && (
            <View style={st.empty}>
              <Feather name="inbox" size={30} color={Colors.textMuted} />
              <Text style={st.emptyTxt}>{tr("لا توجد طلبات هنا", "No orders here")}</Text>
            </View>
          )}
          {list.map((o) => (
            <TrackCard key={o.id} order={o} wide={wide} onPress={() => setOpenId(o.id)} />
          ))}
        </View>
      </ScrollView>

      <OrderDetailsSheet orderId={openId} visible={!!openId} onClose={() => setOpenId(null)} />
      <DriversModal visible={showDrivers} onClose={() => setShowDrivers(false)} />
    </View>
  );
}

function TrackCard({ order, onPress, wide }: { order: Order; onPress: () => void; wide: boolean }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const urg = dueUrgency(order);
  const due = dueLabel(order, lang);
  const depts = orderDepartments(order);
  const isDelivery = order.orderType === "delivery";
  return (
    <Pressable onPress={onPress} style={[st.card, wide && st.cardWide, urg === "overdue" && { borderColor: Colors.statusCancelled + "66" }]}>
      <View style={st.cardTop}>
        <Text style={st.cardNum}>#{order.orderNumber}</Text>
        <Text style={st.cardName} numberOfLines={1}>{order.customerName}</Text>
        <StageBadge order={order} size="sm" />
      </View>
      <View style={st.cardMeta}>
        <View style={st.metaPill}>
          <Feather name={isDelivery ? "truck" : "shopping-bag"} size={11} color={Colors.textSecondary} />
          <Text style={st.metaTxt}>{isDelivery ? (tr("توصيل", "Delivery")) : (tr("استلام", "Pickup"))}</Text>
        </View>
        {order.deliveryTime ? (
          <View style={[st.metaPill, { backgroundColor: URGENCY_COLOR[urg] + "14" }]}>
            <Feather name="clock" size={11} color={URGENCY_COLOR[urg]} />
            <Text style={[st.metaTxt, { color: URGENCY_COLOR[urg] }]}>{order.deliveryTime.slice(-5)}{due ? ` · ${due}` : ""}</Text>
          </View>
        ) : null}
        {order.deliveryDriver?.name ? (
          <View style={st.metaPill}>
            <Feather name="user" size={11} color={Colors.gold} />
            <Text style={st.metaTxt}>{order.deliveryDriver.name}</Text>
          </View>
        ) : null}
        {order.source === "online" ? (
          <View style={[st.metaPill, { backgroundColor: Colors.info + "16" }]}>
            <Feather name="globe" size={11} color={Colors.info} />
            <Text style={[st.metaTxt, { color: Colors.info }]}>{tr("أونلاين", "Online")}</Text>
          </View>
        ) : null}
        {hasOpenDriverRequest(order) ? (
          <View style={[st.metaPill, { backgroundColor: Colors.warning + "18" }]}>
            <Feather name={order.driverRequest!.type === "transfer" ? "repeat" : "life-buoy"} size={11} color={Colors.warning} />
            <Text style={[st.metaTxt, { color: Colors.warning }]}>{order.driverRequest!.type === "transfer" ? (tr("طلب تحويل", "Transfer")) : (tr("طلب دعم", "Support"))}</Text>
          </View>
        ) : null}
        {order.syncState ? (
          <View style={[st.metaPill, { backgroundColor: Colors.warning + "18" }]}>
            <Feather name="upload-cloud" size={11} color={Colors.warning} />
            <Text style={[st.metaTxt, { color: Colors.warning }]}>{tr("لم يُرسل", "Not sent")}</Text>
          </View>
        ) : null}
      </View>
      <OrderTracker order={order} compact />
      <View style={st.depts}>
        {depts.map((d) => {
          const s = order.departmentStatuses?.[d];
          const col = s === "done" ? Colors.statusDone : s === "in_progress" ? Colors.statusInProgress : Colors.border;
          return <View key={d} style={[st.deptBar, { backgroundColor: col, borderColor: DEPT_COLOR[d] }]} />;
        })}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  locked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.background },
  lockedTxt: { color: Colors.textSecondary, fontWeight: "700" },
  summary: { flexDirection: "row", gap: 8 },
  reqBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.warning + "16", borderColor: Colors.warning + "55", borderWidth: 1, borderRadius: 14, padding: 12 },
  reqBannerTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.text },
  sumCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 10, gap: 4, alignItems: "center", borderWidth: 1.5, borderColor: Colors.borderLight },
  sumNum: { fontSize: 20, fontWeight: "900" },
  sumLbl: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  controls: { backgroundColor: Colors.background, gap: 8, paddingVertical: 6 },
  searchRow: { flexDirection: "row", gap: 8 },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderLight },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.text },
  driversBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderLight },
  driversTxt: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  scopeRow: { flexDirection: "row", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 3 },
  scope: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 10 },
  scopeOn: { backgroundColor: Colors.surface },
  scopeTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  scopeTxtOn: { color: Colors.primary, fontWeight: "900" },
  filters: { gap: 8, paddingVertical: 2 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.borderLight },
  filterOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  filterTxtOn: { color: "#fff" },
  count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  countTxt: { fontSize: 11, fontWeight: "900", color: Colors.textSecondary },
  list: { gap: 10 },
  listWide: { flexDirection: "row", flexWrap: "wrap" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 40, width: "100%" },
  emptyTxt: { color: Colors.textMuted, fontWeight: "700" },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  cardWide: { width: "49%" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardNum: { fontSize: 17, fontWeight: "900", color: Colors.text },
  cardName: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.textSecondary },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  metaTxt: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  depts: { flexDirection: "row", gap: 4 },
  deptBar: { flex: 1, height: 5, borderRadius: 3, borderBottomWidth: 0 },
});
