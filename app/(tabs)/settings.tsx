import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { RELEASE_INFO } from "@/constants/releaseInfo";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { usePrinter } from "@/context/PrinterContext";
import type { Lang } from "@/constants/translations";

// ── Language options ──────────────────────────────────────────────────────────

const LANG_OPTIONS: { code: Lang; label: string; nativeName: string }[] = [
  { code: "ar", label: "Arabic",   nativeName: "العربية" },
  { code: "en", label: "English",  nativeName: "English" },
  { code: "ur", label: "Urdu",     nativeName: "اردو" },
  { code: "hi", label: "Hindi",    nativeName: "हिंदी" },
  { code: "bn", label: "Bengali",  nativeName: "বাংলা" },
];

const CONNECTION_MODE_LABELS: Record<string, string> = {
  browser:   "متصفح (طباعة HTML)",
  bluetooth: "بلوتوث",
  wifi:      "واي فاي (IP)",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SettingsRow({
  icon,
  iconBg,
  label,
  value,
  onPress,
  showChevron = true,
  destructive = false,
  isLast = false,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  isLast?: boolean;
}) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={16} color="#fff" />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      ) : null}
      {showChevron && (
        <Feather
          name="chevron-left"
          size={16}
          color={destructive ? Colors.accent : Colors.textMuted}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ── Language picker modal ──────────────────────────────────────────────────────

function LangPickerModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: Lang;
  onSelect: (lang: Lang) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>اختر اللغة</Text>
        {LANG_OPTIONS.map((opt, idx) => {
          const isActive = opt.code === current;
          return (
            <TouchableOpacity
              key={opt.code}
              style={[
                styles.langOption,
                idx < LANG_OPTIONS.length - 1 && styles.langOptionBorder,
                isActive && styles.langOptionActive,
              ]}
              onPress={() => { onSelect(opt.code); onClose(); }}
              activeOpacity={0.7}
            >
              <View style={styles.langOptionLeft}>
                <Text style={[styles.langNativeName, isActive && { color: Colors.gold }]}>
                  {opt.nativeName}
                </Text>
                <Text style={styles.langEnName}>{opt.label}</Text>
              </View>
              {isActive && (
                <Feather name="check" size={18} color={Colors.gold} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { lang, setLang } = useLang();
  const { currentEmployee, setCurrentEmployee } = useEmployee();
  const { company, companyId } = useCompany();
  const { settings: printerSettings, testPrint, status: printerStatus } = usePrinter();

  const [showLangPicker, setShowLangPicker] = useState(false);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "ios" ? insets.bottom + 80 : 80;

  // ── Derived display values ─────────────────────────────────────────────────

  const empFirstLetter = currentEmployee?.name?.trim().charAt(0).toUpperCase() ?? "؟";
  const empName        = currentEmployee?.name   ?? "—";
  const empRole        = currentEmployee?.role   ?? "—";
  const empId          = currentEmployee?.employeeId ?? "—";
  const companyName    = company.name ?? "—";

  const currentLangLabel = LANG_OPTIONS.find((o) => o.code === lang)?.nativeName ?? lang;
  const printerModeLabel = CONNECTION_MODE_LABELS[printerSettings.connectionMode] ?? printerSettings.connectionMode;
  const printerStatusColor =
    printerStatus === "connected" ? Colors.success :
    printerStatus === "error"     ? Colors.accent   :
    printerStatus === "connecting"? Colors.warning   :
    Colors.textMuted;

  // ── App version ───────────────────────────────────────────────────────────

  // Extract a human-readable version: "2026.06.01" from full string
  const rawVersion = RELEASE_INFO.version ?? "1.0.0";
  const appVersion = rawVersion.split("-")[0] ?? rawVersion;

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleLogout() {
    Alert.alert(
      "تسجيل الخروج",
      `هل تريد تسجيل خروج "${empName}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: () => setCurrentEmployee(null),
        },
      ]
    );
  }

  function handleTestPrint() {
    testPrint().catch((err: Error) => {
      Alert.alert("خطأ في الطباعة", err?.message ?? "تعذّر إجراء طباعة تجريبية");
    });
  }

  function handleSupport() {
    const phone = "966500000000"; // placeholder — replace with actual support number
    const url = `https://wa.me/${phone}`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      {/* Screen title bar */}
      <View style={styles.titleBar}>
        <Text style={styles.titleBarText}>الإعدادات</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile card ────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatarWrap}>
            <Text style={styles.profileAvatarText}>{empFirstLetter}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{empName}</Text>
            <Text style={styles.profileRole}>{empRole}</Text>
            <Text style={styles.profileEmpId}>#{empId}</Text>
          </View>
          <Text style={styles.profileCompany}>{companyName}</Text>
        </View>

        {/* ── Language & Region ────────────────────────────────────── */}
        <SectionHeader title="اللغة والمنطقة" />
        <SettingsCard>
          <SettingsRow
            icon="globe"
            iconBg="#2563eb"
            label="اللغة"
            value={currentLangLabel}
            onPress={() => setShowLangPicker(true)}
            isLast
          />
        </SettingsCard>

        {/* ── Printing ─────────────────────────────────────────────── */}
        <SectionHeader title="الطباعة" />
        <SettingsCard>
          <SettingsRow
            icon="printer"
            iconBg={Colors.primaryLight}
            label="نوع الاتصال"
            value={printerModeLabel}
            showChevron={false}
          />
          <SettingsRow
            icon="wifi"
            iconBg={printerStatusColor}
            label="الحالة"
            value={
              printerStatus === "connected"  ? "متصل ✓" :
              printerStatus === "connecting" ? "جاري الاتصال..." :
              printerStatus === "error"      ? "خطأ في الاتصال" :
              "غير متصل"
            }
            showChevron={false}
          />
          <SettingsRow
            icon="zap"
            iconBg={Colors.gold}
            label="طباعة تجريبية"
            onPress={handleTestPrint}
            isLast
          />
        </SettingsCard>

        {/* ── About ────────────────────────────────────────────────── */}
        <SectionHeader title="حول التطبيق" />
        <SettingsCard>
          <SettingsRow
            icon="info"
            iconBg={Colors.primary}
            label="اسم التطبيق"
            value="فاتورة"
            showChevron={false}
          />
          <SettingsRow
            icon="tag"
            iconBg="#6d28d9"
            label="الإصدار"
            value={appVersion}
            showChevron={false}
          />
          <SettingsRow
            icon="briefcase"
            iconBg={Colors.textMuted}
            label="رقم الشركة"
            value={companyId}
            showChevron={false}
          />
          <SettingsRow
            icon="message-circle"
            iconBg="#25D366"
            label="تواصل مع الدعم"
            onPress={handleSupport}
            isLast
          />
        </SettingsCard>

        {/* ── Session / danger zone ────────────────────────────────── */}
        <SectionHeader title="الجلسة" />
        <SettingsCard>
          <SettingsRow
            icon="log-out"
            iconBg={Colors.accent}
            label="تسجيل الخروج"
            onPress={currentEmployee ? handleLogout : undefined}
            destructive
            isLast
          />
        </SettingsCard>
      </ScrollView>

      {/* Language picker modal */}
      <LangPickerModal
        visible={showLangPicker}
        current={lang}
        onSelect={setLang}
        onClose={() => setShowLangPicker(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // Title bar
  titleBar: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "flex-end",
  },
  titleBarText: {
    color: Colors.gold,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 4,
  },

  // Profile card
  profileCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  profileAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
  },
  profileAvatarText: {
    fontSize: 36,
    fontWeight: "900",
    color: Colors.primary,
  },
  profileInfo: {
    alignItems: "center",
    gap: 3,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  profileRole: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: "600",
    textAlign: "center",
  },
  profileEmpId: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 2,
  },
  profileCompany: {
    marginTop: 14,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 10,
    alignSelf: "stretch",
    textAlignVertical: "center",
  },

  // Section header
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 8,
    textAlign: "right",
    paddingHorizontal: 4,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Row
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "right",
  },
  rowLabelDestructive: {
    color: Colors.accent,
  },
  rowValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500",
    maxWidth: 140,
    textAlign: "left",
  },

  // Language picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "right",
    marginBottom: 14,
  },
  langOption: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 16,
    gap: 14,
  },
  langOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  langOptionActive: {
    // subtle highlight via text color, no background needed
  },
  langOptionLeft: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  langNativeName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  langEnName: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
