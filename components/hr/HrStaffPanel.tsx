import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useHrWorkers } from "@/hooks/useHr";
import { tr, trf } from "@/lib/i18n";
import { showPlatformAlert } from "@/lib/platformAlert";
import { deleteWorker, saveWorker } from "@/lib/hr";
import { openWhatsApp } from "@/utils/orderFlow";
import {
  DEFAULT_WARN_DAYS, DocKind, DOC_KINDS, EXPIRY_FIELD, expiryAlerts, expiryState, ExpiryState, HrWorker, isValidIqama,
  monthlyGross, parseDateInput,
} from "@/utils/hr";
import { riyadhDate } from "@/utils/windowOrders";

export function docLabel(k: DocKind) {
  return k === "iqama" ? tr("الإقامة", "Iqama") : k === "passport" ? tr("الجواز", "Passport") : k === "health" ? tr("الشهادة الصحية", "Health certificate") : tr("العقد", "Contract");
}

export const STATE_COLOR: Record<ExpiryState, string> = { expired: Colors.accent, soon: Colors.warning, ok: Colors.success, missing: Colors.textMuted };

export function fmtDay(iso: string) {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    const g = d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" });
    const h = d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "short", year: "numeric" });
    return `${g} · ${h}`;
  } catch { return iso; }
}

export function daysText(days: number) {
  if (days < 0) return trf("منتهية منذ {n} يوم", "Expired {n} days ago", { n: -days });
  if (days === 0) return tr("تنتهي اليوم", "Expires today");
  return trf("باقٍ {n} يوم", "{n} days left", { n: days });
}

type Filter = "all" | "alerts" | "inactive";

