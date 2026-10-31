import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID, buildLavivianeProducts } from "@/constants/lavivianeProducts";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { Product, useProducts } from "@/context/ProductsContext";
import { useMyWindow, useWindowOrders } from "@/hooks/useWindows";
import { tr, trf } from "@/lib/i18n";
import { showPlatformAlert } from "@/lib/platformAlert";
import { getWindowOrder, receiveWindowOrder, sendWindowOrder, WindowOrderError } from "@/lib/windowOrders";
import { DEPT_COLOR } from "@/utils/orderFlow";
import {
  canEditOrder, deptsOf, deptStatus, FACTORY_DEPTS, FactoryDept, isFactoryDept, orderStage, riyadhDate, SalesWindow,
  STAGE_ORDER, WindowOrder, WindowOrderItem,
} from "@/utils/windowOrders";
import { DeptName, StageBadge } from "@/components/windows/windowUi";

type Mode = "view" | "edit" | "receive";

/** A sales window's daily order: build it, follow it through the factory, confirm receipt. */
export function WindowOrderPanel() {
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const { assigned, canPickAny, active, loading: winLoading } = useMyWindow();
  const { products } = useProducts();
  const catalog = useMemo<Product[]>(
    () => (products.length ? products : companyId === LAVIVIANE_COMPANY_ID ? buildLavivianeProducts() : []).filter((p) => isFactoryDept(p.department)),
    [products, companyId]
  );

  const [picked, setPicked] = useState<string | null>(null);
  const win: SalesWindow | null = (canPickAny ? active.find((w) => w.id === picked) ?? assigned ?? active[0] : assigned) ?? null;
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const date = riyadhDate(new Date(), dayOffset);
  const { orders, loading } = useWindowOrders(date);
  const order = win ? orders.find((o) => o.windowId === win.id) ?? null : null;

  const [mode, setMode] = useState<Mode>("view");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [received, setReceived] = useState<Record<string, string>>({});
  const [receiveNote, setReceiveNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMode("view"); }, [win?.id, date]);

  const by = currentEmployee ? `${currentEmployee.name} #${currentEmployee.employeeId}` : "";
  const lines: WindowOrderItem[] = useMemo(
    () => catalog.filter((p) => (qty[p.id] ?? 0) > 0).map((p) => ({ productId: p.id, name: p.name, department: p.department as FactoryDept, qty: qty[p.id] })),
    [catalog, qty]
  );
  const totalPieces = lines.reduce((s, l) => s + l.qty, 0);

  const startEdit = (from?: WindowOrder | null) => {
    const src = from ?? order;
    setQty(Object.fromEntries((src?.items ?? []).map((i) => [i.productId, i.qty])));
    setNote(src === order ? order?.note ?? "" : "");
    setSearch("");
    setMode("edit");
  };

  const copyYesterday = async () => {
    if (!win) return;
    const prev = await getWindowOrder(companyId, win.id, riyadhDate(new Date(), dayOffset - 1)).catch(() => null);
    if (!prev) { showPlatformAlert(tr("لا توجد طلبية سابقة", "No previous order"), tr("لم تُرسل هذه النافذة طلبية في اليوم السابق.", "This window sent no order the day before.")); return; }
    startEdit(prev);
  };

  const send = async () => {
    if (!win || !lines.length) return;
    setBusy(true);
    try {
      await sendWindowOrder(companyId, { window: win, date, items: lines, note, by });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setMode("view");
    } catch (e) {
      const code = e instanceof WindowOrderError ? e.code : "";
      showPlatformAlert(tr("تعذّر الإرسال", "Could not send"), code === "locked"
        ? tr("بدأ المصنع تحضير هذه الطلبية، فلم يعد تعديلها ممكناً. تواصل مع المشرف.", "The factory has started on this order, so it can't be changed. Contact the supervisor.")
        : tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    } finally { setBusy(false); }
  };

  const startReceive = () => {
    setReceived(Object.fromEntries((order?.items ?? []).map((i) => [i.productId, String(i.qty)])));
    setReceiveNote("");
    setMode("receive");
  };

  const confirmReceive = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const map = Object.fromEntries(Object.entries(received).map(([k, v]) => [k, Number(v.replace(/[^\d]/g, "")) || 0]));
      await receiveWindowOrder(companyId, order.id, map, by, receiveNote);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setMode("view");
    } catch {
      showPlatformAlert(tr("تعذّر تأكيد الاستلام", "Could not confirm receipt"), tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    } finally { setBusy(false); }
  };

  if (winLoading) return <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />;

  if (!win) {
    return (
      <View style={s.card}>
        <Feather name="map-pin" size={22} color={Colors.textMuted} />
        <Text style={s.title}>{canPickAny ? tr("لا توجد نوافذ بيع بعد", "No sales windows yet") : tr("حسابك غير مربوط بنافذة", "Your account isn't linked to a window")}</Text>
        <Text style={s.muted}>{canPickAny
          ? tr("أضف نوافذ البيع (الفروع) من شاشة «نوافذ البيع» ثم اربط كل موظف بنافذته.", "Add the sales windows (branches) in “Sales windows”, then link each employee to their window.")
          : tr("اطلب من مسؤول الشركة ربط حسابك بالنافذة التي تعمل بها.", "Ask the company admin to link your account to the window you work at.")}</Text>
      </View>
    );
  }

  const stage = order ? orderStage(order) : null;
  const editable = canEditOrder(order);
  const q = search.trim().toLowerCase();
  const shown = catalog.filter((p) => p.isAvailable !== false && (!q || p.name.toLowerCase().includes(q) || (p.nameEn ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)));

  return (
    <View style={{ gap: 14 }}>
      {/* Window + day */}
      <View style={s.card}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>{tr("نافذة البيع", "Sales window")}</Text>
            <Text style={s.big}>{win.name}</Text>
          </View>
          <View style={s.seg}>
            {([0, 1] as const).map((d) => (
              <Pressable key={d} onPress={() => setDayOffset(d)} style={[s.segBtn, dayOffset === d && s.segOn]}>
                <Text style={[s.segTxt, dayOffset === d && s.segTxtOn]}>{d === 0 ? tr("اليوم", "Today") : tr("غداً", "Tomorrow")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {canPickAny && active.length > 1 ? (
          <View style={s.chips}>
            {active.map((w) => (
              <Pressable key={w.id} onPress={() => setPicked(w.id)} style={[s.chip, w.id === win.id && s.chipOn]}>
                <Text style={[s.chipTxt, w.id === win.id && { color: "#fff" }]}>{w.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={s.muted}>{date}</Text>
      </View>

      {loading ? <ActivityIndicator color={Colors.gold} /> : mode === "edit" ? (
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.title}>{order ? tr("تعديل الطلبية", "Edit order") : tr("طلبية جديدة من المصنع", "New order from the factory")}</Text>
            <Pressable onPress={copyYesterday} style={s.linkBtn}><Feather name="copy" size={14} color={Colors.primary} /><Text style={s.linkTxt}>{tr("نسخ طلبية اليوم السابق", "Copy previous day")}</Text></Pressable>
          </View>
          <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder={tr("ابحث عن منتج", "Search products")} placeholderTextColor={Colors.textMuted} textAlign="right" />
          {FACTORY_DEPTS.map((d) => {
            const list = shown.filter((p) => p.department === d);
            if (!list.length) return null;
            return (
              <View key={d} style={{ gap: 6 }}>
                <DeptName dept={d} />
                {list.map((p) => (
                  <QtyRow key={p.id} name={p.name} value={qty[p.id] ?? 0} onChange={(v) => setQty((m) => ({ ...m, [p.id]: v }))} />
                ))}
              </View>
            );
          })}
          {!shown.length ? <Text style={s.muted}>{tr("لا توجد منتجات مطابقة.", "No matching products.")}</Text> : null}
          <TextInput style={[s.input, { minHeight: 60 }]} value={note} onChangeText={setNote} placeholder={tr("ملاحظة للمصنع (اختياري)", "Note for the factory (optional)")} placeholderTextColor={Colors.textMuted} textAlign="right" multiline maxLength={300} />
          <View style={s.rowBetween}>
            <Pressable onPress={() => setMode("view")} style={s.ghost}><Text style={s.ghostTxt}>{tr("إلغاء", "Cancel")}</Text></Pressable>
            <Pressable onPress={send} disabled={!lines.length || busy} style={[s.primary, (!lines.length || busy) && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
              <Text style={s.primaryTxt}>{trf("إرسال للمصنع · {n} صنف · {q} قطعة", "Send to factory · {n} items · {q} pcs", { n: lines.length, q: totalPieces })}</Text>
            </Pressable>
          </View>
        </View>
      ) : mode === "receive" && order ? (
        <View style={s.card}>
          <Text style={s.title}>{tr("تأكيد الاستلام", "Confirm receipt")}</Text>
          <Text style={s.muted}>{tr("عدّل الكمية إذا وصل أقل من المطلوب.", "Change the quantity if less arrived than ordered.")}</Text>
          {order.items.map((i) => {
            const got = Number(received[i.productId] ?? i.qty);
            return (
              <View key={i.productId} style={s.line}>
                <Text style={s.lineName} numberOfLines={1}>{i.name}</Text>
                <Text style={s.muted}>{trf("طُلب {n}", "Ordered {n}", { n: i.qty })}</Text>
                <TextInput
                  style={[s.qtyInput, got < i.qty && { borderColor: Colors.accent, color: Colors.accent }]}
                  value={received[i.productId] ?? String(i.qty)}
                  onChangeText={(v) => setReceived((m) => ({ ...m, [i.productId]: v.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)) }))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            );
          })}
          <TextInput style={[s.input, { minHeight: 56 }]} value={receiveNote} onChangeText={setReceiveNote} placeholder={tr("ملاحظة عن النقص أو التلف (اختياري)", "Note about shortages or damage (optional)")} placeholderTextColor={Colors.textMuted} textAlign="right" multiline maxLength={300} />
          <View style={s.rowBetween}>
            <Pressable onPress={() => setMode("view")} style={s.ghost}><Text style={s.ghostTxt}>{tr("إلغاء", "Cancel")}</Text></Pressable>
            <Pressable onPress={confirmReceive} disabled={busy} style={[s.primary, { backgroundColor: Colors.success }, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Feather name="check-circle" size={16} color="#fff" />}
              <Text style={s.primaryTxt}>{tr("تأكيد الاستلام", "Confirm receipt")}</Text>
            </Pressable>
          </View>
        </View>
      ) : !order ? (
        <View style={[s.card, { alignItems: "center" }]}>
          <Feather name="clipboard" size={26} color={Colors.textMuted} />
          <Text style={s.title}>{tr("لم تُرسل طلبية لهذا اليوم", "No order sent for this day")}</Text>
          <Text style={[s.muted, { textAlign: "center" }]}>{tr("حدّد الكميات التي تحتاجها النافذة من كل قسم، وتصل للمصنع فوراً.", "Set the quantities the window needs from each department; the factory gets it instantly.")}</Text>
          <View style={[s.rowBetween, { gap: 8 }]}>
            <Pressable onPress={copyYesterday} style={s.ghost}><Text style={s.ghostTxt}>{tr("نسخ طلبية اليوم السابق", "Copy previous day")}</Text></Pressable>
            <Pressable onPress={() => startEdit(null)} style={s.primary}><Feather name="plus" size={16} color="#fff" /><Text style={s.primaryTxt}>{tr("إنشاء الطلبية", "Create order")}</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.title}>{tr("طلبية النافذة", "Window order")}</Text>
            <StageBadge stage={stage!} />
          </View>
          <Stepper stage={stage!} />
          <View style={s.chips}>
            {deptsOf(order.items).map((d) => {
              const st = deptStatus(order, d);
              return (
                <View key={d} style={[s.deptPill, { borderColor: DEPT_COLOR[d] + "55", backgroundColor: st === "ready" ? DEPT_COLOR[d] + "18" : "transparent" }]}>
                  <Feather name={st === "ready" ? "check-circle" : st === "preparing" ? "loader" : "clock"} size={13} color={DEPT_COLOR[d]} />
                  <DeptName dept={d} small />
                </View>
              );
            })}
          </View>
          {order.items.map((i) => (
            <View key={i.productId} style={s.line}>
              <Text style={s.lineName} numberOfLines={1}>{i.name}</Text>
              {order.status === "received" && i.receivedQty != null && i.receivedQty !== i.qty ? (
                <Text style={[s.lineQty, { color: Colors.accent }]}>{trf("{r} من {q}", "{r} of {q}", { r: i.receivedQty, q: i.qty })}</Text>
              ) : <Text style={s.lineQty}>× {i.qty}</Text>}
            </View>
          ))}
          {order.note ? <Text style={s.note}>{order.note}</Text> : null}
          {order.receiveNote ? <Text style={s.note}>{order.receiveNote}</Text> : null}
          {editable ? (
            <Pressable onPress={() => startEdit(null)} style={s.ghost}><Feather name="edit-2" size={14} color={Colors.primary} /><Text style={s.ghostTxt}>{tr("تعديل الطلبية", "Edit order")}</Text></Pressable>
          ) : null}
          {order.status === "dispatched" ? (
            <Pressable onPress={startReceive} style={[s.primary, { backgroundColor: Colors.success }]}><Feather name="truck" size={16} color="#fff" /><Text style={s.primaryTxt}>{tr("وصلت الطلبية — تأكيد الاستلام", "Order arrived — confirm receipt")}</Text></Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function QtyRow({ name, value, onChange }: { name: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={[s.line, value > 0 && { backgroundColor: Colors.gold + "0D" }]}>
      <Text style={[s.lineName, value > 0 && { fontWeight: "800" }]} numberOfLines={1}>{name}</Text>
      <View style={s.stepper}>
        <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={s.stepBtn} hitSlop={6}><Feather name="minus" size={14} color={Colors.text} /></Pressable>
        <TextInput
          style={s.qtyInput}
          value={value ? String(value) : ""}
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          onChangeText={(v) => onChange(Math.min(9999, Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/\D/g, "")) || 0))}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Pressable onPress={() => onChange(Math.min(9999, value + 1))} style={[s.stepBtn, { backgroundColor: Colors.primary }]} hitSlop={6}><Feather name="plus" size={14} color="#fff" /></Pressable>
      </View>
    </View>
  );
}

function Stepper({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage === "received_short" ? "received" : (stage as never));
  const labels = [tr("أُرسلت", "Sent"), tr("قيد التحضير", "Preparing"), tr("جاهزة", "Ready"), tr("في الطريق", "On the way"), tr("استُلمت", "Received")];
  return (
    <View style={s.stepperRow}>
      {labels.map((l, i) => (
        <View key={l} style={{ flex: 1, gap: 4 }}>
          <View style={[s.bar, i <= idx && { backgroundColor: Colors.gold }]} />
          <Text style={[s.stepTxt, i <= idx && { color: Colors.text, fontWeight: "800" }]} numberOfLines={1}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight, padding: 16, gap: 10 },
  rowBetween: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  kicker: { fontSize: 12, color: Colors.textMuted, fontWeight: "700", textAlign: "right" },
  big: { fontSize: 20, fontWeight: "900", color: Colors.text, textAlign: "right" },
  title: { fontSize: 15, fontWeight: "800", color: Colors.text, textAlign: "right" },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  seg: { flexDirection: "row-reverse", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 3 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  segOn: { backgroundColor: Colors.surface },
  segTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: "700" },
  segTxtOn: { color: Colors.text, fontWeight: "900" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#FAFAF8", paddingHorizontal: 12, paddingVertical: 8, color: Colors.text, fontSize: 14 },
  line: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10 },
  lineName: { flex: 1, fontSize: 14, color: Colors.text, textAlign: "right" },
  lineQty: { fontSize: 14, fontWeight: "900", color: Colors.text },
  stepper: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 56, height: 36, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, textAlign: "center", fontSize: 15, fontWeight: "800", color: Colors.text, backgroundColor: "#fff" },
  primary: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, minHeight: 46, paddingHorizontal: 16, flexGrow: 1 },
  primaryTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  ghost: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, minHeight: 46, paddingHorizontal: 16 },
  ghostTxt: { color: Colors.text, fontSize: 13, fontWeight: "700" },
  linkBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  linkTxt: { color: Colors.primary, fontSize: 12, fontWeight: "800" },
  deptPill: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  note: { fontSize: 13, color: Colors.text, backgroundColor: Colors.background, borderRadius: 10, padding: 10, textAlign: "right" },
  stepperRow: { flexDirection: "row-reverse", gap: 4 },
  bar: { height: 5, borderRadius: 3, backgroundColor: Colors.border },
  stepTxt: { fontSize: 10, color: Colors.textMuted, textAlign: "center" },
});
