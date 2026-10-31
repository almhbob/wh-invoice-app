import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { DEPT_COLOR } from "@/utils/orderFlow";
import { FactoryDept, WindowOrderStage } from "@/utils/windowOrders";

const DEPT_KEY = {
  cake: "deptCakeShort", halwa: "deptHalwaShort", mawali: "deptMawaliShort", chocolate: "deptChocolateShort", packaging: "deptPackagingShort",
} as const;

export function DeptName({ dept, small }: { dept: FactoryDept; small?: boolean }) {
  const { t } = useLang();
  return (
    <View style={st.row}>
      <View style={[st.dot, { backgroundColor: DEPT_COLOR[dept] }]} />
      <Text style={[small ? st.small : st.label]}>{t(DEPT_KEY[dept])}</Text>
    </View>
  );
}

export function stageLabel(stage: WindowOrderStage) {
  switch (stage) {
    case "sent": return tr("بانتظار المصنع", "Waiting for factory");
    case "preparing": return tr("قيد التحضير", "Preparing");
    case "ready": return tr("جاهزة للإرسال", "Ready to dispatch");
    case "dispatched": return tr("في الطريق للنافذة", "On the way");
    case "received": return tr("استُلمت كاملة", "Received in full");
    case "received_short": return tr("استُلمت مع نقص", "Received short");
  }
}

export const STAGE_COLOR: Record<WindowOrderStage, string> = {
  sent: Colors.textSecondary,
  preparing: Colors.warning,
  ready: Colors.info,
  dispatched: Colors.gold,
  received: Colors.success,
  received_short: Colors.accent,
};

export function StageBadge({ stage }: { stage: WindowOrderStage }) {
  const c = STAGE_COLOR[stage];
  return (
    <View style={[st.badge, { backgroundColor: c + "16" }]}>
      <Text style={[st.badgeTxt, { color: c }]}>{stageLabel(stage)}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: "900", color: Colors.textSecondary },
  small: { fontSize: 12, fontWeight: "700", color: Colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { fontSize: 12, fontWeight: "800" },
});
