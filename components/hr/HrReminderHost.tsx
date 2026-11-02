import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useHrWorkers } from "@/hooks/useHr";
import { ringAlert } from "@/hooks/useNewOrderAlert";
import { tr, trf } from "@/lib/i18n";
import { DEFAULT_WARN_DAYS, expiryAlerts } from "@/utils/hr";
import { riyadhDate } from "@/utils/windowOrders";
import { docLabel } from "@/components/hr/HrStaffPanel";

/**
 * Once a day, tell the company admin about staff documents (iqama, passport,
 * health certificate, contract) that expire within 10 days or already expired.
 */
export function HrReminderHost() {
  const router = useRouter();
  const { companyId } = useCompany();
  const { workers, loading, isAdmin } = useHrWorkers();
  const today = riyadhDate();
  const alerts = useMemo(() => expiryAlerts(workers, today, DEFAULT_WARN_DAYS), [workers, today]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAdmin || loading || !alerts.length) return;
    const key = `@hr_reminded_${companyId}_${today}`;
    let done = false;
    try { done = Platform.OS === "web" && localStorage.getItem(key) === "1"; } catch { /* storage blocked */ }
    if (done) return;
    try { if (Platform.OS === "web") localStorage.setItem(key, "1"); } catch { /* storage blocked */ }
    const first = alerts[0];
    ringAlert(
      trf("{n} وثيقة عمالة تحتاج متابعة", "{n} staff documents need attention", { n: alerts.length }),
      `${first.name} · ${docLabel(first.kind)} · ${first.date}`,
      "hr-expiry"
    );
    setShow(true);
  }, [alerts, companyId, isAdmin, loading, today]);

  if (!show || !alerts.length) return null;
  const expired = alerts.filter((a) => a.state === "expired").length;
  return (
    <View pointerEvents="box-none" style={st.wrap}>
      <Pressable style={st.toast} onPress={() => { setShow(false); router.push({ pathname: "/admin", params: { tab: "hr" } } as never); }}>
        <View style={st.icon}><Feather name="alert-triangle" size={18} color={expired ? "#FF9C8F" : Colors.goldLight} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.title} numberOfLines={1}>
            {expired
              ? trf("{e} منتهية و{s} تنتهي خلال {d} أيام", "{e} expired, {s} expiring within {d} days", { e: expired, s: alerts.length - expired, d: DEFAULT_WARN_DAYS })
              : trf("{n} وثيقة تنتهي خلال {d} أيام", "{n} documents expire within {d} days", { n: alerts.length, d: DEFAULT_WARN_DAYS })}
          </Text>
          <Text style={st.body} numberOfLines={1}>{alerts.slice(0, 3).map((a) => `${a.name} (${docLabel(a.kind)})`).join("، ")}</Text>
        </View>
        <Text style={st.open}>{tr("فتح", "Open")}</Text>
        <Pressable hitSlop={10} onPress={() => setShow(false)}><Feather name="x" size={16} color="rgba(255,255,255,0.6)" /></Pressable>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center", paddingHorizontal: 12, zIndex: 9998 },
  toast: { width: "100%", maxWidth: 560, flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: Colors.primary, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "right" },
  body: { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "right" },
  open: { color: Colors.goldLight, fontSize: 13, fontWeight: "800" },
});
