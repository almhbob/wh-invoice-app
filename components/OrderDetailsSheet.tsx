import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DriversModal } from "@/components/DriversModal";
import { OrderTracker, StageBadge } from "@/components/OrderTracker";
import { Colors } from "@/constants/colors";
import { canDo, ROLE_CAN_VIEW_DELIVERY } from "@/constants/rbac";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { Department, Order, PAYMENT_LABEL_KEYS, useOrders } from "@/context/OrdersContext";
import type { Driver } from "@/hooks/useDrivers";
import {
  callPhone,
  customerTrackingMessage,
  DEPT_COLOR,
  DEPT_ICON,
  driverDispatchMessage,
  dueLabel,
  dueUrgency,
  EVENT_META,
  isOrderOpen,
  isProductionDone,
  openMaps,
  openWhatsApp,
  orderDepartments,
  orderStage,
  orderTimeline,
  remainingAmount,
  URGENCY_COLOR,
} from "@/utils/orderFlow";

const DEPT_KEY: Record<Department, "deptHalwaShort" | "deptMawaliShort" | "deptChocolateShort" | "deptCakeShort" | "deptPackagingShort"> = {
  halwa: "deptHalwaShort",
  mawali: "deptMawaliShort",
  chocolate: "deptChocolateShort",
  cake: "deptCakeShort",
  packaging: "deptPackagingShort",
};

const STATUS_TXT = {
  pending: { ar: "بانتظار البدء", en: "Waiting", color: Colors.statusPending },
  in_progress: { ar: "قيد التحضير", en: "Preparing", color: Colors.statusInProgress },
  done: { ar: "منجز", en: "Done", color: Colors.statusDone },
  cancelled: { ar: "ملغي", en: "Cancelled", color: Colors.statusCancelled },
} as const;

