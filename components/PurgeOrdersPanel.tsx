import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useOrders } from "@/context/OrdersContext";
import { db } from "@/lib/firebase";
import { tr, trf } from "@/lib/i18n";
import { countCompanyData, exportCompanyData, PurgeCounts, PurgeOptions, purgeCompanyData } from "@/lib/purge";

const CONFIRM_WORD = "احذف الكل";

function downloadJson(name: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }
  return false;
}

function Check({ on, label, hint, onPress, disabled }: { on: boolean; label: string; hint?: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[s.check, disabled && { opacity: 0.7 }]} onPress={disabled ? undefined : onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }}>
      <Feather name={on ? "check-square" : "square"} size={18} color={on ? Colors.accent : Colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={s.checkTxt}>{label}</Text>
        {hint ? <Text style={s.checkHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Admin-only "danger zone": wipe all orders and reset the archive.
 * Three safeguards: live counts, a mandatory full backup download, and typing a confirmation phrase.
 */
export function PurgeOrdersPanel() {
  const { companyId } = useCompany();
  const { currentEmployee } = useEmployee();
  const { clearLocalOrders } = useOrders();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PurgeOptions>({ orders: true, onlineOrders: true, resetNumbering: true, loyalty: false });
  const [counts, setCounts] = useState<PurgeCounts | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState<"" | "count" | "backup" | "purge">("");
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState<PurgeCounts | null>(null);

  if (currentEmployee?.role !== "admin") return null;
  const by = { name: currentEmployee.name, employeeId: currentEmployee.employeeId };

  const start = async () => {
    setOpen(true); setBackedUp(false); setPhrase(""); setDone(null); setProgress("");
    setBusy("count");
    try { setCounts(await countCompanyData(db, companyId)); } finally { setBusy(""); }
  };

  const backup = async () => {
    setBusy("backup");
    try {
      const data = await exportCompanyData(db, companyId, opts);
      const ok = downloadJson(`laviviane-full-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`, data);
      if (!ok) { Alert.alert(tr("تنبيه", "Notice"), tr("تنزيل النسخة الاحتياطية متاح من المتصفح فقط.", "The backup download works in the web browser only.")); return; }
      setBackedUp(true);
    } catch {
      Alert.alert(tr("تعذّر التنزيل", "Download failed"), tr("تحقق من الاتصال ثم أعد المحاولة.", "Check the connection and try again."));
    } finally { setBusy(""); }
  };

  const purge = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setBusy("purge");
    try {
      const result = await purgeCompanyData(db, companyId, opts, by, (name, n) => setProgress(`${name}: ${n}`));
      await clearLocalOrders();
      setDone(result);
    } catch {
      Alert.alert(tr("توقف الحذف", "Reset stopped"), tr("لم يكتمل الحذف. ما حُذف لا يعود، ويمكنك إعادة المحاولة لإكمال الباقي.", "The reset did not finish. Retry to remove the rest."));
    } finally { setBusy(""); }
  };

  const total = counts ? counts.orders + (opts.onlineOrders ? counts.onlineOrders : 0) + (opts.loyalty ? counts.loyaltyAccounts : 0) : 0;
  const canPurge = backedUp && phrase.trim() === CONFIRM_WORD && !busy;

  return (
    <View style={s.zone}>
      <View style={s.head}>
        <Feather name="alert-octagon" size={18} color={Colors.accent} />
        <Text style={s.title}>{tr("منطقة الخطر", "Danger zone")}</Text>
      </View>
      <Text style={s.desc}>{tr("حذف جميع الطلبات وتصفير الأرشيف والتقارير. لا يمكن التراجع عن هذه العملية.", "Delete every order and reset the archive and reports. This cannot be undone.")}</Text>
      <Pressable style={s.openBtn} onPress={start}>
        <Feather name="trash-2" size={16} color="#fff" />
        <Text style={s.openTxt}>{tr("حذف جميع الطلبات وتصفير الأرشيف", "Delete all orders & reset archive")}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{tr("تصفير الطلبات والأرشيف", "Reset orders & archive")}</Text>
              {!busy && <Pressable onPress={() => setOpen(false)} hitSlop={10}><Feather name="x" size={20} color={Colors.textSecondary} /></Pressable>}
            </View>

            {done ? (
              <View style={{ gap: 12, alignItems: "center", paddingVertical: 10 }}>
                <Feather name="check-circle" size={40} color={Colors.success} />
                <Text style={s.doneTxt}>{trf("تم حذف {n} طلب. الأرشيف والتقارير أصبحت فارغة.", "{n} orders deleted. Archive and reports are now empty.", { n: done.orders })}</Text>
                {done.onlineOrders ? <Text style={s.checkHint}>{trf("وحُذف {n} طلب أونلاين", "and {n} online orders", { n: done.onlineOrders })}</Text> : null}
                <Text style={s.checkHint}>{tr("اطلب من الموظفين تحديث الصفحة على أجهزتهم.", "Ask staff to refresh the app on their devices.")}</Text>
                <Pressable style={s.secondary} onPress={() => setOpen(false)}><Text style={s.secondaryTxt}>{tr("إغلاق", "Close")}</Text></Pressable>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 12 }}>
                <View style={s.counts}>
                  {busy === "count" || !counts ? <ActivityIndicator color={Colors.accent} /> : (
                    <>
                      <Text style={s.countBig}>{total.toLocaleString("ar-SA")}</Text>
                      <Text style={s.checkHint}>{tr("سجل سيُحذف نهائياً", "records will be permanently deleted")}</Text>
                    </>
                  )}
                </View>

                <Check on label={trf("الطلبات ({n})", "Orders ({n})", { n: counts?.orders ?? "…" })} hint={tr("الأرشيف والتقارير والتتبع", "Archive, reports and tracking")} disabled />
                <Check on={opts.onlineOrders} label={trf("طلبات الأونلاين ({n})", "Online orders ({n})", { n: counts?.onlineOrders ?? "…" })} onPress={() => setOpts((o) => ({ ...o, onlineOrders: !o.onlineOrders }))} />
                <Check on={opts.resetNumbering} label={tr("بدء ترقيم الفواتير من 1", "Restart invoice numbers at 1")} onPress={() => setOpts((o) => ({ ...o, resetNumbering: !o.resetNumbering }))} />
                <Check on={opts.loyalty} label={trf("نقاط الولاء للعملاء ({n} عميل)", "Customer loyalty points ({n})", { n: counts?.loyaltyAccounts ?? "…" })} hint={tr("اتركه دون تحديد للإبقاء على أرصدة العملاء", "Leave unticked to keep customer balances")} onPress={() => setOpts((o) => ({ ...o, loyalty: !o.loyalty }))} />
                <Text style={s.keep}>{tr("لا يُحذف: الموظفون، المنتجات، العروض، الإعدادات.", "Kept: employees, products, offers, settings.")}</Text>

                <View style={s.step}>
                  <Text style={s.stepNum}>1</Text>
                  <Pressable style={[s.backupBtn, backedUp && { backgroundColor: Colors.success }]} onPress={backup} disabled={!!busy}>
                    {busy === "backup" ? <ActivityIndicator color="#fff" /> : <Feather name={backedUp ? "check" : "download"} size={16} color="#fff" />}
                    <Text style={s.backupTxt}>{backedUp ? tr("تم تنزيل النسخة الاحتياطية", "Backup downloaded") : tr("تنزيل نسخة احتياطية كاملة (إلزامي)", "Download a full backup (required)")}</Text>
                  </Pressable>
                </View>

                <View style={[s.step, !backedUp && { opacity: 0.4 }]}>
                  <Text style={s.stepNum}>2</Text>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={s.checkTxt}>{trf("اكتب «{w}» للتأكيد", "Type “{w}” to confirm", { w: CONFIRM_WORD })}</Text>
                    <TextInput style={s.input} value={phrase} onChangeText={setPhrase} editable={backedUp && !busy} placeholder={CONFIRM_WORD} placeholderTextColor={Colors.textMuted} textAlign="right" autoCorrect={false} />
                  </View>
                </View>

                <Pressable style={[s.purgeBtn, !canPurge && { opacity: 0.4 }]} onPress={purge} disabled={!canPurge}>
                  {busy === "purge" ? <ActivityIndicator color="#fff" /> : <Feather name="trash-2" size={16} color="#fff" />}
                  <Text style={s.purgeTxt}>{busy === "purge" ? trf("جارٍ الحذف… {p}", "Deleting… {p}", { p: progress }) : tr("حذف نهائي", "Delete permanently")}</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  zone: { marginTop: 16, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.accent + "55", backgroundColor: Colors.accent + "08", padding: 16, gap: 10 },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  title: { color: Colors.accent, fontSize: 15, fontWeight: "800" },
  desc: { color: Colors.textSecondary, fontSize: 12, textAlign: "right", lineHeight: 19 },
  openBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 13 },
  openTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 18 },
  sheet: { backgroundColor: Colors.background, borderRadius: 24, padding: 18, gap: 12, maxHeight: "92%", width: "100%", maxWidth: 520, alignSelf: "center" },
  sheetHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: Colors.text, fontSize: 17, fontWeight: "800" },
  counts: { alignItems: "center", gap: 2, backgroundColor: Colors.accent + "10", borderRadius: 16, paddingVertical: 14 },
  countBig: { color: Colors.accent, fontSize: 30, fontWeight: "800" },
  check: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.borderLight },
  checkTxt: { color: Colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  checkHint: { color: Colors.textMuted, fontSize: 11, textAlign: "right" },
  keep: { color: Colors.success, fontSize: 12, fontWeight: "600", textAlign: "right" },
  step: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, color: "#fff", textAlign: "center", lineHeight: 26, fontWeight: "800", overflow: "hidden" },
  backupBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 12 },
  backupTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface },
  purgeBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14 },
  purgeTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  doneTxt: { color: Colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  secondaryTxt: { color: Colors.text, fontWeight: "700" },
});
