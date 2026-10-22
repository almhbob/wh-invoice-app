import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { WritingBlock } from "@/components/WritingBlock";
import { Colors } from "@/constants/colors";
import { canAccessDept } from "@/constants/rbac";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Order, OrderStatus, useOrders } from "@/context/OrdersContext";
import { byDueThenNewest, dueLabel, dueUrgency, URGENCY_COLOR, writingItems } from "@/utils/orderFlow";

type Tab = "todo" | "done";

const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/** The calligrapher's workspace: every phrase to write, what to write it on, and by when. */
export default function WritingScreen() {
  const { orders, updateWritingStatus, isLoading, refreshOrders } = useOrders();
  const { currentEmployee } = useEmployee();
  const { lang } = useLang();
  const ar = lang === "ar";
  const [tab, setTab] = useState<Tab>("todo");

  const withWriting = useMemo(() => orders.filter((o) => writingItems(o).length > 0), [orders]);
  const todo = useMemo(() => withWriting.filter((o) => (o.writingStatus ?? "pending") !== "done").sort(byDueThenNewest), [withWriting]);
  const done = useMemo(() => withWriting.filter((o) => o.writingStatus === "done" && isToday(o.updatedAt)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [withWriting]);
  const late = todo.filter((o) => dueUrgency(o) === "overdue").length;

  if (currentEmployee && !canAccessDept(currentEmployee.role, "writing")) {
    return (
      <View style={st.locked}>
        <Feather name="lock" size={32} color={Colors.purple} />
        <Text style={st.lockedTxt}>{ar ? "هذه المساحة للخطاط وقسم الكيك" : "For the calligrapher and cake team"}</Text>
      </View>
    );
  }

  const data = tab === "todo" ? todo : done;

  return (
    <View style={st.screen}>
      <FlatList
        data={data}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[st.list, data.length === 0 && { flexGrow: 1 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshOrders} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={st.hero}>
              <View style={st.heroIcon}><Feather name="edit-3" size={20} color={Colors.purple} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.heroTitle}>{ar ? "مساحة الخطاط" : "Calligraphy"}</Text>
                <Text style={st.heroSub}>{ar ? `${todo.length} عبارة للكتابة · ${done.length} أُنجزت اليوم` : `${todo.length} to write · ${done.length} done today`}</Text>
              </View>
              {late > 0 && <View style={st.late}><Text style={st.lateTxt}>{late} {ar ? "متأخر" : "late"}</Text></View>}
            </View>
            <SyncStatusBanner />
            <View style={st.tabs}>
              {([["todo", ar ? "للكتابة" : "To write", todo.length], ["done", ar ? "أُنجزت اليوم" : "Done today", done.length]] as const).map(([k, l, n]) => (
                <Pressable key={k} style={[st.tab, tab === k && { backgroundColor: Colors.surface }]} onPress={() => setTab(k)}>
                  <Text style={[st.tabTxt, tab === k && { color: Colors.text, fontWeight: "900" }]}>{l}</Text>
                  {n > 0 && <View style={[st.badge, tab === k && { backgroundColor: Colors.purple }]}><Text style={st.badgeTxt}>{n}</Text></View>}
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <WritingCard
            order={item}
            onAdvance={(status) => updateWritingStatus(item.id, status, currentEmployee ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId, timestamp: new Date().toISOString() } : undefined)}
          />
        )}
        ListEmptyComponent={<EmptyState icon="edit-3" title={ar ? "لا توجد عبارات الآن" : "Nothing to write"} subtitle={ar ? "ستظهر هنا العبارات التي يضيفها الكاشير للكيك" : "Phrases added by the cashier appear here"} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function WritingCard({ order, onAdvance }: { order: Order; onAdvance: (s: OrderStatus) => Promise<void> }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const [busy, setBusy] = useState(false);
  const status = order.writingStatus ?? "pending";
  const urg = dueUrgency(order);
  const due = dueLabel(order, lang);
  const items = writingItems(order);
  const cakeStatus = order.departmentStatuses?.cake;

  const copy = async (text: string) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        Alert.alert(ar ? "تم النسخ" : "Copied", text);
      }
    } catch { /* clipboard unavailable */ }
  };

  const go = async () => {
    const next: OrderStatus = status === "pending" ? "in_progress" : "done";
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { await onAdvance(next); } catch { /* surfaced by context */ } finally { setBusy(false); }
  };

  return (
    <View style={[st.card, urg === "overdue" && status !== "done" && { borderColor: Colors.statusCancelled + "80" }]}>
      <View style={st.cardHead}>
        <Text style={st.num}>#{order.orderNumber}</Text>
        <Text style={st.cust} numberOfLines={1}>{order.customerName}</Text>
        {order.deliveryTime ? (
          <View style={[st.due, { backgroundColor: URGENCY_COLOR[urg] + "14" }]}>
            <Feather name="clock" size={12} color={URGENCY_COLOR[urg]} />
            <Text style={[st.dueTxt, { color: URGENCY_COLOR[urg] }]}>{order.deliveryTime.slice(-5)}{due && status !== "done" ? ` · ${due}` : ""}</Text>
          </View>
        ) : null}
      </View>

      {items.map((it) => (
        <View key={it.id} style={{ gap: 4 }}>
          <Text style={st.itemName}>{it.quantity}× {it.name}</Text>
          <WritingBlock item={it} big />
          {Platform.OS === "web" && (
            <Pressable style={st.copy} onPress={() => void copy(it.writing!.text)}>
              <Feather name="copy" size={12} color={Colors.textSecondary} />
              <Text style={st.copyTxt}>{ar ? "نسخ العبارة (للطباعة)" : "Copy phrase (for printing)"}</Text>
            </Pressable>
          )}
        </View>
      ))}

      {cakeStatus && (
        <Text style={st.cake}>
          <Feather name="layers" size={11} color={Colors.cake} /> {ar ? "حالة الكيك:" : "Cake:"} {cakeStatus === "done" ? (ar ? "جاهز" : "ready") : cakeStatus === "in_progress" ? (ar ? "قيد التحضير" : "in progress") : (ar ? "لم يبدأ" : "not started")}
        </Text>
      )}

      {status !== "done" ? (
        <Pressable style={[st.action, { backgroundColor: status === "pending" ? Colors.purple : Colors.statusDone }, busy && { opacity: 0.6 }]} onPress={() => void go()} disabled={busy}>
          <Feather name={status === "pending" ? "play" : "check"} size={18} color="#fff" />
          <Text style={st.actionTxt}>{status === "pending" ? (ar ? "بدء الكتابة" : "Start writing") : (ar ? "تمت الكتابة" : "Writing done")}</Text>
        </Pressable>
      ) : (
        <View style={st.doneBox}>
          <Feather name="check-circle" size={16} color={Colors.statusDone} />
          <Text style={st.doneTxt}>{ar ? "أُنجزت" : "Done"}{order.writingBy?.name ? ` · ${order.writingBy.name}` : ""}</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 120 },
  locked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.background },
  lockedTxt: { color: Colors.textSecondary, fontWeight: "700" },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 14, backgroundColor: Colors.purple },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 19, fontWeight: "900", color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "600" },
  late: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  lateTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  tabs: { flexDirection: "row", backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 11, paddingVertical: 9 },
  tabTxt: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  num: { fontSize: 19, fontWeight: "900", color: Colors.text },
  cust: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: "700" },
  due: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  dueTxt: { fontSize: 12, fontWeight: "800" },
  itemName: { fontSize: 13, fontWeight: "800", color: Colors.textSecondary },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  copyTxt: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" },
  cake: { fontSize: 12, color: Colors.textMuted },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  actionTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
  doneBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 12, backgroundColor: Colors.statusDone + "12" },
  doneTxt: { color: Colors.statusDone, fontWeight: "800" },
});
