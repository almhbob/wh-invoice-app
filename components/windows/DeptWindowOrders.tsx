import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useWindowOrders, useWindowSettings } from "@/hooks/useWindows";
import { tr, trf } from "@/lib/i18n";
import { confirmPlatform, showPlatformAlert } from "@/lib/platformAlert";
import { dispatchWindowOrder, sendLateDeptPart, setDeptProgress, WindowOrderError } from "@/lib/windowOrders";
import { DEPT_COLOR } from "@/utils/orderFlow";
import { deptsOf, deptStatus, deptTotals, DeptLineStatus, FactoryDept, isDayLocked, isLateDept, isPastCutoff, orderStage, readyDeptCount, riyadhDate, WindowOrder } from "@/utils/windowOrders";
import { deptLabel, StageBadge } from "@/components/windows/windowUi";

const CAN_DISPATCH = new Set(["admin", "branch_supervisor", "dept_supervisor", "packaging"]);

export function useCanDispatch() {
  const { currentEmployee } = useEmployee();
  return !!currentEmployee && CAN_DISPATCH.has(currentEmployee.role);
}

export async function dispatchWithFeedback(companyId: string, o: WindowOrder, by: string) {
  const go = async (force: boolean) => {
    try {
      await dispatchWindowOrder(companyId, o.id, by, force);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      const code = e instanceof WindowOrderError ? e.code : "";
      showPlatformAlert(tr("تعذّر الإرسال", "Could not dispatch"), code === "already_dispatched"
        ? tr("أُرسلت هذه الطلبية مسبقاً.", "This order was already dispatched.")
        : tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    }
  };
  if (orderStage(o) === "ready") return go(false);
  // Partial dispatch always needs an explicit confirmation (phones included).
  const late = deptsOf(o.items).filter((d) => deptStatus(o, d) !== "ready").map(deptLabel).join("، ");
  const ok = await confirmPlatform(
    tr("إرسال جزئي", "Partial dispatch"),
    trf("لم تُنهِ هذه الأقسام التجهيز: {d}. ستُرسل الأصناف الجاهزة فقط، وتُسجَّل كميات هذه الأقسام صفراً حتى ترسل نصيبها لاحقاً.", "These departments haven't finished: {d}. Only ready items go now; their quantities are recorded as 0 until they send their part later.", { d: late }),
    tr("إرسال الجاهز", "Send what's ready"),
    tr("إلغاء", "Cancel"),
  );
  if (ok) await go(true);
}

/** A factory department's share of the windows' daily orders. */
export function DeptWindowOrders({ department }: { department: FactoryDept }) {
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const canDispatch = useCanDispatch();
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const date = riyadhDate(new Date(), dayOffset);
  const { orders, loading, failed } = useWindowOrders(date);
  const settings = useWindowSettings();
  const final = isDayLocked(settings, date) || isPastCutoff(date, settings.cutoff);
  const [busy, setBusy] = useState<string>("");
  const by = currentEmployee ? `${currentEmployee.name} #${currentEmployee.employeeId}` : "";

  const isPackaging = department === "packaging";
  const mine = useMemo(
    () => isPackaging ? orders : orders.filter((o) => o.items.some((i) => i.department === department)),
    [orders, department, isPackaging]
  );
  const open = mine.filter((o) => o.status === "sent");
  const late = isPackaging ? [] : mine.filter((o) => isLateDept(o, department));
  const totals = useMemo(() => isPackaging ? [] : deptTotals([...open, ...late], department), [open, late, department, isPackaging]);
  const color = DEPT_COLOR[department];

  const move = async (o: WindowOrder, status: DeptLineStatus) => {
    setBusy(o.id);
    try {
      await setDeptProgress(companyId, o.id, department, status, by);
      if (status === "ready") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      const code = e instanceof WindowOrderError ? e.code : "";
      showPlatformAlert(tr("تعذّر التحديث", "Could not update"), code === "already_dispatched"
        ? tr("أُرسلت هذه الطلبية للنافذة، ولم يعد تعديلها ممكناً.", "This order has been dispatched and can't be changed.")
        : tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    } finally { setBusy(""); }
  };

  const sendLate = async (o: WindowOrder) => {
    setBusy(o.id);
    try {
      await sendLateDeptPart(companyId, o.id, department, by);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      const code = e instanceof WindowOrderError ? e.code : "";
      showPlatformAlert(tr("تعذّر الإرسال", "Could not dispatch"), code === "not_late"
        ? tr("استلمت النافذة الطلبية أو أُرسل هذا الجزء مسبقاً.", "The window already confirmed receipt, or this part was already sent.")
        : tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    } finally { setBusy(""); }
  };

  const allReady = async () => {
    for (const o of open) if (deptStatus(o, department) !== "ready") await move(o, "ready");
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.headRow}>
        <View style={s.seg}>
          {([0, 1] as const).map((d) => (
            <Pressable key={d} onPress={() => setDayOffset(d)} style={[s.segBtn, dayOffset === d && s.segOn]}>
              <Text style={[s.segTxt, dayOffset === d && s.segTxtOn]}>{d === 0 ? tr("اليوم", "Today") : tr("غداً", "Tomorrow")}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.muted}>{date}</Text>
      </View>
      <Text style={[s.muted, final && { color: Colors.success, fontWeight: "800" }]}>
        {final
          ? tr("✓ الأرقام نهائية — أُقفلت الطلبات لهذا اليوم", "✓ Numbers are final — orders are closed for this day")
          : tr("قد تتغير الأرقام حتى موعد إقفال الطلبات", "Numbers may still change until the ordering deadline")}
      </Text>

      {loading ? <ActivityIndicator color={color} /> : failed ? (
        <Text style={s.muted}>{tr("تعذّر تحميل طلبيات النوافذ.", "Couldn't load the window orders.")}</Text>
      ) : !mine.length ? (
        <View style={[s.card, { alignItems: "center" }]}>
          <Feather name="inbox" size={24} color={Colors.textMuted} />
          <Text style={s.title}>{tr("لا توجد طلبيات من النوافذ لهذا اليوم", "No window orders for this day")}</Text>
        </View>
      ) : (
        <>
          {!isPackaging && totals.length ? (
            <View style={[s.card, { borderColor: color + "40" }]}>
              <View style={s.rowBetween}>
                <Text style={s.title}>{tr("المطلوب تحضيره لكل النوافذ", "To prepare for all windows")}</Text>
                <Text style={[s.total, { color }]}>{trf("{n} قطعة", "{n} pcs", { n: totals.reduce((a, r) => a + r.total, 0) })}</Text>
              </View>
              {totals.map((r) => (
                <View key={r.productId} style={s.totalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lineName}>{r.name}</Text>
                    <Text style={s.muted}>{r.perWindow.map((w) => `${w.windowName} ${w.qty}`).join(" · ")}</Text>
                  </View>
                  <Text style={[s.qty, { color }]}>{r.total}</Text>
                </View>
              ))}
              {open.some((o) => deptStatus(o, department) !== "ready") ? (
                <Pressable onPress={allReady} disabled={!!busy} style={[s.primary, { backgroundColor: color }]}>
                  <Feather name="check-square" size={16} color="#fff" />
                  <Text style={s.primaryTxt}>{tr("تجهيز الكل — جاهز لكل النوافذ", "All ready for every window")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {mine.map((o) => {
            const stage = orderStage(o);
            const st = deptStatus(o, department);
            const lines = isPackaging ? o.items : o.items.filter((i) => i.department === department);
            const rc = readyDeptCount(o);
            return (
              <View key={o.id} style={[s.card, o.status !== "sent" && !isLateDept(o, department) && { opacity: 0.75 }]}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{o.windowName}</Text>
                    <Text style={s.muted}>{trf("الأقسام الجاهزة {r} من {t}", "{r} of {t} departments ready", { r: rc.ready, t: rc.total })}</Text>
                  </View>
                  <StageBadge stage={stage} />
                </View>
                {lines.map((i) => (
                  <View key={i.productId} style={s.lineRow}>
                    <Text style={s.lineName} numberOfLines={1}>{i.name}</Text>
                    <Text style={s.qtySmall}>× {i.qty}</Text>
                  </View>
                ))}
                {o.note ? <Text style={s.note}>{o.note}</Text> : null}
                {o.status === "sent" && !isPackaging ? (
                  <View style={s.actions}>
                    {st === "pending" ? (
                      <Pressable onPress={() => move(o, "preparing")} disabled={busy === o.id} style={[s.primary, { backgroundColor: Colors.warning }]}>
                        <Feather name="play" size={15} color="#fff" /><Text style={s.primaryTxt}>{tr("بدء التحضير", "Start preparing")}</Text>
                      </Pressable>
                    ) : st === "preparing" ? (
                      <Pressable onPress={() => move(o, "ready")} disabled={busy === o.id} style={[s.primary, { backgroundColor: Colors.success }]}>
                        <Feather name="check" size={15} color="#fff" /><Text style={s.primaryTxt}>{tr("جاهز", "Ready")}</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => move(o, "preparing")} disabled={busy === o.id} style={s.ghost}>
                        <Feather name="rotate-ccw" size={14} color={Colors.textSecondary} /><Text style={s.ghostTxt}>{tr("تراجع عن «جاهز»", "Undo ready")}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
                {isLateDept(o, department) ? (
                  <View style={[s.lateBox, { borderColor: Colors.warning + "66" }]}>
                    <Text style={[s.muted, { color: Colors.warning, fontWeight: "800" }]}>{tr("أُرسلت الطلبية بدون نصيب قسمك — أرسله الآن", "The order left without your part — send it now")}</Text>
                    <Pressable onPress={() => sendLate(o)} disabled={busy === o.id} style={[s.primary, { backgroundColor: color }]}>
                      {busy === o.id ? <ActivityIndicator color="#fff" /> : <Feather name="truck" size={15} color="#fff" />}
                      <Text style={s.primaryTxt}>{tr("جاهز — إرسال نصيبي للنافذة", "Ready — send my part to the window")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {o.status === "sent" && canDispatch && (isPackaging || stage === "ready") ? (
                  <Pressable onPress={() => dispatchWithFeedback(companyId, o, by)} style={[s.primary, { backgroundColor: Colors.primary }]}>
                    <Feather name="truck" size={15} color="#fff" /><Text style={s.primaryTxt}>{tr("إرسال للنافذة", "Dispatch to window")}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight, padding: 14, gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { fontSize: 15, fontWeight: "800", color: Colors.text, textAlign: "right" },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  total: { fontSize: 15, fontWeight: "900" },
  totalRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight },
  qty: { fontSize: 20, fontWeight: "900", minWidth: 40, textAlign: "center" },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lineName: { flex: 1, fontSize: 14, color: Colors.text, textAlign: "right", fontWeight: "600" },
  qtySmall: { fontSize: 14, fontWeight: "900", color: Colors.text },
  note: { fontSize: 13, color: Colors.text, backgroundColor: Colors.background, borderRadius: 10, padding: 8, textAlign: "right" },
  actions: { flexDirection: "row", gap: 8 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, flexGrow: 1 },
  primaryTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  ghost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, flexGrow: 1 },
  ghostTxt: { color: Colors.textSecondary, fontSize: 13, fontWeight: "700" },
  seg: { flexDirection: "row", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 3 },
  lateBox: { gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  segOn: { backgroundColor: Colors.surface },
  segTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: "700" },
  segTxtOn: { color: Colors.text, fontWeight: "900" },
});
