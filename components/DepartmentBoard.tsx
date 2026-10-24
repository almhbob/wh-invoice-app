import { tr, trf } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { DeptOrderCard } from "@/components/DeptOrderCard";
import { EmptyState } from "@/components/EmptyState";
import { NewOrderBanner } from "@/components/NewOrderBanner";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { Colors } from "@/constants/colors";
import { canAccessDept } from "@/constants/rbac";
import type { TranslationKey } from "@/constants/translations";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Department, EmployeeRef, Order, OrderStatus, useOrders } from "@/context/OrdersContext";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { byDueThenNewest, DEPT_COLOR, DEPT_ICON, dueUrgency } from "@/utils/orderFlow";

type Tab = "todo" | "pending" | "in_progress" | "done";

interface Props {
  department: Department;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  deniedKey: TranslationKey;
}

const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/** Shared production board for every factory department. */
export function DepartmentBoard({ department, titleKey, subtitleKey, deniedKey }: Props) {
  const { currentEmployee } = useEmployee();
  const { getOrdersForDepartment, updateDepartmentStatus, isLoading, refreshOrders } = useOrders();
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const color = DEPT_COLOR[department];
  const [tab, setTab] = useState<Tab>("todo");
  const [showBanner, setShowBanner] = useState(false);

  const all = getOrdersForDepartment(department);
  const st = (o: Order) => o.departmentStatuses?.[department] ?? "pending";

  const groups = useMemo(() => {
    const pending = all.filter((o) => st(o) === "pending").sort(byDueThenNewest);
    const inProgress = all.filter((o) => st(o) === "in_progress").sort(byDueThenNewest);
    const done = all.filter((o) => st(o) === "done" && isToday(o.updatedAt)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { pending, in_progress: inProgress, done, todo: [...inProgress, ...pending].sort(byDueThenNewest) };
  }, [all]);

  const late = groups.todo.filter((o) => dueUrgency(o) === "overdue").length;
  useNewOrderAlert(groups.pending.length, () => setShowBanner(true));

  const handleStatus = useCallback(
    (order: Order, status: OrderStatus, receiver?: EmployeeRef) => updateDepartmentStatus(order.id, department, status, receiver),
    [department, updateDepartmentStatus]
  );

  if (currentEmployee && !canAccessDept(currentEmployee.role, department)) {
    return (
      <View style={s.locked}>
        <View style={[s.lockedIcon, { backgroundColor: color + "18" }]}><Feather name="lock" size={36} color={color} /></View>
        <Text style={s.lockedTitle}>{t("accessDeniedTitle")}</Text>
        <Text style={s.lockedSub}>{t(deniedKey)}</Text>
      </View>
    );
  }

  const TABS: { key: Tab; ar: string; en: string; n: number }[] = [
    { key: "todo", ar: "قيد العمل", en: "To do", n: groups.todo.length },
    { key: "pending", ar: "جديدة", en: "New", n: groups.pending.length },
    { key: "in_progress", ar: "أُحضّرها", en: "Preparing", n: groups.in_progress.length },
    { key: "done", ar: "أُنجزت اليوم", en: "Done today", n: groups.done.length },
  ];

  return (
    <View style={s.container}>
      <NewOrderBanner visible={showBanner} count={groups.pending.length} accentColor={color} onDismiss={() => setShowBanner(false)} />
      <FlatList
        data={groups[tab]}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[s.list, groups[tab].length === 0 && { flexGrow: 1 }]}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={[s.hero, { backgroundColor: color }]}>
              <View style={s.heroIcon}><Feather name={DEPT_ICON[department] as never} size={20} color={color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>{t(titleKey)}</Text>
                <Text style={s.heroSub}>{trf("{p0} جديدة · {p1} قيد التحضير · {p2} أُنجزت اليوم", "{p0} new · {p1} preparing · {p2} done today", { p0: groups.pending.length, p1: groups.in_progress.length, p2: groups.done.length })}</Text>
              </View>
              {late > 0 && (
                <View style={s.late}><Feather name="alert-circle" size={13} color="#fff" /><Text style={s.lateTxt}>{late} {tr("متأخر", "late")}</Text></View>
              )}
            </View>
            <SyncStatusBanner />
            <View style={s.tabs}>
              {TABS.map((x) => (
                <Pressable key={x.key} style={[s.tab, tab === x.key && { backgroundColor: Colors.surface }]} onPress={() => setTab(x.key)}>
                  <Text style={[s.tabTxt, tab === x.key && { color: Colors.text, fontWeight: "900" }]} numberOfLines={1}>{tr(x.ar, x.en)}</Text>
                  {x.n > 0 && <View style={[s.badge, { backgroundColor: tab === x.key ? color : Colors.border }]}><Text style={s.badgeTxt}>{x.n}</Text></View>}
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <DeptOrderCard order={item} department={department} onStatusChange={(status, receiver) => handleStatus(item, status, receiver)} />
        )}
        ListEmptyComponent={<EmptyState icon={DEPT_ICON[department] as never} title={t("noOrdersNow")} subtitle={t(subtitleKey)} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshOrders} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 120 },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 14 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 19, fontWeight: "900", color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "600" },
  late: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  lateTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  tabs: { flexDirection: "row", backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 11, paddingVertical: 9 },
  tabTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },
  locked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, backgroundColor: Colors.background },
  lockedIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  lockedSub: { fontSize: 14, color: Colors.textMuted, textAlign: "center" },
});
