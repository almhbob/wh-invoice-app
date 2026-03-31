import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";

// ─── Types ────────────────────────────────────────────────────────────────
export type LinkCategory =
  | "subscription"
  | "firebase"
  | "store"
  | "hosting"
  | "payment"
  | "support"
  | "other";

export interface SubLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  category: LinkCategory;
  isPrimary?: boolean;
  createdAt: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────
const PIN_KEY = "@dev_pin_v1";
const LINKS_KEY = "@dev_links_v1";
const DEFAULT_PIN = "1234";

// ─── Category config ──────────────────────────────────────────────────────
const CAT_CONFIG: Record<LinkCategory, { label: string; icon: string; color: string }> = {
  subscription: { label: "الاشتراك",    icon: "credit-card",  color: "#8E44AD" },
  payment:      { label: "الدفع",        icon: "dollar-sign",  color: "#27AE60" },
  firebase:     { label: "Firebase",     icon: "database",     color: "#F5A623" },
  store:        { label: "المتجر",       icon: "shopping-bag", color: "#2980B9" },
  hosting:      { label: "الاستضافة",    icon: "server",       color: "#1A5276" },
  support:      { label: "الدعم",        icon: "life-buoy",    color: "#E74C3C" },
  other:        { label: "أخرى",         icon: "link",         color: "#7F8C8D" },
};

const CAT_ORDER: LinkCategory[] = [
  "subscription", "payment", "firebase", "store", "hosting", "support", "other",
];

// ─── Seed links ───────────────────────────────────────────────────────────
const SEED_LINKS: Omit<SubLink, "id" | "createdAt">[] = [
  {
    title: "Firebase Console — المشروع",
    url: "https://console.firebase.google.com/project/wh-cake-chocolate",
    description: "إدارة Firestore وقواعد الأمان والتخزين",
    category: "firebase",
    isPrimary: true,
  },
  {
    title: "Firebase Billing",
    url: "https://console.firebase.google.com/project/wh-cake-chocolate/usage/details",
    description: "مراقبة الاستهلاك والترقية إلى Blaze",
    category: "payment",
  },
  {
    title: "Expo Application Services",
    url: "https://expo.dev/accounts",
    description: "إدارة النشر والتحديثات والاشتراك",
    category: "hosting",
    isPrimary: true,
  },
  {
    title: "Google Play Console",
    url: "https://play.google.com/console",
    description: "نشر وإدارة التطبيق على متجر أندرويد",
    category: "store",
  },
  {
    title: "Apple Developer",
    url: "https://developer.apple.com/account",
    description: "نشر وإدارة التطبيق على App Store",
    category: "store",
  },
];

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────
function PinPad({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    if (Platform.OS !== "web") Vibration.vibrate([0, 60, 60, 60]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => setDigits([]));
  };

  const press = async (d: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...digits, d];
    setDigits(next);
    setError(false);
    if (next.length === 4) {
      const stored = (await AsyncStorage.getItem(PIN_KEY)) ?? DEFAULT_PIN;
      if (next.join("") === stored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      } else {
        setError(true);
        shake();
      }
    }
  };

  const del = () => {
    Haptics.selectionAsync();
    setDigits((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <View style={pin.container}>
      <TouchableOpacity style={pin.closeBtn} onPress={onClose}>
        <Feather name="x" size={20} color="#fff" />
      </TouchableOpacity>

      <View style={pin.lockIcon}>
        <Feather name="lock" size={32} color={Colors.gold} />
      </View>
      <Text style={pin.title}>لوحة المطور</Text>
      <Text style={pin.sub}>أدخل رمز الوصول</Text>

      {/* Dots */}
      <Animated.View style={[pin.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              pin.dot,
              digits.length > i && pin.dotFilled,
              error && pin.dotError,
            ]}
          />
        ))}
      </Animated.View>
      {error && <Text style={pin.errorText}>رمز خاطئ — حاول مجدداً</Text>}

      {/* Keypad */}
      <View style={pin.keypad}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
          k === "" ? (
            <View key={i} style={pin.keyEmpty} />
          ) : k === "⌫" ? (
            <TouchableOpacity key={i} style={pin.keyBtn} onPress={del}>
              <Feather name="delete" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              key={i}
              style={[pin.keyBtn, digits.length >= 4 && pin.keyDisabled]}
              onPress={() => digits.length < 4 && press(k)}
              disabled={digits.length >= 4}
            >
              <Text style={pin.keyText}>{k}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
    </View>
  );
}

