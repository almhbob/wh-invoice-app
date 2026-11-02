import { tr, trf } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { StageBadge } from "@/components/OrderTracker";
import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { DriverRequestType, Order, useOrders, useOrderHistory } from "@/context/OrdersContext";
import {
  byDueThenNewest,
  callPhone,
  driverStats,
  dueLabel,
  dueUrgency,
  isProductionDone,
  openMaps,
  openWhatsApp,
  orderStage,
  remainingAmount,
  SUPPORT_REASONS,
  TRANSFER_REASONS,
  URGENCY_COLOR,
} from "@/utils/orderFlow";

type Tab = "active" | "done";

/** The driver's own workspace: only deliveries assigned to the signed-in driver. */
export default function DriverScreen() {
  const { orders, isLoading, refreshOrders } = useOrders();
  useOrderHistory(366);
  const { currentEmployee } = useEmployee();
  const { lang } = useLang();
  const ar = lang === "ar";
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("active");

  const me = currentEmployee?.employeeId ?? "";
  const mine = useMemo(() => orders.filter((o) => o.deliveryDriver?.employeeId === me), [orders, me]);
  const active = useMemo(() => mine.filter((o) => o.deliveryStatus !== "delivered").sort(byDueThenNewest), [mine]);
  const doneToday = useMemo(
    () => mine.filter((o) => o.deliveryStatus === "delivered" && new Date(o.deliveryDeliveredAt ?? o.updatedAt).toDateString() === new Date().toDateString())
      .sort((a, b) => (b.deliveryDeliveredAt ?? "").localeCompare(a.deliveryDeliveredAt ?? "")),
    [mine]
  );
  const stats = useMemo(() => driverStats(orders, me), [orders, me]);
  const toCollect = active.reduce((s, o) => s + remainingAmount(o), 0);

  if (!currentEmployee) return null;
  if (currentEmployee.role !== "driver" && currentEmployee.role !== "admin" && currentEmployee.role !== "branch_supervisor") {
    return (
      <View style={st.locked}><Feather name="lock" size={30} color={Colors.accent} /><Text style={st.lockedTxt}>{tr("هذه الشاشة لسائقي التوصيل", "For delivery drivers")}</Text></View>
    );
  }

  const list = tab === "active" ? active : doneToday;

  return (
    <View style={st.screen}>
      <ScrollView
        contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshOrders} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.hero}>
          <View style={st.heroTop}>
            <View style={st.heroIcon}><Feather name="truck" size={20} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.heroTitle}>{trf("أهلاً {p0}", "Hi {p0}", { p0: currentEmployee.name.split(" ")[0] })}</Text>
              <Text style={st.heroSub}>{trf("{p0} طلب بانتظارك", "{p0} deliveries waiting", { p0: active.length })}{toCollect > 0 ? (trf(" · للتحصيل {p0} ر.س", " · collect {p0} SAR", { p0: toCollect.toFixed(0) })) : ""}</Text>
            </View>
          </View>
          <View style={st.statsRow}>
            {([[tr("اليوم", "Today"), stats.today], [tr("هذا الشهر", "This month"), stats.month], [tr("هذه السنة", "This year"), stats.year]] as const).map(([l, v]) => (
              <View key={l} style={st.stat}>
                <Text style={st.statNum}>{v.assigned}</Text>
                <Text style={st.statLbl}>{l}</Text>
                <Text style={st.statSub}>{trf("سُلّم {p0}", "{p0} delivered", { p0: v.delivered })}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={st.tabs}>
          {([["active", tr("طلباتي الحالية", "Current"), active.length], ["done", tr("سلّمتها اليوم", "Delivered today"), doneToday.length]] as const).map(([k, l, n]) => (
            <Pressable key={k} style={[st.tab, tab === k && { backgroundColor: Colors.surface }]} onPress={() => setTab(k)}>
              <Text style={[st.tabTxt, tab === k && { color: Colors.text, fontWeight: "900" }]}>{l}</Text>
              {n > 0 && <View style={[st.badge, tab === k && { backgroundColor: Colors.primary }]}><Text style={st.badgeTxt}>{n}</Text></View>}
            </Pressable>
          ))}
        </View>

        {list.length === 0 ? (
          <EmptyState icon="truck" title={tab === "active" ? (tr("لا توجد طلبات مسندة إليك", "No deliveries assigned")) : (tr("لم تُسلّم طلبات اليوم بعد", "Nothing delivered yet today"))} subtitle={tr("ستظهر هنا الطلبات التي يسندها لك الفرع", "Orders assigned to you appear here")} />
        ) : (
          list.map((o) => <DriverCard key={o.id} order={o} />)
        )}
      </ScrollView>
    </View>
  );
}

function DriverCard({ order }: { order: Order }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const { currentEmployee } = useEmployee();
  const { dispatchOrder, markDelivered, markDeliveryFailed, raiseDriverRequest } = useOrders();
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "support" | "transfer" | "failed" | "delivered">(null);
  const by = { name: currentEmployee!.name, employeeId: currentEmployee!.employeeId };
  const stage = orderStage(order);
  const ready = isProductionDone(order);
  const urg = dueUrgency(order);
  const due = dueLabel(order, lang);
  const remaining = remainingAmount(order);
  const req = order.driverRequest;
  const delivered = order.deliveryStatus === "delivered";
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);

  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* surfaced by context */ } finally { setBusy(null); }
  };

  const pickUp = () => {
    const go = () => void run("dispatch", () => dispatchOrder(order.id, by));
    if (ready) return go();
    Alert.alert(tr("الطلب لم يجهز بعد", "Not ready yet"), tr("الأقسام لم تُنهِ الطلب. هل استلمته فعلاً؟", "Production not finished. Did you actually pick it up?"), [
      { text: tr("لا", "No"), style: "cancel" },
      { text: tr("نعم، استلمته", "Yes, picked up"), onPress: go },
    ]);
  };

  const notifyCustomer = () =>
    openWhatsApp(order.customerPhone, `مرحباً ${order.customerName}، أنا ${by.name} مندوب التوصيل لطلبك #${order.orderNumber}. أنا في الطريق إليك 🚚`);

  return (
    <View style={[st.card, urg === "overdue" && !delivered && { borderColor: Colors.statusCancelled + "80" }]}>
      <View style={st.cardHead}>
        <Text style={st.num}>#{order.orderNumber}</Text>
        <StageBadge order={order} size="sm" />
        <View style={{ flex: 1 }} />
        {order.deliveryTime ? (
          <View style={[st.due, { backgroundColor: URGENCY_COLOR[urg] + "14" }]}>
            <Feather name="clock" size={12} color={URGENCY_COLOR[urg]} />
            <Text style={[st.dueTxt, { color: URGENCY_COLOR[urg] }]}>{order.deliveryTime.slice(-5)}{due ? ` · ${due}` : ""}</Text>
          </View>
        ) : null}
      </View>

      <View style={st.custRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.cust}>{order.customerName}</Text>
          <Text style={st.phone}>{order.customerPhone}{order.customerPhone2 ? ` · ${order.customerPhone2}` : ""}</Text>
        </View>
        <Pressable style={[st.round, { backgroundColor: Colors.success + "18" }]} onPress={() => callPhone(order.customerPhone)}><Feather name="phone" size={18} color={Colors.success} /></Pressable>
        <Pressable style={[st.round, { backgroundColor: "#25D36618" }]} onPress={notifyCustomer}><Feather name="message-circle" size={18} color="#1DA851" /></Pressable>
      </View>

      {order.deliveryAddress ? (
        <Pressable style={st.address} onPress={() => openMaps(order.deliveryAddress!)}>
          <Feather name="map-pin" size={16} color={Colors.primary} />
          <Text style={st.addressTxt}>{order.deliveryAddress}</Text>
          <View style={st.mapBtn}><Feather name="navigation" size={12} color="#fff" /><Text style={st.mapTxt}>{tr("الخريطة", "Map")}</Text></View>
        </Pressable>
      ) : null}

      <View style={st.metaRow}>
        <View style={st.meta}><Feather name="package" size={12} color={Colors.textSecondary} /><Text style={st.metaTxt}>{pieces} {tr("قطعة", "pcs")}</Text></View>
        <View style={[st.meta, { backgroundColor: remaining > 0 ? Colors.accent + "14" : Colors.success + "14" }]}>
          <Feather name="dollar-sign" size={12} color={remaining > 0 ? Colors.accent : Colors.success} />
          <Text style={[st.metaTxt, { color: remaining > 0 ? Colors.accent : Colors.success }]}>{remaining > 0 ? (trf("حصّل {p0} ر.س", "Collect {p0}", { p0: remaining.toFixed(2) })) : (tr("مدفوع", "Paid"))}</Text>
        </View>
        {order.insuranceAmount ? <View style={st.meta}><Feather name="shield" size={12} color={Colors.gold} /><Text style={st.metaTxt}>{tr("صواني بتأمين", "Trays w/ deposit")}</Text></View> : null}
        {!ready && !delivered ? <View style={[st.meta, { backgroundColor: Colors.warning + "16" }]}><Feather name="loader" size={12} color={Colors.warning} /><Text style={[st.metaTxt, { color: Colors.warning }]}>{tr("قيد التحضير", "Preparing")}</Text></View> : null}
      </View>

      <View style={st.items}>
        {order.items.map((i) => <Text key={i.id} style={st.item}>• {i.name} × {i.quantity}</Text>)}
      </View>
      {order.notes ? <Text style={st.notes}>📝 {order.notes}</Text> : null}

      {req ? (
        <View style={[st.req, req.status === "open" ? { backgroundColor: Colors.warning + "14" } : { backgroundColor: Colors.success + "12" }]}>
          <Feather name={req.type === "transfer" ? "repeat" : "life-buoy"} size={14} color={req.status === "open" ? Colors.warning : Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={st.reqTitle}>
              {req.type === "transfer" ? (tr("طلب تحويل", "Transfer request")) : (tr("طلب دعم", "Support request"))} · {req.status === "open" ? (tr("بانتظار الفرع", "Waiting for branch")) : (tr("تمت المعالجة", "Resolved"))}
            </Text>
            <Text style={st.reqTxt}>{tr(req.reason)}{req.note ? ` — ${req.note}` : ""}</Text>
            {req.response ? <Text style={st.reqTxt}>↩ {req.response}</Text> : null}
          </View>
        </View>
      ) : null}

      {!delivered && (
        <>
          {stage !== "out_for_delivery" ? (
            <Pressable style={[st.primary, busy === "dispatch" && { opacity: 0.6 }]} onPress={pickUp} disabled={!!busy}>
              {busy === "dispatch" ? <ActivityIndicator color="#fff" /> : <Feather name="truck" size={18} color={Colors.goldLight} />}
              <Text style={st.primaryTxt}>{tr("استلمت الطلب وخرجت للتوصيل", "Picked up — on my way")}</Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={[st.primary, { flex: 2, backgroundColor: Colors.statusDone }]} onPress={() => setSheet("delivered")} disabled={!!busy}>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={st.primaryTxt}>{tr("تم التسليم", "Delivered")}</Text>
              </Pressable>
              <Pressable style={[st.primary, { flex: 1, backgroundColor: Colors.statusCancelled + "16" }]} onPress={() => setSheet("failed")} disabled={!!busy}>
                <Text style={[st.primaryTxt, { color: Colors.statusCancelled }]}>{tr("تعذّر", "Failed")}</Text>
              </Pressable>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={st.secondary} onPress={() => setSheet("support")}>
              <Feather name="life-buoy" size={15} color={Colors.primary} />
              <Text style={st.secondaryTxt}>{tr("طلب دعم", "Ask for support")}</Text>
            </Pressable>
            <Pressable style={st.secondary} onPress={() => setSheet("transfer")}>
              <Feather name="repeat" size={15} color={Colors.primary} />
              <Text style={st.secondaryTxt}>{tr("تحويل لمندوب آخر", "Transfer to another driver")}</Text>
            </Pressable>
          </View>
        </>
      )}

      <ReasonSheet
        visible={sheet !== null}
        mode={sheet}
        onClose={() => setSheet(null)}
        onSubmit={async (reason, note) => {
          const s = sheet;
          setSheet(null);
          if (s === "delivered") return run("delivered", () => markDelivered(order.id, by, note || undefined));
          if (s === "failed") return run("failed", () => markDeliveryFailed(order.id, [reason, note].filter(Boolean).join(" — "), by));
          if (s === "support" || s === "transfer") return run("req", () => raiseDriverRequest(order.id, s as DriverRequestType, reason, note, by));
        }}
      />
    </View>
  );
}

function ReasonSheet({ visible, mode, onClose, onSubmit }: { visible: boolean; mode: null | "support" | "transfer" | "failed" | "delivered"; onClose: () => void; onSubmit: (reason: string, note?: string) => void }) {
  const { lang, isRTL } = useLang();
  const ar = lang === "ar";
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  React.useEffect(() => { if (visible) { setReason(""); setNote(""); } }, [visible]);
  if (!mode) return null;
  const reasons = mode === "transfer" ? TRANSFER_REASONS : mode === "delivered" ? [] : SUPPORT_REASONS;
  const title = {
    support: tr("طلب دعم من الفرع", "Ask the branch for support"),
    transfer: tr("طلب تحويل الطلب لمندوب آخر", "Ask to transfer this delivery"),
    failed: tr("تعذّر التسليم", "Delivery failed"),
    delivered: tr("تأكيد التسليم", "Confirm delivery"),
  }[mode];
  const needReason = mode !== "delivered";
  const canSend = !needReason || (reason && (reason !== "أخرى" || note.trim()));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>{title}</Text>
          {needReason && (
            <>
              <Text style={st.sheetLbl}>{tr("السبب", "Reason")}</Text>
              <View style={st.chips}>
                {reasons.map((r) => (
                  <Pressable key={r} style={[st.chip, reason === r && st.chipOn]} onPress={() => setReason(r)}>
                    <Text style={[st.chipTxt, reason === r && { color: "#fff" }]}>{tr(r)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <TextInput
            style={[st.input, { textAlign: isRTL ? "right" : "left" }]}
            value={note}
            onChangeText={setNote}
            placeholder={mode === "delivered" ? (tr("اسم المستلم (اختياري)", "Received by (optional)")) : (tr("توضيح إضافي…", "Details…"))}
            placeholderTextColor={Colors.textMuted}
            multiline={mode !== "delivered"}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={[st.secondary, { flex: 1 }]} onPress={onClose}><Text style={st.secondaryTxt}>{tr("إلغاء", "Cancel")}</Text></Pressable>
            <Pressable style={[st.primary, { flex: 2 }, !canSend && { opacity: 0.5 }]} disabled={!canSend} onPress={() => onSubmit(reason, note.trim() || undefined)}>
              <Text style={st.primaryTxt}>{mode === "delivered" ? (tr("تأكيد", "Confirm")) : (tr("إرسال", "Send"))}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  locked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.background },
  lockedTxt: { color: Colors.textSecondary, fontWeight: "700" },
  hero: { backgroundColor: Colors.primary, borderRadius: 22, padding: 16, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.goldLight, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, paddingVertical: 10 },
  statNum: { color: Colors.goldLight, fontSize: 22, fontWeight: "900" },
  statLbl: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
  statSub: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 11, paddingVertical: 9 },
  tabTxt: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  num: { fontSize: 19, fontWeight: "900", color: Colors.text },
  due: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  dueTxt: { fontSize: 12, fontWeight: "800" },
  custRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cust: { fontSize: 16, fontWeight: "900", color: Colors.text },
  phone: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  address: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 10 },
  addressTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.text },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  mapTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  metaTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  items: { gap: 2 },
  item: { fontSize: 13, color: Colors.text },
  notes: { fontSize: 12, color: Colors.textSecondary, backgroundColor: Colors.gold + "12", borderRadius: 10, padding: 8 },
  req: { flexDirection: "row", gap: 8, borderRadius: 12, padding: 10, alignItems: "flex-start" },
  reqTitle: { fontSize: 12, fontWeight: "800", color: Colors.text },
  reqTxt: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14 },
  primaryTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingVertical: 11 },
  secondaryTxt: { color: Colors.primary, fontSize: 12, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "900", color: Colors.text },
  sheetLbl: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "700", color: Colors.text },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.text, minHeight: 48 },
});
