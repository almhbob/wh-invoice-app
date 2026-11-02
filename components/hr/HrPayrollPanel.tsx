import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useHrWorkers, usePayroll } from "@/hooks/useHr";
import { tr, trf } from "@/lib/i18n";
import { showPlatformAlert } from "@/lib/platformAlert";
import { deletePayrollLine, generatePayroll, savePayrollLine } from "@/lib/hr";
import { computeNet, monthKey, PayrollLine, payrollCsv, payrollTotals, shiftMonth, toMoney } from "@/utils/hr";
import { s } from "@/components/hr/HrStaffPanel";

const sar = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${tr("ر.س", "SAR")}`;

function monthName(m: string) {
  try { return new Date(`${m}-15T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { month: "long", year: "numeric" }); } catch { return m; }
}

/** Admin: monthly payroll — generate from salaries, adjust, mark paid, export. */
export function HrPayrollPanel() {
  const { companyId, company } = useCompany();
  const { workers } = useHrWorkers();
  const [month, setMonth] = useState(monthKey());
  const { lines, loading } = usePayroll(month);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PayrollLine | null>(null);
  const totals = useMemo(() => payrollTotals(lines), [lines]);
  const missing = workers.filter((w) => w.active && !lines.some((l) => l.workerId === w.id)).length;

  const generate = async () => {
    setBusy(true);
    try {
      const n = await generatePayroll(companyId, month, workers, lines);
      if (!n) showPlatformAlert(tr("لا جديد", "Nothing new"), tr("كل العاملين النشطين لديهم سطر في هذا الشهر.", "Every active worker already has a line this month."));
    } catch {
      showPlatformAlert(tr("تعذّر الإنشاء", "Couldn't create"), tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    } finally { setBusy(false); }
  };

  const exportCsv = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const url = URL.createObjectURL(new Blob([payrollCsv(lines)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `payroll-${company.slug || companyId}-${month}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.card}>
        <View style={s.rowBetween}>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={10} disabled={month >= monthKey()}><Feather name="chevron-right" size={22} color={month >= monthKey() ? Colors.border : Colors.text} /></Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.title, { textAlign: "center" }]}>{monthName(month)}</Text>
            <Text style={[s.muted, { textAlign: "center" }]}>{trf("{n} عامل في مسير الرواتب", "{n} workers on the payroll", { n: totals.count })}</Text>
          </View>
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10}><Feather name="chevron-left" size={22} color={Colors.text} /></Pressable>
        </View>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <Tot label={tr("صافي الرواتب", "Net payroll")} v={sar(totals.net)} c={Colors.text} />
          <Tot label={tr("مدفوع", "Paid")} v={sar(totals.paid)} c={Colors.success} />
          <Tot label={trf("متبقٍ ({n})", "Unpaid ({n})", { n: totals.unpaidCount })} v={sar(totals.unpaid)} c={totals.unpaid ? Colors.accent : Colors.textMuted} />
        </View>
        <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
          {missing > 0 ? (
            <Pressable onPress={generate} disabled={busy} style={[s.addBtn, { flexGrow: 1, justifyContent: "center" }, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Feather name="file-plus" size={15} color="#fff" />}
              <Text style={s.addTxt}>{trf("إنشاء رواتب الشهر ({n} عامل)", "Create this month's lines ({n} workers)", { n: missing })}</Text>
            </Pressable>
          ) : null}
          {lines.length && Platform.OS === "web" ? (
            <Pressable onPress={exportCsv} style={[s.addBtn, { backgroundColor: Colors.surfaceSecondary, flexGrow: 1, justifyContent: "center" }]}>
              <Feather name="download" size={15} color={Colors.text} /><Text style={[s.addTxt, { color: Colors.text }]}>{tr("تصدير Excel", "Export to Excel")}</Text>
            </Pressable>
          ) : null}
        </View>
        {!workers.length ? <Text style={s.muted}>{tr("أضف العاملين ورواتبهم من تبويب «العاملون والإقامات» أولاً.", "Add workers and their salaries in “Staff & iqamas” first.")}</Text> : null}
      </View>

      {loading ? <ActivityIndicator color={Colors.gold} /> : lines.map((l) => (
        <Pressable key={l.id} style={s.card} onPress={() => setEditing(l)}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{l.name}</Text>
              <Text style={s.muted}>
                {[
                  trf("أساسي {n}", "Basic {n}", { n: l.basic }),
                  l.allowances ? trf("بدلات {n}", "Allowances {n}", { n: l.allowances }) : "",
                  l.additions ? trf("إضافات {n}", "Additions {n}", { n: l.additions }) : "",
                  l.deductions ? trf("خصم {n}", "Deductions {n}", { n: l.deductions }) : "",
                  l.advance ? trf("سلفة {n}", "Advance {n}", { n: l.advance }) : "",
                ].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-start", gap: 4 }}>
              <Text style={s.salary}>{sar(l.net)}</Text>
              <View style={[s.docChip, { borderColor: (l.status === "paid" ? Colors.success : Colors.accent) + "55", backgroundColor: (l.status === "paid" ? Colors.success : Colors.accent) + "10" }]}>
                <Text style={[s.docTxt, { color: l.status === "paid" ? Colors.success : Colors.accent }]}>
                  {l.status === "paid" ? (l.method === "transfer" ? tr("مدفوع · تحويل", "Paid · transfer") : tr("مدفوع · نقداً", "Paid · cash")) : tr("غير مدفوع", "Unpaid")}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      ))}

      {editing ? <LineForm line={editing} companyId={companyId} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

function Tot({ label, v, c }: { label: string; v: string; c: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: "900", color: c }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
      <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: "700" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function LineForm({ line, companyId, onClose }: { line: PayrollLine; companyId: string; onClose: () => void }) {
  const [f, setF] = useState({
    basic: String(line.basic), allowances: String(line.allowances), additions: line.additions ? String(line.additions) : "",
    deductions: line.deductions ? String(line.deductions) : "", advance: line.advance ? String(line.advance) : "", note: line.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const nums = { basic: toMoney(f.basic), allowances: toMoney(f.allowances), additions: toMoney(f.additions), deductions: toMoney(f.deductions), advance: toMoney(f.advance) };
  const net = computeNet(nums);

  const save = async (patch: Partial<PayrollLine> = {}) => {
    setBusy(true);
    try {
      const next: PayrollLine = { ...line, ...nums, note: f.note.trim() || undefined, net, ...patch };
      if (next.status !== "paid") { delete next.paidAt; delete next.method; }
      await savePayrollLine(companyId, next);
      onClose();
    } catch {
      showPlatformAlert(tr("تعذّر الحفظ", "Couldn't save"), tr("تحقق من الاتصال وحاول مجدداً.", "Check the connection and try again."));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(tr("حذف هذا السطر من مسير الشهر؟", "Remove this line from the month's payroll?"))) return;
    setBusy(true);
    try { await deletePayrollLine(companyId, line.id); onClose(); } catch { setBusy(false); }
  };

  const field = (k: keyof typeof f, label: string, money = true) => (
    <View style={{ flex: 1, minWidth: 130, gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={[s.input, money && { textAlign: "left" }]} value={f[k]} onChangeText={(v) => setF((m) => ({ ...m, [k]: v }))} keyboardType={money ? "decimal-pad" : "default"}
        textAlign={money ? "left" : "right"} placeholder={money ? "0" : ""} placeholderTextColor={Colors.textMuted} editable={!busy && line.status !== "paid"} />
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.rowBetween}>
            <Text style={s.big}>{line.name} · {monthName(line.month)}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={Colors.textSecondary} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <View style={s.grid}>{field("basic", tr("الأساسي", "Basic"))}{field("allowances", tr("البدلات", "Allowances"))}</View>
            <View style={s.grid}>{field("additions", tr("إضافي ومكافآت", "Overtime & bonus"))}{field("deductions", tr("خصومات وغياب", "Deductions & absence"))}</View>
            <View style={s.grid}>{field("advance", tr("سلفة تُخصم هذا الشهر", "Advance recovered this month"))}{field("note", tr("ملاحظة", "Note"), false)}</View>
            <View style={[s.rowBetween, { backgroundColor: Colors.background, borderRadius: 12, padding: 12 }]}>
              <Text style={s.title}>{tr("الصافي", "Net")}</Text>
              <Text style={[s.big, { textAlign: "left", flex: 0 }]}>{sar(net)}</Text>
            </View>
            {line.status === "paid" ? (
              <Text style={[s.muted, { color: Colors.success }]}>{trf("دُفع بتاريخ {d}", "Paid on {d}", { d: (line.paidAt ?? "").slice(0, 10) })}</Text>
            ) : null}
          </ScrollView>
          {line.status === "paid" ? (
            <Pressable onPress={() => save({ status: "unpaid" })} disabled={busy} style={[s.saveBtn, { backgroundColor: Colors.surfaceSecondary, flex: 0 }]}>
              <Feather name="rotate-ccw" size={15} color={Colors.text} /><Text style={[s.addTxt, { color: Colors.text }]}>{tr("إلغاء تسجيل الدفع", "Undo payment")}</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={s.rowBetween}>
                <Pressable onPress={() => save({ status: "paid", method: "transfer", paidAt: new Date().toISOString() })} disabled={busy} style={[s.saveBtn, { backgroundColor: Colors.success }]}>
                  <Feather name="credit-card" size={15} color="#fff" /><Text style={s.addTxt}>{tr("دُفع تحويلاً", "Paid by transfer")}</Text>
                </Pressable>
                <Pressable onPress={() => save({ status: "paid", method: "cash", paidAt: new Date().toISOString() })} disabled={busy} style={[s.saveBtn, { backgroundColor: Colors.success }]}>
                  <Feather name="dollar-sign" size={15} color="#fff" /><Text style={s.addTxt}>{tr("دُفع نقداً", "Paid in cash")}</Text>
                </Pressable>
              </View>
              <View style={s.rowBetween}>
                <Pressable onPress={remove} disabled={busy} style={s.delBtn}><Feather name="trash-2" size={15} color={Colors.accent} /></Pressable>
                <Pressable onPress={() => save()} disabled={busy} style={[s.saveBtn, busy && { opacity: 0.6 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Feather name="check" size={16} color="#fff" />}
                  <Text style={s.addTxt}>{tr("حفظ التعديلات", "Save changes")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
