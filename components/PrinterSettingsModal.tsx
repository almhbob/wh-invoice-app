import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { usePrinter } from "@/context/PrinterContext";
import type { PaperSize, PrinterConnectionMode } from "@/context/PrinterContext";

// ─── Sub-components ────────────────────────────────────────────────────────────

type Tab = "connection" | "paper" | "test";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "connection", label: "الاتصال",  icon: "wifi" },
    { key: "paper",      label: "الورق",    icon: "file-text" },
    { key: "test",       label: "الاختبار", icon: "play-circle" },
  ];
  return (
    <View style={s.tabBar}>
      {tabs.map((tab) => {
        const active_ = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabItem, active_ && s.tabItemActive]}
            onPress={() => onChange(tab.key)}
          >
            <Feather name={tab.icon as any} size={16} color={active_ ? Colors.surface : Colors.textSecondary} />
            <Text style={[s.tabLabel, active_ && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Connection mode card ──────────────────────────────────────────────────────

function ModeCard({
  mode, label, subtitle, icon, active, onPress,
}: {
  mode: PrinterConnectionMode; label: string; subtitle: string;
  icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.modeCard, active && s.modeCardActive]} onPress={onPress}>
      <View style={[s.modeIcon, active && s.modeIconActive]}>
        <Feather name={icon as any} size={24} color={active ? Colors.surface : Colors.textSecondary} />
      </View>
      <View style={s.modeTexts}>
        <Text style={[s.modeLabel, active && s.modeLabelActive]}>{label}</Text>
        <Text style={s.modeSub}>{subtitle}</Text>
      </View>
      {active && (
        <View style={s.modeCheck}>
          <Feather name="check-circle" size={18} color={Colors.success} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, subtitle, value, onChange }: {
  label: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {subtitle ? <Text style={s.toggleSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.borderLight, true: Colors.primary + "60" }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

// ── Paper size button ─────────────────────────────────────────────────────────

function PaperBtn({ size, label, sub, active, onPress }: {
  size: PaperSize; label: string; sub: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.paperBtn, active && s.paperBtnActive]} onPress={onPress}>
      <Feather
        name="file-text"
        size={20}
        color={active ? Colors.surface : Colors.textSecondary}
        style={{ marginBottom: 6 }}
      />
      <Text style={[s.paperBtnLabel, active && s.paperBtnLabelActive]}>{label}</Text>
      <Text style={[s.paperBtnSub, active && { color: Colors.surface + "cc" }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, message }: { status: string; message: string }) {
  const colors: Record<string, { bg: string; fg: string; icon: string }> = {
    idle:       { bg: Colors.borderLight,         fg: Colors.textMuted,     icon: "minus-circle" },
    connecting: { bg: Colors.warning + "20",      fg: Colors.warning,       icon: "loader" },
    connected:  { bg: Colors.success + "20",      fg: Colors.success,       icon: "check-circle" },
    error:      { bg: Colors.accent + "20",       fg: Colors.accent,        icon: "alert-circle" },
  };
  const c = colors[status] ?? colors.idle;
  return (
    <View style={[s.statusBadge, { backgroundColor: c.bg }]}>
      <Feather name={c.icon as any} size={18} color={c.fg} />
      <Text style={[s.statusText, { color: c.fg }]}>
        {message || (status === "idle" ? "غير متصل" : status === "connected" ? "متصل" : status)}
      </Text>
    </View>
  );
}

// ─── Tab: Connection ───────────────────────────────────────────────────────────

function ConnectionTab() {
  const { settings, status, statusMessage, bluetoothSupported, updateSettings, connectBluetooth, disconnectBluetooth, testWifiConnection } = usePrinter();
  const [loading, setLoading] = useState(false);

  const handleBluetooth = async () => {
    if (status === "connected" && settings.bluetoothDeviceId) {
      disconnectBluetooth();
      return;
    }
    setLoading(true);
    try {
      await connectBluetooth();
    } catch (err: any) {
      Alert.alert("فشل الاتصال", err?.message ?? "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  const handleWifiTest = async () => {
    setLoading(true);
    try {
      await testWifiConnection();
    } catch (err: any) {
      Alert.alert("فشل الاتصال", err?.message ?? "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.tabContent} contentContainerStyle={{ gap: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionLabel}>اختر طريقة الاتصال</Text>

      <ModeCard
        mode="browser"
        label="طباعة المتصفح"
        subtitle="يعمل مع أي طابعة متصلة بالنظام (USB، شبكة، إلخ)"
        icon="monitor"
        active={settings.connectionMode === "browser"}
        onPress={() => updateSettings({ connectionMode: "browser" })}
      />
      <ModeCard
        mode="wifi"
        label="شبكة لاسلكية / Ethernet"
        subtitle="اتصال مباشر بالطابعة عبر IP (WebSocket)"
        icon="wifi"
        active={settings.connectionMode === "wifi"}
        onPress={() => updateSettings({ connectionMode: "wifi" })}
      />
      <ModeCard
        mode="bluetooth"
        label="بلوتوث BLE"
        subtitle="طابعات حرارية لاسلكية تعمل عبر البلوتوث"
        icon="bluetooth"
        active={settings.connectionMode === "bluetooth"}
        onPress={() => updateSettings({ connectionMode: "bluetooth" })}
      />

      {/* WiFi config */}
      {settings.connectionMode === "wifi" && (
        <View style={s.configBox}>
          <Text style={s.configTitle}>إعداد الاتصال الشبكي</Text>
          <View style={s.inputRow}>
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>عنوان IP</Text>
              <TextInput
                style={s.input}
                value={settings.wifiIp}
                onChangeText={(v) => updateSettings({ wifiIp: v })}
                placeholder="192.168.1.100"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="left"
              />
            </View>
            <View style={[s.inputWrap, { flex: 0, width: 90 }]}>
              <Text style={s.inputLabel}>المنفذ</Text>
              <TextInput
                style={s.input}
                value={settings.wifiPort}
                onChangeText={(v) => updateSettings({ wifiPort: v })}
                placeholder="9100"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                textAlign="center"
              />
            </View>
          </View>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: Colors.info }]}
            onPress={handleWifiTest}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Feather name="zap" size={16} color="#fff" />}
            <Text style={s.actionBtnText}>اختبار الاتصال</Text>
          </TouchableOpacity>
          <Text style={s.hint}>
            💡 المنفذ الافتراضي للطابعات الحرارية عبر الشبكة هو 9100. تأكد من أن الطابعة تدعم WebSocket أو استخدم خادم طباعة وسيط.
          </Text>
        </View>
      )}

      {/* Bluetooth config */}
      {settings.connectionMode === "bluetooth" && (
        <View style={s.configBox}>
          <Text style={s.configTitle}>إعداد اتصال البلوتوث</Text>
          {!bluetoothSupported && (
            <View style={s.warnBox}>
              <Feather name="alert-triangle" size={16} color={Colors.warning} />
              <Text style={s.warnText}>
                Web Bluetooth غير مدعوم — استخدم Chrome أو Edge على سطح المكتب
              </Text>
            </View>
          )}
          {settings.bluetoothDeviceName ? (
            <View style={s.pairedBox}>
              <Feather name="bluetooth" size={16} color={Colors.success} />
              <Text style={s.pairedName}>{settings.bluetoothDeviceName}</Text>
              <Text style={s.pairedLabel}>مقترن</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              s.actionBtn,
              status === "connected" && settings.bluetoothDeviceId
                ? { backgroundColor: Colors.accent }
                : { backgroundColor: Colors.purple },
            ]}
            onPress={handleBluetooth}
            disabled={loading || !bluetoothSupported}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Feather name={status === "connected" && settings.bluetoothDeviceId ? "x-circle" : "bluetooth"} size={16} color="#fff" />}
            <Text style={s.actionBtnText}>
              {status === "connected" && settings.bluetoothDeviceId ? "قطع الاتصال" : "اختيار طابعة بلوتوث"}
            </Text>
          </TouchableOpacity>
          <Text style={s.hint}>
            💡 مدعوم: Zjiang، XP-series، طابعات POS-58/80، وغيرها من الطابعات الحرارية التي تدعم GATT BLE.
          </Text>
        </View>
      )}

      {/* Browser mode info */}
      {settings.connectionMode === "browser" && (
        <View style={s.configBox}>
          <Feather name="info" size={16} color={Colors.info} style={{ marginBottom: 6 }} />
          <Text style={[s.hint, { marginTop: 0 }]}>
            في هذا الوضع، تُفتح نافذة معاينة الفاتورة ثم تنقر على "طباعة" لتختار الطابعة من نظام التشغيل. يعمل مع أي طابعة مثبّتة (USB، شبكة، بلوتوث).
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Tab: Paper ────────────────────────────────────────────────────────────────

function PaperTab() {
  const { settings, updateSettings } = usePrinter();

  return (
    <ScrollView style={s.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionLabel}>حجم ورق الطابعة</Text>
      <View style={s.paperRow}>
        <PaperBtn
          size="80mm"
          label="80 ملم"
          sub="حراري عريض"
          active={settings.paperSize === "80mm"}
          onPress={() => updateSettings({ paperSize: "80mm" })}
        />
        <PaperBtn
          size="58mm"
          label="58 ملم"
          sub="حراري صغير"
          active={settings.paperSize === "58mm"}
          onPress={() => updateSettings({ paperSize: "58mm" })}
        />
        <PaperBtn
          size="a4"
          label="A4"
          sub="ورق عادي"
          active={settings.paperSize === "a4"}
          onPress={() => updateSettings({ paperSize: "a4" })}
        />
      </View>

      <Text style={s.sectionLabel}>إعدادات الطباعة</Text>

      <View style={s.configBox}>
        {/* Copies */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.toggleLabel}>عدد النسخ</Text>
            <Text style={s.toggleSub}>عدد نسخ الفاتورة عند كل طباعة</Text>
          </View>
          <View style={s.counter}>
            <TouchableOpacity
              style={s.counterBtn}
              onPress={() => updateSettings({ copies: Math.max(1, settings.copies - 1) })}
            >
              <Feather name="minus" size={14} color={Colors.text} />
            </TouchableOpacity>
            <Text style={s.counterVal}>{settings.copies}</Text>
            <TouchableOpacity
              style={s.counterBtn}
              onPress={() => updateSettings({ copies: Math.min(5, settings.copies + 1) })}
            >
              <Feather name="plus" size={14} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.divider} />

        <ToggleRow
          label="قطع الورق تلقائياً"
          subtitle="إرسال أمر القطع بعد كل فاتورة (ESC/POS)"
          value={settings.cutPaper}
          onChange={(v) => updateSettings({ cutPaper: v })}
        />

        <View style={s.divider} />

        <ToggleRow
          label="فتح درج النقود"
          subtitle="إرسال أمر فتح الدرج بعد الطباعة"
          value={settings.openCashDrawer}
          onChange={(v) => updateSettings({ openCashDrawer: v })}
        />
      </View>

      <View style={s.infoCard}>
        <Feather name="info" size={15} color={Colors.info} />
        <Text style={s.infoText}>
          إعدادات القطع وفتح الدرج تنطبق فقط على وضعَي WiFi والبلوتوث (ESC/POS). في وضع المتصفح تُستخدَم إعدادات الطابعة المحلية.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Tab: Test ─────────────────────────────────────────────────────────────────

function TestTab() {
  const { settings, status, statusMessage, testPrint, printHtml } = usePrinter();
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (settings.connectionMode === "browser") {
      const html = buildTestHtml();
      printHtml(html);
      return;
    }
    setLoading(true);
    try {
      await testPrint();
      Alert.alert("تمت الطباعة ✓", "تم إرسال صفحة الاختبار إلى الطابعة");
    } catch (err: any) {
      Alert.alert("فشلت الطباعة", err?.message ?? "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionLabel}>حالة الاتصال</Text>
      <StatusBadge status={status} message={statusMessage} />

      <View style={s.summaryBox}>
        <SummaryRow label="طريقة الاتصال" value={modeLabel(settings.connectionMode)} />
        <SummaryRow label="حجم الورق"      value={paperLabel(settings.paperSize)} />
        <SummaryRow label="عدد النسخ"      value={`${settings.copies}`} />
        {settings.connectionMode === "wifi" && (
          <SummaryRow label="عنوان الطابعة" value={`${settings.wifiIp}:${settings.wifiPort}`} />
        )}
        {settings.connectionMode === "bluetooth" && settings.bluetoothDeviceName && (
          <SummaryRow label="الجهاز المقترن" value={settings.bluetoothDeviceName} />
        )}
      </View>

      <TouchableOpacity style={s.testBtn} onPress={handleTest} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Feather name="printer" size={20} color="#fff" />}
        <Text style={s.testBtnText}>طباعة صفحة اختبار</Text>
      </TouchableOpacity>

      <View style={s.supportedBox}>
        <Text style={s.supportedTitle}>الطابعات المدعومة</Text>
        {SUPPORTED_PRINTERS.map((p) => (
          <View key={p.brand} style={s.supportedRow}>
            <Feather name="check" size={13} color={Colors.success} />
            <Text style={s.supportedText}>
              <Text style={{ fontWeight: "700" }}>{p.brand}</Text> — {p.note}
            </Text>
          </View>
        ))}
        <Text style={[s.hint, { marginTop: 8 }]}>
          أي طابعة تدعم بروتوكول ESC/POS عبر BLE أو TCP/WebSocket ستعمل مع هذا التطبيق.
        </Text>
      </View>
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

// ─── Data helpers ──────────────────────────────────────────────────────────────

function modeLabel(mode: PrinterConnectionMode) {
  return mode === "browser" ? "طباعة المتصفح" : mode === "wifi" ? "WiFi / شبكة" : "بلوتوث BLE";
}

function paperLabel(size: PaperSize) {
  return size === "80mm" ? "٨٠ ملم حراري" : size === "58mm" ? "٥٨ ملم حراري" : "A4 عادي";
}

const SUPPORTED_PRINTERS = [
  { brand: "Zjiang / ZJ-5802", note: "بلوتوث BLE، 58mm" },
  { brand: "XP-58 / XP-80",   note: "WiFi، بلوتوث، USB" },
  { brand: "POS-80",           note: "WiFi (TCP 9100)، بلوتوث" },
  { brand: "EPSON TM-series",  note: "WiFi، USB (via browser)" },
  { brand: "Star Micronics",   note: "WiFi، بلوتوث، USB" },
  { brand: "أي ESC/POS",       note: "عبر WebSocket / BLE GATT" },
];

function buildTestHtml(): string {
  const now = new Date().toLocaleString("ar-SA");
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: "Courier New", monospace; font-size: 12px; text-align: center; direction: rtl; }
    h2 { font-size: 16px; margin: 4px 0; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    p { margin: 2px 0; }
  </style></head><body>
  <h2>اختبار الطابعة</h2>
  <p>Test Print OK ✓</p>
  <hr/>
  <p>${now}</p>
  <hr/>
  <p>النظام يعمل بشكل صحيح</p>
  <br/><br/>
  </body></html>`;
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PrinterSettingsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("connection");

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={[s.backdrop]}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIcon}>
                <Feather name="printer" size={18} color={Colors.surface} />
              </View>
              <View>
                <Text style={s.headerTitle}>إعدادات الطابعة</Text>
                <Text style={s.headerSub}>ربط وضبط الطابعة</Text>
              </View>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === "connection" && <ConnectionTab />}
          {activeTab === "paper"      && <PaperTab />}
          {activeTab === "test"       && <TestTab />}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "90%", paddingTop: 0, overflow: "hidden",
  },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: Colors.surface },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 1 },
  closeBtn:    { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },

  // Tabs
  tabBar: { flexDirection: "row", backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabItemActive: { backgroundColor: Colors.primary },
  tabLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  tabLabelActive: { color: Colors.surface },

  tabContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Section label
  sectionLabel: { fontSize: 12, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },

  // Mode card
  modeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  modeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  modeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  modeIconActive: { backgroundColor: Colors.primary },
  modeTexts: { flex: 1 },
  modeLabel: { fontSize: 14, fontWeight: "700", color: Colors.text },
  modeLabelActive: { color: Colors.primary },
  modeSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  modeCheck: { marginLeft: 4 },

  // Config box
  configBox: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 12 },
  configTitle: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 4 },

  // Inputs
  inputRow: { flexDirection: "row", gap: 10 },
  inputWrap: { flex: 1, gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    borderWidth: 1, borderColor: Colors.borderLight,
  },

  // Action button
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Hint
  hint: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 4 },

  // Warn box
  warnBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: Colors.warning + "15", borderRadius: 10, padding: 10 },
  warnText: { flex: 1, fontSize: 12, color: Colors.warning, lineHeight: 17 },

  // Paired device
  pairedBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.success + "12", borderRadius: 10, padding: 10 },
  pairedName: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text },
  pairedLabel: { fontSize: 12, fontWeight: "600", color: Colors.success },

  // Toggle
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: Colors.text },
  toggleSub: { fontSize: 12, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  // Counter
  counter: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  counterVal: { fontSize: 16, fontWeight: "800", color: Colors.text, minWidth: 24, textAlign: "center" },

  // Paper buttons
  paperRow: { flexDirection: "row", gap: 10 },
  paperBtn: {
    flex: 1, alignItems: "center", paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  paperBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  paperBtnLabel: { fontSize: 14, fontWeight: "800", color: Colors.text },
  paperBtnLabelActive: { color: Colors.surface },
  paperBtnSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  // Status badge
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14 },
  statusText: { fontSize: 14, fontWeight: "700", flex: 1 },

  // Summary
  summaryBox: { backgroundColor: Colors.surface, borderRadius: 14, overflow: "hidden" },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: "700", color: Colors.text },

  // Test button
  testBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  testBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  // Supported printers
  supportedBox: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14 },
  supportedTitle: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 10 },
  supportedRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  supportedText: { fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Info card
  infoCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: Colors.info + "12", borderRadius: 12, padding: 12 },
  infoText: { flex: 1, fontSize: 12, color: Colors.info, lineHeight: 18 },
});