// ─── Link Form ────────────────────────────────────────────────────────────
function LinkForm({
  link,
  onSave,
  onCancel,
}: {
  link?: SubLink | null;
  onSave: (data: Omit<SubLink, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [description, setDescription] = useState(link?.description ?? "");
  const [category, setCategory] = useState<LinkCategory>(link?.category ?? "subscription");
  const [isPrimary, setIsPrimary] = useState(link?.isPrimary ?? false);

  const save = () => {
    if (!title.trim()) { Alert.alert("خطأ", "أدخل عنوان الرابط"); return; }
    if (!url.trim() || !url.startsWith("http")) {
      Alert.alert("خطأ", "أدخل رابطاً صحيحاً يبدأ بـ http");
      return;
    }
    onSave({ title: title.trim(), url: url.trim(), description: description.trim() || undefined, category, isPrimary });
  };

  const cat = CAT_CONFIG[category];
  return (
    <View style={form.container}>
      <View style={form.header}>
        <TouchableOpacity onPress={onCancel} style={form.cancelBtn}>
          <Feather name="x" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={form.title}>{link ? "تعديل الرابط" : "إضافة رابط جديد"}</Text>
        <TouchableOpacity onPress={save} style={form.saveBtn}>
          <Text style={form.saveBtnText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={form.body} showsVerticalScrollIndicator={false}>
        <Text style={form.label}>العنوان *</Text>
        <TextInput
          style={form.input}
          value={title}
          onChangeText={setTitle}
          placeholder="مثال: اشتراك Firebase Blaze"
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />

        <Text style={form.label}>الرابط (URL) *</Text>
        <TextInput
          style={form.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
          textAlign="left"
        />

        <Text style={form.label}>وصف (اختياري)</Text>
        <TextInput
          style={[form.input, { height: 70, textAlignVertical: "top" }]}
          value={description}
          onChangeText={setDescription}
          placeholder="وصف مختصر للرابط..."
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />

        <Text style={form.label}>التصنيف</Text>
        <View style={form.catGrid}>
          {CAT_ORDER.map((c) => {
            const cfg = CAT_CONFIG[c];
            const isActive = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[form.catChip, isActive && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                onPress={() => { Haptics.selectionAsync(); setCategory(c); }}
              >
                <Feather name={cfg.icon as any} size={13} color={isActive ? "#fff" : cfg.color} />
                <Text style={[form.catText, isActive && { color: "#fff" }]}>{cfg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={form.primaryRow} onPress={() => { Haptics.selectionAsync(); setIsPrimary(!isPrimary); }}>
          <View style={[form.checkbox, isPrimary && { backgroundColor: Colors.gold, borderColor: Colors.gold }]}>
            {isPrimary && <Feather name="check" size={12} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={form.primaryTitle}>رابط مميز</Text>
            <Text style={form.primarySub}>يظهر في أعلى القائمة مع تمييز بصري</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Dev Settings Panel ───────────────────────────────────────────────────
function DevPanel({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [links, setLinks] = useState<SubLink[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubLink | null>(null);
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => { loadLinks(); }, []);

  const loadLinks = async () => {
    const stored = await AsyncStorage.getItem(LINKS_KEY);
    if (stored) {
      setLinks(JSON.parse(stored));
    } else {
      const seeded: SubLink[] = SEED_LINKS.map((l) => ({
        ...l,
        id: makeId(),
        createdAt: new Date().toISOString(),
      }));
      setLinks(seeded);
      await AsyncStorage.setItem(LINKS_KEY, JSON.stringify(seeded));
    }
  };

  const saveLinks = async (updated: SubLink[]) => {
    await AsyncStorage.setItem(LINKS_KEY, JSON.stringify(updated));
    setLinks(updated);
  };

  const handleSave = async (data: Omit<SubLink, "id" | "createdAt">) => {
    if (editing) {
      const updated = links.map((l) =>
        l.id === editing.id ? { ...l, ...data } : l
      );
      await saveLinks(updated);
    } else {
      const newLink: SubLink = { ...data, id: makeId(), createdAt: new Date().toISOString() };
      await saveLinks([newLink, ...links]);
    }
    setShowForm(false);
    setEditing(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (link: SubLink) => {
    Alert.alert("حذف الرابط", `هل تريد حذف "${link.title}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: async () => {
          await saveLinks(links.filter((l) => l.id !== link.id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert("خطأ", "لا يمكن فتح هذا الرابط");
    } catch {
      Alert.alert("خطأ", "فشل في فتح الرابط");
    }
  };

  const changePin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert("خطأ", "الرمز يجب أن يكون 4 أرقام"); return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("خطأ", "الرمزان غير متطابقان"); return;
    }
    await AsyncStorage.setItem(PIN_KEY, newPin);
    setShowChangePIN(false); setNewPin(""); setConfirmPin("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("✓", "تم تغيير رمز الوصول بنجاح");
  };

  // Group by category
  const grouped = CAT_ORDER.reduce<Record<string, SubLink[]>>((acc, cat) => {
    const catLinks = links
      .filter((l) => l.category === cat)
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    if (catLinks.length > 0) acc[cat] = catLinks;
    return acc;
  }, {});

  if (showForm) {
    return (
      <View style={[panel.container, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
        <LinkForm
          link={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      </View>
    );
  }

  return (
    <View style={[panel.container, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      {/* Header */}
      <View style={panel.header}>
        <TouchableOpacity style={panel.closeBtn} onPress={onClose}>
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={panel.headerCenter}>
          <Feather name="settings" size={18} color={Colors.gold} />
          <Text style={panel.headerTitle}>إعدادات المطور</Text>
        </View>
        <TouchableOpacity
          style={panel.addBtn}
          onPress={() => { setEditing(null); setShowForm(true); }}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={panel.addBtnText}>إضافة</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[panel.body, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* App info */}
        <View style={panel.infoCard}>
          <View style={panel.infoRow}>
            <Feather name="zap" size={14} color={Colors.gold} />
            <Text style={panel.infoLabel}>المشروع</Text>
            <Text style={panel.infoVal}>W&H Cake & Chocolate</Text>
          </View>
          <View style={panel.infoDivider} />
          <View style={panel.infoRow}>
            <Feather name="database" size={14} color="#F5A623" />
            <Text style={panel.infoLabel}>Firebase</Text>
            <Text style={panel.infoVal} numberOfLines={1}>wh-cake-chocolate</Text>
          </View>
          <View style={panel.infoDivider} />
          <View style={panel.infoRow}>
            <Feather name="code" size={14} color={Colors.textMuted} />
            <Text style={panel.infoLabel}>الإصدار</Text>
            <Text style={panel.infoVal}>v1.0.0</Text>
          </View>
        </View>

        {/* Links by category */}
        {Object.keys(grouped).length === 0 ? (
          <View style={panel.empty}>
            <Feather name="link" size={36} color={Colors.textMuted} />
            <Text style={panel.emptyText}>لا توجد روابط — اضغط "إضافة"</Text>
          </View>
        ) : (
          CAT_ORDER.filter((c) => grouped[c]).map((cat) => {
            const cfg = CAT_CONFIG[cat];
            return (
              <View key={cat} style={panel.group}>
                <View style={[panel.groupHeader, { borderLeftColor: cfg.color }]}>
                  <View style={[panel.groupIcon, { backgroundColor: cfg.color + "20" }]}>
                    <Feather name={cfg.icon as any} size={13} color={cfg.color} />
                  </View>
                  <Text style={[panel.groupTitle, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={panel.groupCount}>{grouped[cat].length}</Text>
                </View>

                {grouped[cat].map((link) => (
                  <View key={link.id} style={[panel.linkCard, link.isPrimary && panel.linkCardPrimary]}>
                    {link.isPrimary && (
                      <View style={panel.primaryBadge}>
                        <Feather name="star" size={9} color={Colors.gold} />
                        <Text style={panel.primaryBadgeText}>مميز</Text>
                      </View>
                    )}
                    <View style={panel.linkTop}>
                      <Text style={panel.linkTitle} numberOfLines={1}>{link.title}</Text>
                      <View style={panel.linkActions}>
                        <TouchableOpacity
                          style={[panel.actionBtn, { backgroundColor: cfg.color + "20" }]}
                          onPress={() => openLink(link.url)}
                          hitSlop={6}
                        >
                          <Feather name="external-link" size={14} color={cfg.color} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[panel.actionBtn, { backgroundColor: Colors.primary + "20" }]}
                          onPress={() => { setEditing(link); setShowForm(true); }}
                          hitSlop={6}
                        >
                          <Feather name="edit-2" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[panel.actionBtn, { backgroundColor: Colors.accent + "20" }]}
                          onPress={() => handleDelete(link)}
                          hitSlop={6}
                        >
                          <Feather name="trash-2" size={14} color={Colors.accent} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {link.description && (
                      <Text style={panel.linkDesc} numberOfLines={2}>{link.description}</Text>
                    )}
                    <Text style={panel.linkUrl} numberOfLines={1}>{link.url}</Text>
                  </View>
                ))}
              </View>
            );
          })
        )}

        {/* Change PIN section */}
        <View style={panel.pinSection}>
          <View style={panel.pinHeader}>
            <Feather name="lock" size={14} color={Colors.textSecondary} />
            <Text style={panel.pinTitle}>رمز الوصول</Text>
            <TouchableOpacity
              onPress={() => setShowChangePIN(!showChangePIN)}
              style={panel.pinToggle}
            >
              <Text style={panel.pinToggleText}>
                {showChangePIN ? "إلغاء" : "تغيير الرمز"}
              </Text>
            </TouchableOpacity>
          </View>

          {showChangePIN && (
            <View style={panel.pinForm}>
              <Text style={panel.pinLabel}>الرمز الجديد (4 أرقام)</Text>
              <TextInput
                style={panel.pinInput}
                value={newPin}
                onChangeText={setNewPin}
                placeholder="••••"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                textAlign="center"
              />
              <Text style={panel.pinLabel}>تأكيد الرمز</Text>
              <TextInput
                style={panel.pinInput}
                value={confirmPin}
                onChangeText={setConfirmPin}
                placeholder="••••"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                textAlign="center"
              />
              <TouchableOpacity style={panel.pinSaveBtn} onPress={changePin}>
                <Feather name="check" size={15} color="#fff" />
                <Text style={panel.pinSaveBtnText}>حفظ الرمز الجديد</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Export: DevSettingsModal ────────────────────────────────────────
export function DevSettingsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"pin" | "panel">("pin");

  useEffect(() => {
    if (visible) setStage("pin");
  }, [visible]);

  const handleClose = () => {
    setStage("pin");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {stage === "pin" ? (
        <PinPad onSuccess={() => setStage("panel")} onClose={handleClose} />
      ) : (
        <DevPanel onClose={handleClose} />
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const pin = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  closeBtn: {
    position: "absolute", top: 50, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  lockIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.gold + "20",
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1, borderColor: Colors.gold + "40",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 6 },
  sub: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 32 },
  dots: { flexDirection: "row", gap: 14, marginBottom: 12 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "transparent",
  },
  dotFilled: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  dotError: { borderColor: Colors.accent },
  errorText: { color: Colors.accent, fontSize: 13, marginBottom: 8 },
  keypad: {
    marginTop: 16, width: 280,
    flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center",
  },
  keyBtn: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  keyEmpty: { width: 78, height: 78 },
  keyDisabled: { opacity: 0.3 },
  keyText: { fontSize: 26, fontWeight: "600", color: "#fff" },
});

const form = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1C35" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === "ios" ? 56 : 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  cancelBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fff" },
  saveBtn: {
    backgroundColor: Colors.gold, paddingHorizontal: 16,
    paddingVertical: 7, borderRadius: 20,
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  label: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  input: {
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#fff", backgroundColor: "rgba(255,255,255,0.06)",
  },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  catText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  primaryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  primaryTitle: { fontSize: 14, fontWeight: "600", color: "#fff" },
  primarySub: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 },
});

const panel = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1C35" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0F1C35",
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.gold, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  body: { padding: 16, gap: 16 },
  // Info card
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoLabel: { flex: 1, fontSize: 12, color: "rgba(255,255,255,0.5)" },
  infoVal: { fontSize: 13, fontWeight: "600", color: "#fff", maxWidth: 200 },
  infoDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 10 },
  // Group
  group: { gap: 8 },
  groupHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderLeftWidth: 3, paddingLeft: 10,
  },
  groupIcon: {
    width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center",
  },
  groupTitle: { flex: 1, fontSize: 13, fontWeight: "700" },
  groupCount: {
    fontSize: 11, color: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  // Link card
  linkCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    gap: 5,
  },
  linkCardPrimary: {
    borderColor: Colors.gold + "40",
    backgroundColor: Colors.gold + "08",
  },
  primaryBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end",
    backgroundColor: Colors.gold + "20",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  primaryBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.gold },
  linkTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  linkTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },
  linkActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  linkDesc: { fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 17 },
  linkUrl: { fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  // Empty
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: "rgba(255,255,255,0.4)" },
  // PIN section
  pinSection: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  pinHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  pinTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  pinToggle: {
    backgroundColor: Colors.primary + "80",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  pinToggleText: { fontSize: 12, fontWeight: "600", color: Colors.gold },
  pinForm: { gap: 10 },
  pinLabel: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  pinInput: {
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12, paddingVertical: 12,
    fontSize: 20, color: "#fff",
    backgroundColor: "rgba(255,255,255,0.06)",
    letterSpacing: 10,
  },
  pinSaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 12,
    marginTop: 4,
  },
  pinSaveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
