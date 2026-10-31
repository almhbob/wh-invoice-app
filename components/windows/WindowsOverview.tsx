import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useWindowOrders, useWindows } from "@/hooks/useWindows";
import { tr, trf } from "@/lib/i18n";
import { showPlatformAlert } from "@/lib/platformAlert";
import { saveWindow } from "@/lib/windowOrders";
import { DEPT_COLOR } from "@/utils/orderFlow";
import { deptsOf, deptStatus, orderStage, riyadhDate, SalesWindow, slugWindowId } from "@/utils/windowOrders";
import { dispatchWithFeedback, useCanDispatch } from "@/components/windows/DeptWindowOrders";
import { DeptName, StageBadge } from "@/components/windows/windowUi";

/** Supervisors: every window's order for the day at a glance, plus window setup. */
export function WindowsOverview() {
  const { companyId } = useCompany();
  const { currentEmployee, employees } = useEmployee();
  const { windows, loading } = useWindows();
  const canDispatch = useCanDispatch();
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const date = riyadhDate(new Date(), dayOffset);
  const { orders } = useWindowOrders(date);
  const by = currentEmployee ? `${currentEmployee.name} #${currentEmployee.employeeId}` : "";

  const rows = useMemo(() => windows.filter((w) => w.active).map((w) => ({ w, o: orders.find((o) => o.windowId === w.id) ?? null })), [windows, orders]);
  const counts = useMemo(() => {
    const c = { missing: 0, open: 0, ready: 0, dispatched: 0, received: 0 };
    for (const r of rows) {
      if (!r.o) c.missing++;
      else { const st = orderStage(r.o); if (st === "ready") c.ready++; else if (st === "dispatched") c.dispatched++; else if (st.startsWith("received")) c.received++; else c.open++; }
    }
    return c;
  }, [rows]);

  return (
    <View style={{ gap: 14 }}>
      <View style={s.card}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.big}>{tr("طلبيات نوافذ البيع", "Sales window orders")}</Text>
            <Text style={s.muted}>{date}</Text>
          </View>
          <View style={s.seg}>
            {([0, 1] as const).map((d) => (
              <Pressable key={d} onPress={() => setDayOffset(d)} style={[s.segBtn, dayOffset === d && s.segOn]}>
                <Text style={[s.segTxt, dayOffset === d && s.segTxtOn]}>{d === 0 ? tr("اليوم", "Today") : tr("غداً", "Tomorrow")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.stats}>
          <Stat n={counts.missing} label={tr("لم تطلب", "Not ordered")} color={Colors.textMuted} />
          <Stat n={counts.open} label={tr("في المصنع", "In factory")} color={Colors.warning} />
          <Stat n={counts.ready} label={tr("جاهزة", "Ready")} color={Colors.info} />
          <Stat n={counts.dispatched} label={tr("في الطريق", "On the way")} color={Colors.gold} />
          <Stat n={counts.received} label={tr("استُلمت", "Received")} color={Colors.success} />
        </View>
      </View>

      {loading ? <ActivityIndicator color={Colors.gold} /> : rows.map(({ w, o }) => {
        const stage = o ? orderStage(o) : null;
        const staff = employees.filter((e) => e.branchId === w.id && e.status !== "suspended").length;
        return (
          <View key={w.id} style={s.card}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{w.name}</Text>
                <Text style={s.muted}>{trf("{n} موظف", "{n} staff", { n: staff })}{o ? ` · ${trf("{n} صنف", "{n} items", { n: o.items.length })} · ${trf("{q} قطعة", "{q} pcs", { q: o.items.reduce((a, i) => a + i.qty, 0) })}` : ""}</Text>
              </View>
              {stage ? <StageBadge stage={stage} /> : <Text style={[s.muted, { fontWeight: "800" }]}>{tr("لم تُرسل طلبية", "No order yet")}</Text>}
            </View>
            {o ? (
              <View style={s.chips}>
                {deptsOf(o.items).map((d) => {
                  const st = deptStatus(o, d);
                  return (
                    <View key={d} style={[s.pill, { borderColor: DEPT_COLOR[d] + "55", backgroundColor: st === "ready" ? DEPT_COLOR[d] + "18" : "transparent" }]}>
                      <Feather name={st === "ready" ? "check-circle" : st === "preparing" ? "loader" : "clock"} size={12} color={DEPT_COLOR[d]} />
                      <DeptName dept={d} small />
                    </View>
                  );
                })}
              </View>
            ) : null}
            {o?.status === "received" && o.shortageCount ? (
              <Text style={[s.muted, { color: Colors.accent }]}>
                {o.items.filter((i) => (i.receivedQty ?? i.qty) < i.qty).map((i) => `${i.name}: ${i.receivedQty}/${i.qty}`).join(" · ")}
              </Text>
            ) : null}
            {o?.receiveNote ? <Text style={s.note}>{o.receiveNote}</Text> : null}
            {o && o.status === "sent" && canDispatch ? (
              <Pressable onPress={() => dispatchWithFeedback(companyId, o, by)} style={[s.primary, stage !== "ready" && { backgroundColor: Colors.textSecondary }]}>
                <Feather name="truck" size={15} color="#fff" />
                <Text style={s.primaryTxt}>{stage === "ready" ? tr("إرسال للنافذة", "Dispatch to window") : tr("إرسال الجاهز الآن", "Dispatch what's ready")}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <WindowsManager windows={windows} companyId={companyId} />
    </View>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statN, { color }]}>{n}</Text>
      <Text style={s.statL} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function WindowsManager({ windows, companyId }: { windows: SalesWindow[]; companyId: string }) {
  const { currentEmployee } = useEmployee();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  if (currentEmployee?.role !== "admin" && currentEmployee?.role !== "branch_supervisor") return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch {
      showPlatformAlert(tr("تعذّر الحفظ", "Could not save"), tr("تحقق من الاتصال وصلاحيتك.", "Check the connection and your permissions."));
    } finally { setBusy(false); }
  };

  const add = () => {
    const n = name.trim();
    if (n.length < 2) return;
    if (windows.some((w) => w.name.trim() === n)) { showPlatformAlert(tr("الاسم مستخدم", "Name in use"), tr("توجد نافذة بهذا الاسم.", "A window with this name exists.")); return; }
    void run(async () => {
      await saveWindow(companyId, { id: slugWindowId(n, windows.map((w) => w.id)), name: n, active: true, sort: windows.length + 1 });
      setName("");
    });
  };

  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.title}>{tr("إعداد نوافذ البيع (الفروع)", "Set up sales windows (branches)")}</Text>
        <Feather name="settings" size={16} color={Colors.textMuted} />
      </View>
      <Text style={s.muted}>{tr("كل نافذة ترسل طلبيتها اليومية للمصنع. اربط كل موظف بنافذته من «الإدارة ← الموظفون».", "Each window sends its daily order to the factory. Link each employee to their window in Admin → Employees.")}</Text>
      {windows.map((w) => (
        <View key={w.id} style={s.mgrRow}>
          {editing === w.id ? (
            <>
              <TextInput style={[s.input, { flex: 1 }]} value={editName} onChangeText={setEditName} textAlign="right" maxLength={60} autoFocus />
              <Pressable disabled={busy} onPress={() => run(async () => { if (editName.trim().length >= 2) await saveWindow(companyId, { ...w, name: editName.trim() }); setEditing(null); })} style={s.iconBtn}><Feather name="check" size={16} color={Colors.success} /></Pressable>
              <Pressable onPress={() => setEditing(null)} style={s.iconBtn}><Feather name="x" size={16} color={Colors.textMuted} /></Pressable>
            </>
          ) : (
            <>
              <Text style={[s.lineName, !w.active && { color: Colors.textMuted }]}>{w.name}</Text>
              <Pressable onPress={() => { setEditing(w.id); setEditName(w.name); }} style={s.iconBtn}><Feather name="edit-2" size={14} color={Colors.textSecondary} /></Pressable>
              <Switch value={w.active} disabled={busy} onValueChange={(v) => run(() => saveWindow(companyId, { ...w, active: v }))} trackColor={{ true: Colors.success, false: Colors.border }} />
            </>
          )}
        </View>
      ))}
      <View style={s.mgrRow}>
        <TextInput style={[s.input, { flex: 1 }]} value={name} onChangeText={setName} placeholder={tr("اسم النافذة الجديدة، مثل: نافذة العليا", "New window name, e.g. Olaya window")} placeholderTextColor={Colors.textMuted} textAlign="right" maxLength={60} onSubmitEditing={add} />
        <Pressable onPress={add} disabled={busy || name.trim().length < 2} style={[s.addBtn, (busy || name.trim().length < 2) && { opacity: 0.5 }]}>
          <Feather name="plus" size={16} color="#fff" /><Text style={s.primaryTxt}>{tr("إضافة", "Add")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight, padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  big: { fontSize: 18, fontWeight: "900", color: Colors.text, textAlign: "right" },
  title: { fontSize: 15, fontWeight: "800", color: Colors.text, textAlign: "right" },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  seg: { flexDirection: "row-reverse", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 3 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  segOn: { backgroundColor: Colors.surface },
  segTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: "700" },
  segTxtOn: { color: Colors.text, fontWeight: "900" },
  stats: { flexDirection: "row-reverse", gap: 6 },
  stat: { flex: 1, alignItems: "center", backgroundColor: Colors.background, borderRadius: 12, paddingVertical: 8 },
  statN: { fontSize: 20, fontWeight: "900" },
  statL: { fontSize: 10, color: Colors.textSecondary, fontWeight: "700" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  pill: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  note: { fontSize: 13, color: Colors.text, backgroundColor: Colors.background, borderRadius: 10, padding: 8, textAlign: "right" },
  primary: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, minHeight: 44, paddingHorizontal: 14 },
  primaryTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  mgrRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  lineName: { flex: 1, fontSize: 14, color: Colors.text, textAlign: "right", fontWeight: "700" },
  iconBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#FAFAF8", paddingHorizontal: 12, color: Colors.text, fontSize: 14 },
  addBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 12, minHeight: 42, paddingHorizontal: 14 },
});