/** Admin: staff files with iqama / passport / health certificate / contract expiry tracking. */
export function HrStaffPanel() {
  const { companyId } = useCompany();
  const { workers, loading } = useHrWorkers();
  const today = riyadhDate();
  const alerts = useMemo(() => expiryAlerts(workers, today, DEFAULT_WARN_DAYS), [workers, today]);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<HrWorker | null>(null);

  const alertIds = new Set(alerts.map((a) => a.workerId));
  const shown = workers.filter((w) =>
    (filter === "all" ? w.active : filter === "alerts" ? alertIds.has(w.id) : !w.active)
    && (!q.trim() || `${w.name} ${w.iqamaNumber ?? ""} ${w.jobTitle ?? ""} ${w.nationality ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const expired = alerts.filter((a) => a.state === "expired").length;

  const remind = (w: HrWorker, kind: DocKind, date: string) => {
    if (!w.phone) { showPlatformAlert(tr("لا يوجد رقم جوال", "No phone number"), tr("أضف رقم جوال العامل في ملفه أولاً.", "Add the worker's phone in their file first.")); return; }
    openWhatsApp(w.phone, `مرحباً ${w.name}، تذكير: ${docLabel(kind)} ينتهي بتاريخ ${date}. نرجو تجهيز متطلبات التجديد في أقرب وقت.`);
  };

  if (loading) return <ActivityIndicator color={Colors.gold} style={{ marginTop: 30 }} />;

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.card, alerts.length ? { borderColor: (expired ? Colors.accent : Colors.warning) + "55" } : null]}>
        <View style={s.rowBetween}>
          <View style={[s.icon, { backgroundColor: (alerts.length ? (expired ? Colors.accent : Colors.warning) : Colors.success) + "16" }]}>
            <Feather name={alerts.length ? "alert-triangle" : "shield"} size={18} color={alerts.length ? (expired ? Colors.accent : Colors.warning) : Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{alerts.length
              ? trf("{n} وثيقة تحتاج متابعة", "{n} documents need attention", { n: alerts.length })
              : tr("كل الوثائق سارية", "All documents are valid")}</Text>
            <Text style={s.muted}>{trf("التنبيه قبل الانتهاء بـ {d} أيام · الإقامة، الجواز، الشهادة الصحية، العقد", "Alerts {d} days before expiry · iqama, passport, health certificate, contract", { d: DEFAULT_WARN_DAYS })}</Text>
          </View>
        </View>
        {alerts.slice(0, 12).map((a) => {
          const w = workers.find((x) => x.id === a.workerId)!;
          return (
            <View key={`${a.workerId}:${a.kind}`} style={s.alertRow}>
              <View style={[s.dot, { backgroundColor: STATE_COLOR[a.state] }]} />
              <Pressable style={{ flex: 1 }} onPress={() => setEditing(w)}>
                <Text style={s.alertName} numberOfLines={1}>{a.name} · {docLabel(a.kind)}</Text>
                <Text style={[s.muted, { color: STATE_COLOR[a.state] }]}>{daysText(a.days)} · {fmtDay(a.date)}</Text>
              </Pressable>
              <Pressable onPress={() => remind(w, a.kind, a.date)} style={s.waBtn} accessibilityLabel={tr("تذكير العامل على واتساب", "Remind the worker on WhatsApp")}>
                <Feather name="message-circle" size={15} color="#fff" />
              </Pressable>
            </View>
          );
        })}
        {alerts.length > 12 ? <Text style={s.muted}>{trf("و{n} أخرى…", "and {n} more…", { n: alerts.length - 12 })}</Text> : null}
      </View>

      <View style={s.rowBetween}>
        <View style={s.seg}>
          {([["all", tr("العاملون", "Staff")], ["alerts", tr("تحتاج متابعة", "Need attention")], ["inactive", tr("غير نشط", "Inactive")]] as const).map(([k, l]) => (
            <Pressable key={k} onPress={() => setFilter(k)} style={[s.segBtn, filter === k && s.segOn]}>
              <Text style={[s.segTxt, filter === k && s.segTxtOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={s.addBtn} onPress={() => setEditing(blankWorker())}>
          <Feather name="user-plus" size={15} color="#fff" /><Text style={s.addTxt}>{tr("إضافة عامل", "Add worker")}</Text>
        </Pressable>
      </View>
      <TextInput style={s.input} value={q} onChangeText={setQ} placeholder={tr("ابحث بالاسم أو رقم الإقامة", "Search by name or iqama number")} placeholderTextColor={Colors.textMuted} textAlign="right" />

      {!shown.length ? (
        <View style={[s.card, { alignItems: "center" }]}>
          <Feather name="users" size={24} color={Colors.textMuted} />
          <Text style={s.muted}>{workers.length ? tr("لا توجد نتائج.", "No results.") : tr("أضف العاملين لمتابعة إقاماتهم ورواتبهم.", "Add your workers to track their iqamas and salaries.")}</Text>
        </View>
      ) : shown.map((w) => (
        <Pressable key={w.id} style={s.card} onPress={() => setEditing(w)}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{w.name}</Text>
              <Text style={s.muted}>{[w.jobTitle, w.nationality, w.iqamaNumber].filter(Boolean).join(" · ") || "—"}</Text>
            </View>
            <Text style={s.salary}>{trf("{n} ر.س", "{n} SAR", { n: monthlyGross(w).toLocaleString("en-US") })}</Text>
          </View>
          <View style={s.chips}>
            {DOC_KINDS.map((k) => {
              const date = w[EXPIRY_FIELD[k]] as string | undefined;
              if (!date && k !== "iqama") return null;
              const st = expiryState(date, today);
              return (
                <View key={k} style={[s.docChip, { borderColor: STATE_COLOR[st] + "60", backgroundColor: STATE_COLOR[st] + "10" }]}>
                  <Text style={[s.docTxt, { color: STATE_COLOR[st] }]}>{docLabel(k)}: {date ? date : tr("غير مُدخلة", "not set")}</Text>
                </View>
              );
            })}
          </View>
        </Pressable>
      ))}

      {editing ? <WorkerForm worker={editing} onClose={() => setEditing(null)} companyId={companyId} /> : null}
    </View>
  );
}

function blankWorker(): HrWorker {
  return { id: "", name: "", basicSalary: 0, housing: 0, transport: 0, otherAllowance: 0, active: true };
}

function WorkerForm({ worker, onClose, companyId }: { worker: HrWorker; onClose: () => void; companyId: string }) {
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(worker)) if (typeof v === "string" || typeof v === "number") o[k] = String(v);
    for (const k of ["basicSalary", "housing", "transport", "otherAllowance"]) if (o[k] === "0") o[k] = "";
    return o;
  });
  const [active, setActive] = useState(worker.active);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string) => (v: string) => { setF((m) => ({ ...m, [k]: v })); setErr(""); };

  const save = async () => {
    if ((f.name ?? "").trim().length < 2) { setErr(tr("اكتب اسم العامل.", "Enter the worker's name.")); return; }
    if (f.iqamaNumber?.trim() && !isValidIqama(f.iqamaNumber)) { setErr(tr("رقم الإقامة ١٠ أرقام ويبدأ بـ ٢.", "The iqama number is 10 digits starting with 2.")); return; }
    const dates: Record<string, string> = {};
    for (const k of ["iqamaExpiry", "passportExpiry", "healthExpiry", "contractExpiry", "startDate"]) {
      const raw = (f[k] ?? "").trim();
      if (!raw) continue;
      const d = parseDateInput(raw);
      if (!d) { setErr(trf("التاريخ غير صحيح: {v}. اكتبه ميلادياً مثل 2026-12-31.", "Invalid date: {v}. Use the Gregorian format, e.g. 2026-12-31.", { v: raw })); return; }
      dates[k] = d;
    }
    setBusy(true);
    try {
      await saveWorker(companyId, {
        id: worker.id, name: f.name.trim(), jobTitle: f.jobTitle, nationality: f.nationality, phone: f.phone,
        iqamaNumber: f.iqamaNumber?.replace(/\s/g, ""), passportNumber: f.passportNumber, bankIban: f.bankIban?.replace(/\s/g, "").toUpperCase(),
        notes: f.notes, createdAt: worker.createdAt, active,
        basicSalary: Number(f.basicSalary) || 0, housing: Number(f.housing) || 0, transport: Number(f.transport) || 0, otherAllowance: Number(f.otherAllowance) || 0,
        ...dates,
      } as HrWorker);
      onClose();
    } catch {
      setErr(tr("تعذّر الحفظ. تحقق من الاتصال وأنك مسجّل كمسؤول الشركة.", "Couldn't save. Check the connection and that you're signed in as the company admin."));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    const msg = trf("حذف ملف «{n}» نهائياً؟ للاحتفاظ بالسجل اجعله «غير نشط» بدلاً من الحذف.", "Delete “{n}” permanently? To keep the record, mark it inactive instead.", { n: worker.name });
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(msg)) return;
    setBusy(true);
    try { await deleteWorker(companyId, worker.id); onClose(); } catch { setErr(tr("تعذّر الحذف.", "Couldn't delete.")); } finally { setBusy(false); }
  };

  const F = ({ k, label, ph, num, ltr }: { k: string; label: string; ph?: string; num?: boolean; ltr?: boolean }) => (
    <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={[s.input, ltr && { textAlign: "left" }]} value={f[k] ?? ""} onChangeText={set(k)} placeholder={ph} placeholderTextColor={Colors.textMuted}
        keyboardType={num ? "decimal-pad" : "default"} textAlign={ltr ? "left" : "right"} editable={!busy} />
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.rowBetween}>
            <Text style={s.big}>{worker.id ? worker.name : tr("عامل جديد", "New worker")}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={Colors.textSecondary} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            <Text style={s.section}>{tr("البيانات الأساسية", "Basic details")}</Text>
            <View style={s.grid}>
              {F({ k: "name", label: tr("الاسم", "Name") })}
              {F({ k: "jobTitle", label: tr("المهنة", "Job title"), ph: tr("مثل: حلواني", "e.g. pastry chef") })}
            </View>
            <View style={s.grid}>
              {F({ k: "nationality", label: tr("الجنسية", "Nationality") })}
              {F({ k: "phone", label: tr("الجوال", "Phone"), ph: "05XXXXXXXX", ltr: true })}
            </View>
            <Text style={s.section}>{tr("الوثائق وتواريخ الانتهاء (ميلادي)", "Documents and expiry dates (Gregorian)")}</Text>
            <View style={s.grid}>
              {F({ k: "iqamaNumber", label: tr("رقم الإقامة", "Iqama number"), ph: "2XXXXXXXXX", ltr: true })}
              {F({ k: "iqamaExpiry", label: tr("انتهاء الإقامة", "Iqama expiry"), ph: "2026-12-31", ltr: true })}
            </View>
            <View style={s.grid}>
              {F({ k: "passportNumber", label: tr("رقم الجواز", "Passport number"), ltr: true })}
              {F({ k: "passportExpiry", label: tr("انتهاء الجواز", "Passport expiry"), ph: "2027-06-30", ltr: true })}
            </View>
            <View style={s.grid}>
              {F({ k: "healthExpiry", label: tr("انتهاء الشهادة الصحية", "Health certificate expiry"), ph: "2026-12-31", ltr: true })}
              {F({ k: "contractExpiry", label: tr("انتهاء العقد", "Contract expiry"), ph: "2027-01-31", ltr: true })}
            </View>
            <Text style={s.section}>{tr("الراتب الشهري (ر.س)", "Monthly salary (SAR)")}</Text>
            <View style={s.grid}>
              {F({ k: "basicSalary", label: tr("الأساسي", "Basic"), num: true, ltr: true })}
              {F({ k: "housing", label: tr("بدل السكن", "Housing"), num: true, ltr: true })}
            </View>
            <View style={s.grid}>
              {F({ k: "transport", label: tr("بدل النقل", "Transport"), num: true, ltr: true })}
              {F({ k: "otherAllowance", label: tr("بدلات أخرى", "Other allowances"), num: true, ltr: true })}
            </View>
            <View style={s.grid}>
              {F({ k: "bankIban", label: tr("الآيبان (اختياري)", "IBAN (optional)"), ph: "SA…", ltr: true })}
              {F({ k: "startDate", label: tr("تاريخ المباشرة", "Start date"), ph: "2025-01-15", ltr: true })}
            </View>
            {F({ k: "notes", label: tr("ملاحظات", "Notes") })}
            <View style={s.rowBetween}>
              <Text style={s.label}>{tr("على رأس العمل", "Currently employed")}</Text>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.success, false: Colors.border }} />
            </View>
            {err ? <Text style={s.err}>{err}</Text> : null}
          </ScrollView>
          <View style={s.rowBetween}>
            {worker.id ? (
              <Pressable onPress={remove} disabled={busy} style={s.delBtn}><Feather name="trash-2" size={15} color={Colors.accent} /></Pressable>
            ) : null}
            <Pressable onPress={save} disabled={busy} style={[s.saveBtn, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Feather name="check" size={16} color="#fff" />}
              <Text style={s.addTxt}>{tr("حفظ", "Save")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight, padding: 14, gap: 8 },
  rowBetween: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  big: { fontSize: 18, fontWeight: "900", color: Colors.text, textAlign: "right", flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: Colors.text, textAlign: "right" },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  section: { fontSize: 13, fontWeight: "900", color: Colors.primary, textAlign: "right", marginTop: 6 },
  label: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, textAlign: "right" },
  err: { color: Colors.accent, fontSize: 13, fontWeight: "700", textAlign: "right" },
  alertRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight },
  alertName: { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  waBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.success, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row-reverse", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 3, flexShrink: 1 },
  segBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  segOn: { backgroundColor: Colors.surface },
  segTxt: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" },
  segTxtOn: { color: Colors.text, fontWeight: "900" },
  addBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 12, minHeight: 40, paddingHorizontal: 12 },
  addTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#FAFAF8", paddingHorizontal: 12, color: Colors.text, fontSize: 14 },
  salary: { fontSize: 14, fontWeight: "900", color: Colors.text },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  docChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  docTxt: { fontSize: 11, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 620, maxHeight: "92%", alignSelf: "center", backgroundColor: Colors.surface, borderRadius: 22, padding: 18, gap: 12 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  saveBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, minHeight: 48 },
  delBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: Colors.accent + "55", alignItems: "center", justifyContent: "center" },
});
