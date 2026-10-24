import { tr, trf } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import type { Order } from "@/context/OrdersContext";
import { DEPT_COLOR } from "@/utils/orderFlow";
import { computePerformance, fmtMinutes, PerfOrder } from "@/utils/performance";

const DEPT_AR: Record<string, string> = { cake: "الكيك", halwa: "الحلا", chocolate: "الشوكولاتة", mawali: "المعجنات", packaging: "التغليف" };
const DEPT_EN: Record<string, string> = { cake: "Cake", halwa: "Sweets", chocolate: "Chocolate", mawali: "Pastry", packaging: "Packaging" };

function Kpi({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLbl}>{label}</Text>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      {hint ? <Text style={s.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

/** Operational KPIs: speed per department, on-time handover, drivers. */
export function PerformanceReport({ filtered }: { filtered: Order[] }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const p = useMemo(() => computePerformance(filtered as unknown as PerfOrder[]), [filtered]);
  const fm = (m: number | null) => fmtMinutes(m, ar ? "ar" : "en");
  const maxWork = Math.max(1, ...p.depts.map((d) => (d.avgWaitMin ?? 0) + (d.avgWorkMin ?? 0)));

  return (
    <View style={{ gap: 14 }}>
      <View style={s.kpiRow}>
        <Kpi label={tr("متوسط التجهيز", "Avg. to ready")} value={fm(p.avgReadyMin)} hint={tr("من الاستلام حتى الجاهزية", "Order → ready")} color={Colors.text} />
        <Kpi
          label={tr("التسليم في الموعد", "On-time handover")}
          value={p.onTimeRate === null ? "—" : `${Math.round(p.onTimeRate * 100)}%`}
          hint={p.lateCount ? trf("{n} متأخر", "{n} late", { n: p.lateCount }) : undefined}
          color={p.onTimeRate === null ? Colors.textMuted : p.onTimeRate >= 0.9 ? Colors.success : p.onTimeRate >= 0.75 ? Colors.warning : Colors.accent}
        />
      </View>

      <View style={s.card}>
        <View style={s.head}>
          <Feather name="layers" size={16} color={Colors.gold} />
          <Text style={s.title}>{tr("سرعة الأقسام", "Department speed")}</Text>
        </View>
        {p.depts.length === 0 ? (
          <Text style={s.empty}>{tr("تظهر الأرقام بعد أن تبدأ الأقسام وتنهي الطلبات من شاشاتها.", "Figures appear once departments start and finish orders on their screens.")}</Text>
        ) : p.depts.map((d) => {
          const wait = d.avgWaitMin ?? 0;
          const work = d.avgWorkMin ?? 0;
          return (
            <View key={d.dept} style={s.deptRow}>
              <View style={s.deptTop}>
                <View style={[s.dot, { backgroundColor: DEPT_COLOR[d.dept] }]} />
                <Text style={s.deptName}>{tr(DEPT_AR[d.dept], DEPT_EN[d.dept])}</Text>
                <Text style={s.deptJobs}>{d.jobs} {tr("طلب", "jobs")}</Text>
              </View>
              <View style={s.bar}>
                <View style={{ flex: wait / maxWork, backgroundColor: Colors.border }} />
                <View style={{ flex: work / maxWork, backgroundColor: DEPT_COLOR[d.dept] }} />
                <View style={{ flex: Math.max(0, 1 - (wait + work) / maxWork) }} />
              </View>
              <Text style={s.deptMeta}>
                {tr("انتظار", "Wait")} {fm(d.avgWaitMin)} · {tr("تحضير", "Work")} {fm(d.avgWorkMin)}
                {d.topWorker ? ` · ${tr("الأكثر إنجازاً", "Top")}: ${d.topWorker.name} (${d.topWorker.jobs})` : ""}
              </Text>
            </View>
          );
        })}
        {p.depts.length > 0 && (
          <View style={s.legend}>
            <View style={[s.dot, { backgroundColor: Colors.border }]} /><Text style={s.legendTxt}>{tr("انتظار قبل البدء", "Waiting to start")}</Text>
            <View style={[s.dot, { backgroundColor: Colors.textSecondary }]} /><Text style={s.legendTxt}>{tr("وقت التحضير", "Preparation")}</Text>
          </View>
        )}
      </View>

      <View style={s.card}>
        <View style={s.head}>
          <Feather name="truck" size={16} color={Colors.gold} />
          <Text style={s.title}>{tr("أداء السائقين", "Drivers")}</Text>
        </View>
        {p.drivers.length === 0 ? (
          <Text style={s.empty}>{tr("لا توجد طلبات توصيل مسندة في هذه الفترة.", "No assigned deliveries in this period.")}</Text>
        ) : p.drivers.map((d) => (
          <View key={d.employeeId} style={s.drvRow}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{d.name.charAt(0)}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.drvName} numberOfLines={1}>{d.name}</Text>
              <Text style={s.drvMeta}>
                {tr("متوسط المشوار", "Avg. ride")} {fm(d.avgRideMin)}
                {d.delivered ? ` · ${tr("في الموعد", "On time")} ${Math.round((d.onTime / d.delivered) * 100)}%` : ""}
                {d.failed ? ` · ${tr("تعذّر", "Failed")} ${d.failed}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={s.drvNum}>{d.delivered}<Text style={s.drvOf}>/{d.assigned}</Text></Text>
              <Text style={s.drvLbl}>{tr("سُلّم", "delivered")}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.note}>
        {trf("محسوبة من {a} طلب مسجّل بخط زمني من أصل {b}. الطلبات الأقدم من نظام التتبع لا تدخل في الحساب.", "Based on {a} of {b} orders with a recorded timeline.", { a: p.withTimeline, b: p.orders })}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row-reverse", gap: 10 },
  kpi: { flex: 1, backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 4, borderWidth: 1, borderColor: Colors.borderLight },
  kpiLbl: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", textAlign: "right" },
  kpiVal: { fontSize: 24, fontWeight: "700", textAlign: "right", letterSpacing: -0.5 },
  kpiHint: { color: Colors.textMuted, fontSize: 11, textAlign: "right" },
  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.borderLight },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  title: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  empty: { color: Colors.textMuted, fontSize: 12, textAlign: "right", lineHeight: 20 },
  deptRow: { gap: 6 },
  deptTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deptName: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  deptJobs: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  bar: { height: 8, borderRadius: 4, overflow: "hidden", flexDirection: "row-reverse", backgroundColor: Colors.surfaceSecondary, gap: 2 },
  deptMeta: { color: Colors.textSecondary, fontSize: 11, textAlign: "right" },
  legend: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" },
  legendTxt: { color: Colors.textMuted, fontSize: 11, marginLeft: 8 },
  drvRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: Colors.goldLight, fontSize: 15, fontWeight: "700" },
  drvName: { color: Colors.text, fontSize: 14, fontWeight: "700", textAlign: "right" },
  drvMeta: { color: Colors.textSecondary, fontSize: 11, textAlign: "right" },
  drvNum: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  drvOf: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  drvLbl: { color: Colors.textMuted, fontSize: 10 },
  note: { color: Colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 18 },
});