function fmtTime(iso: string, lang: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

export function OrderDetailsSheet({ orderId, visible, onClose }: { orderId: string | null; visible: boolean; onClose: () => void }) {
  const { orders, assignDeliveryDriver, dispatchOrder, markDelivered, markDeliveryFailed, markPickedUp, ensureTrackingCode } = useOrders();
  const { currentEmployee } = useEmployee();
  const { company } = useCompany();
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const [pickDriver, setPickDriver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);

  const order = useMemo(() => orders.find((o) => o.id === orderId) ?? null, [orders, orderId]);
  if (!order) return null;

  const by = currentEmployee ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId } : undefined;
  const canFulfil = canDo(currentEmployee?.role, ROLE_CAN_VIEW_DELIVERY);
  const stage = orderStage(order);
  const ready = isProductionDone(order);
  const isDelivery = order.orderType === "delivery";
  const due = dueLabel(order, lang);
  const urg = dueUrgency(order);
  const remaining = remainingAmount(order);
  const brand = company.name || "Laviviane";
  const openDriverLoad: Record<string, number> = {};
  orders.forEach((o) => {
    if (o.deliveryDriver?.employeeId && isOrderOpen(o)) openDriverLoad[o.deliveryDriver.employeeId] = (openDriverLoad[o.deliveryDriver.employeeId] ?? 0) + 1;
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch { /* error already surfaced */ } finally { setBusy(null); }
  };

  const confirmIfNotReady = (action: () => void) => {
    if (ready) return action();
    Alert.alert(
      ar ? "التحضير لم يكتمل" : "Not ready yet",
      ar ? "بعض الأقسام لم تُنهِ هذا الطلب بعد. هل تريد المتابعة؟" : "Some departments have not finished this order. Continue anyway?",
      [{ text: ar ? "إلغاء" : "Cancel", style: "cancel" }, { text: ar ? "متابعة" : "Continue", onPress: action }]
    );
  };

  const shareTracking = async () => {
    const code = await ensureTrackingCode(order.id);
    openWhatsApp(order.customerPhone, customerTrackingMessage({ ...order, trackingCode: code ?? order.trackingCode }, brand));
  };

  const onPickDriver = (d: Driver) => {
    setPickDriver(false);
    void run("driver", () => assignDeliveryDriver(order.id, { name: d.name, employeeId: d.id, phone: d.phone }, by));
  };

  const sendToDriver = () => {
    const phone = order.deliveryDriver?.phone;
    if (!phone) { Alert.alert(ar ? "لا يوجد رقم" : "No phone", ar ? "أضف رقم جوال السائق من إدارة السائقين." : "Add the driver's phone in Manage drivers."); return; }
    openWhatsApp(phone, driverDispatchMessage(order, brand));
  };

  const timeline = orderTimeline(order);
  const depts = orderDepartments(order);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.handle} />

          {/* Header */}
          <View style={st.head}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={st.headRow}>
                <Text style={st.num}>#{order.orderNumber}</Text>
                <StageBadge order={order} />
                {order.syncState && (
                  <View style={st.syncPill}><Feather name="upload-cloud" size={11} color={Colors.warning} /><Text style={st.syncTxt}>{ar ? "لم يُرسل بعد" : "Not sent yet"}</Text></View>
                )}
              </View>
              <Text style={st.customer} numberOfLines={1}>{order.customerName}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={st.close}><Feather name="x" size={20} color={Colors.textSecondary} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Progress */}
            <View style={st.card}>
              <OrderTracker order={order} />
              <View style={st.metaRow}>
                <View style={st.meta}>
                  <Feather name={isDelivery ? "truck" : "shopping-bag"} size={13} color={Colors.textSecondary} />
                  <Text style={st.metaTxt}>{isDelivery ? (ar ? "توصيل" : "Delivery") : (ar ? "استلام من الفرع" : "Pickup")}</Text>
                </View>
                {order.deliveryTime ? (
                  <View style={[st.meta, { backgroundColor: URGENCY_COLOR[urg] + "14" }]}>
                    <Feather name="clock" size={13} color={URGENCY_COLOR[urg]} />
                    <Text style={[st.metaTxt, { color: URGENCY_COLOR[urg] }]}>{order.deliveryTime}{due ? ` · ${due}` : ""}</Text>
                  </View>
                ) : null}
              </View>
              {stage === "delivery_failed" && order.deliveryFailedReason ? (
                <View style={st.alert}><Feather name="alert-triangle" size={14} color={Colors.statusCancelled} /><Text style={st.alertTxt}>{order.deliveryFailedReason}</Text></View>
              ) : null}
            </View>

            {/* Fulfilment actions */}
            {canFulfil && isOrderOpen(order) && (
              <View style={st.card}>
                <Text style={st.cardTitle}>{ar ? "الإجراء التالي" : "Next step"}</Text>
                {!isDelivery && (
                  <ActionBtn
                    icon="shopping-bag" primary loading={busy === "pickup"}
                    label={ar ? "تسليم الطلب للعميل" : "Hand over to customer"}
                    hint={ready ? undefined : (ar ? "التحضير لم يكتمل بعد" : "Production not finished")}
                    onPress={() => confirmIfNotReady(() => void run("pickup", () => markPickedUp(order.id, by)))}
                  />
                )}
                {isDelivery && (
                  <>
                    <ActionBtn
                      icon="user-check" loading={busy === "driver"}
                      label={order.deliveryDriver?.name ? `${ar ? "السائق:" : "Driver:"} ${order.deliveryDriver.name}` : (ar ? "تعيين سائق" : "Assign driver")}
                      hint={order.deliveryDriver?.name ? (ar ? "اضغط للتغيير" : "Tap to change") : undefined}
                      primary={!order.deliveryDriver?.name}
                      onPress={() => setPickDriver(true)}
                    />
                    {order.deliveryDriver?.name && stage !== "out_for_delivery" && (
                      <ActionBtn
                        icon="truck" primary loading={busy === "dispatch"}
                        label={ar ? "خرج للتوصيل" : "Out for delivery"}
                        hint={ar ? "سيُرسل للسائق تفاصيل الطلب عبر واتساب" : "Driver gets the details on WhatsApp"}
                        onPress={() => confirmIfNotReady(() => void run("dispatch", async () => { await dispatchOrder(order.id, by); sendToDriver(); }))}
                      />
                    )}
                    {stage === "out_for_delivery" && (
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <ActionBtn icon="check-circle" primary loading={busy === "delivered"} label={ar ? "تم التسليم" : "Delivered"} onPress={() => void run("delivered", () => markDelivered(order.id, by))} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ActionBtn icon="alert-triangle" danger label={ar ? "تعذّر التسليم" : "Failed"} onPress={() => setFailReason("")} />
                        </View>
                      </View>
                    )}
                    {failReason !== null && (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          style={st.input} value={failReason} onChangeText={setFailReason}
                          placeholder={ar ? "السبب: العميل لا يرد، العنوان غير صحيح…" : "Reason: no answer, wrong address…"}
                          placeholderTextColor={Colors.textMuted}
                        />
                        <ActionBtn icon="save" danger loading={busy === "fail"} label={ar ? "حفظ وإرجاع للفرع" : "Save & return to branch"}
                          onPress={() => void run("fail", async () => { await markDeliveryFailed(order.id, failReason.trim() || (ar ? "بدون سبب" : "No reason"), by); setFailReason(null); })} />
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Contact */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{ar ? "العميل" : "Customer"}</Text>
              <Text style={st.line}>{order.customerPhone}{order.customerPhone2 ? ` · ${order.customerPhone2}` : ""}</Text>
              {isDelivery && order.deliveryAddress ? <Text style={st.line}>📍 {order.deliveryAddress}</Text> : null}
              <View style={st.chips}>
                <Chip icon="phone" label={ar ? "اتصال" : "Call"} onPress={() => callPhone(order.customerPhone)} />
                <Chip icon="send" label={ar ? "رابط التتبع واتساب" : "Send tracking"} onPress={() => void shareTracking()} />
                {isDelivery && order.deliveryAddress ? <Chip icon="map-pin" label={ar ? "الخريطة" : "Map"} onPress={() => openMaps(order.deliveryAddress!)} /> : null}
                {order.deliveryDriver?.phone ? <Chip icon="message-circle" label={ar ? "مراسلة السائق" : "Message driver"} onPress={sendToDriver} /> : null}
              </View>
            </View>

            {/* Departments */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{ar ? "الأقسام والأصناف" : "Departments & items"}</Text>
              {depts.map((d) => {
                const status = order.departmentStatuses?.[d] ?? "pending";
                const meta = STATUS_TXT[status];
                const items = order.items.filter((i) => i.department === d);
                const rec = order.departmentReceivers?.[d];
                return (
                  <View key={d} style={st.dept}>
                    <View style={st.deptHead}>
                      <View style={[st.deptIcon, { backgroundColor: DEPT_COLOR[d] + "18" }]}>
                        <Feather name={DEPT_ICON[d] as never} size={14} color={DEPT_COLOR[d]} />
                      </View>
                      <Text style={st.deptName}>{t(DEPT_KEY[d])}</Text>
                      <View style={[st.statusPill, { backgroundColor: meta.color + "16" }]}>
                        <View style={[st.statusDot, { backgroundColor: meta.color }]} />
                        <Text style={[st.statusTxt, { color: meta.color }]}>{ar ? meta.ar : meta.en}</Text>
                      </View>
                    </View>
                    {rec ? <Text style={st.deptBy}>{ar ? "استلمه:" : "Taken by:"} {rec.name}</Text> : null}
                    {items.map((i) => (
                      <View key={i.id} style={st.item}>
                        <Text style={st.itemQty}>{i.quantity}×</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={st.itemName}>{i.name}</Text>
                          {i.note ? <Text style={st.itemNote}>{i.note}</Text> : null}
                          {i.details ? <Text style={st.itemNote}>{i.details}</Text> : null}
                        </View>
                        {i.price ? <Text style={st.itemPrice}>{(i.price * i.quantity).toFixed(2)}</Text> : null}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            {/* Notes & images */}
            {(order.notes || order.imageUri || order.referenceImages?.length) ? (
              <View style={st.card}>
                {order.notes ? (<><Text style={st.cardTitle}>{ar ? "ملاحظات" : "Notes"}</Text><Text style={st.notes}>{order.notes}</Text></>) : null}
                {(order.imageUri || order.referenceImages?.length) ? (
                  <View style={st.imgs}>
                    {[order.imageUri, ...(order.referenceImages ?? [])].filter(Boolean).map((u, i) => (
                      <Image key={i} source={{ uri: u! }} style={st.img} contentFit="cover" />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Payment */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{ar ? "الحساب" : "Payment"}</Text>
              {order.totalAmount ? <Row label={ar ? "الإجمالي" : "Total"} value={`${order.totalAmount.toFixed(2)} ${t("sar")}`} bold /> : null}
              {order.paymentMethod ? <Row label={ar ? "طريقة الدفع" : "Method"} value={t(PAYMENT_LABEL_KEYS[order.paymentMethod])} /> : null}
              {order.amountPaid != null ? <Row label={ar ? "المدفوع" : "Paid"} value={`${order.amountPaid.toFixed(2)} ${t("sar")}`} /> : null}
              <Row
                label={remaining > 0 ? (ar ? "المتبقي للتحصيل" : "To collect") : (ar ? "الحالة" : "Status")}
                value={remaining > 0 ? `${remaining.toFixed(2)} ${t("sar")}` : (ar ? "مدفوع بالكامل ✓" : "Fully paid ✓")}
                color={remaining > 0 ? Colors.accent : Colors.success}
              />
              {order.insuranceAmount ? <Row label={ar ? "تأمين الصواني" : "Tray deposit"} value={`${order.insuranceAmount} ${t("sar")}${order.trayReturned ? (ar ? " · أُعيدت" : " · returned") : ""}`} /> : null}
            </View>

            {/* Timeline */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{ar ? "سجل الطلب" : "Timeline"}</Text>
              {timeline.map((e, i) => {
                const meta = EVENT_META[e.type];
                return (
                  <View key={`${e.type}-${e.at}-${i}`} style={st.tl}>
                    <View style={st.tlRail}>
                      <View style={st.tlDot}><Feather name={meta.icon as never} size={11} color={Colors.primary} /></View>
                      {i < timeline.length - 1 && <View style={st.tlLine} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 12 }}>
                      <Text style={st.tlTitle}>
                        {ar ? meta.ar : meta.en}{e.dept ? ` — ${t(DEPT_KEY[e.dept])}` : ""}
                      </Text>
                      <Text style={st.tlSub}>
                        {fmtTime(e.at, lang)}{e.by?.name ? ` · ${e.by.name}` : ""}{e.note ? ` · ${e.note}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <DriversModal
        visible={pickDriver}
        onClose={() => setPickDriver(false)}
        onPick={onPickDriver}
        currentDriverId={order.deliveryDriver?.employeeId}
        loadByDriver={openDriverLoad}
        onUnassign={() => { setPickDriver(false); void run("driver", () => assignDeliveryDriver(order.id, { name: "", employeeId: "" }, by)); }}
      />
    </Modal>
  );
}

function ActionBtn({ icon, label, hint, onPress, primary, danger, loading }: { icon: string; label: string; hint?: string; onPress: () => void; primary?: boolean; danger?: boolean; loading?: boolean }) {
  const bg = danger ? Colors.statusCancelled + "12" : primary ? Colors.primary : Colors.surfaceSecondary;
  const fg = danger ? Colors.statusCancelled : primary ? "#fff" : Colors.text;
  return (
    <Pressable onPress={onPress} disabled={loading} style={[st.action, { backgroundColor: bg }, loading && { opacity: 0.6 }]}>
      {loading ? <ActivityIndicator color={fg} /> : <Feather name={icon as never} size={18} color={primary ? Colors.goldLight : fg} />}
      <View style={{ flex: 1 }}>
        <Text style={[st.actionTxt, { color: fg }]}>{label}</Text>
        {hint ? <Text style={[st.actionHint, { color: primary ? "rgba(255,255,255,0.65)" : Colors.textMuted }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function Chip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={st.chip} onPress={onPress}>
      <Feather name={icon as never} size={13} color={Colors.primary} />
      <Text style={st.chipTxt}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={[st.rowValue, bold && { fontWeight: "900", fontSize: 15 }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, maxHeight: "94%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  num: { fontSize: 22, fontWeight: "900", color: Colors.text },
  customer: { fontSize: 15, fontWeight: "700", color: Colors.textSecondary },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  syncPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.warning + "18", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  syncTxt: { fontSize: 10, fontWeight: "800", color: Colors.warning },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  cardTitle: { fontSize: 13, fontWeight: "800", color: Colors.textSecondary },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  metaTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  alert: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: Colors.statusCancelled + "10", borderRadius: 12, padding: 10 },
  alertTxt: { color: Colors.statusCancelled, fontWeight: "700", flex: 1 },
  action: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  actionTxt: { fontSize: 14, fontWeight: "800" },
  actionHint: { fontSize: 11, marginTop: 2 },
  input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.text },
  line: { fontSize: 14, color: Colors.text, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipTxt: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  dept: { gap: 6, paddingTop: 4 },
  deptHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  deptIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  deptName: { flex: 1, fontSize: 14, fontWeight: "800", color: Colors.text },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: "800" },
  deptBy: { fontSize: 11, color: Colors.textMuted, marginStart: 36 },
  item: { flexDirection: "row", gap: 8, marginStart: 36, alignItems: "flex-start" },
  itemQty: { fontSize: 13, fontWeight: "900", color: Colors.primary, minWidth: 26 },
  itemName: { fontSize: 13, fontWeight: "700", color: Colors.text },
  itemNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  notes: { fontSize: 13, color: Colors.text, lineHeight: 20, backgroundColor: Colors.gold + "12", borderRadius: 12, padding: 10 },
  imgs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  img: { width: 84, height: 84, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 13, color: Colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: "700", color: Colors.text },
  tl: { flexDirection: "row", gap: 10 },
  tlRail: { alignItems: "center", width: 22 },
  tlDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.gold + "22", alignItems: "center", justifyContent: "center" },
  tlLine: { flex: 1, width: 2, backgroundColor: Colors.borderLight, marginTop: 2 },
  tlTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  tlSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
