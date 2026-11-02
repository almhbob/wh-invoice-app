import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CameraScanner } from "@/components/CameraScanner";
import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID, buildLavivianeProducts } from "@/constants/lavivianeProducts";
import { useCompany } from "@/context/CompanyContext";
import { Product, useProducts } from "@/context/ProductsContext";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { tr, trf } from "@/lib/i18n";
import { findProductByCode, parseScanInput, searchProducts } from "@/utils/productCodes";

type Feedback =
  | { kind: "added"; name: string; qty: number }
  | { kind: "missing"; code: string }
  | { kind: "unavailable"; name: string };

/**
 * One box for every way of adding by code: a USB/Bluetooth scanner (anywhere on the
 * screen), the phone/tablet camera, or typing the barcode / item number by hand.
 * "3*code" adds three. Typing a name shows matching products to tap.
 */
export function ScanBar({
  onAdd, active = true, onCreateWithCode, compact,
}: {
  onAdd: (product: Product, qty: number) => void;
  /** Listen for a hardware scanner while this screen is in use. */
  active?: boolean;
  /** Shown when a code is unknown and the user may add products. */
  onCreateWithCode?: (code: string) => void;
  compact?: boolean;
}) {
  const { products } = useProducts();
  const { companyId } = useCompany();
  const all = useMemo<Product[]>(
    () => (products.length ? products : companyId === LAVIVIANE_COMPANY_ID ? buildLavivianeProducts() : []),
    [products, companyId]
  );
  const [text, setText] = useState("");
  const [camera, setCamera] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const show = (f: Feedback) => {
    setFeedback(f);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setFeedback(null), f.kind === "added" ? 2500 : 6000);
  };

  const handle = useCallback((raw: string) => {
    const { code, qty } = parseScanInput(raw);
    if (!code) return false;
    const p = findProductByCode(all, code);
    if (!p) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      show({ kind: "missing", code });
      return false;
    }
    if (p.isAvailable === false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      show({ kind: "unavailable", name: p.name });
      return false;
    }
    onAdd(p, qty);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    show({ kind: "added", name: p.name, qty });
    return true;
  }, [all, onAdd]);

  // Hardware scanner anywhere on the screen.
  useBarcodeScanner((code) => { handle(code); }, active && !camera);

  const suggestions = useMemo(() => {
    const t = text.trim();
    if (!t) return [];
    const { code } = parseScanInput(t);
    if (findProductByCode(all, code)) return [];
    return searchProducts(all, t, 5);
  }, [all, text]);

  const submit = () => {
    if (!text.trim()) return;
    if (handle(text)) setText("");
    inputRef.current?.focus();
  };

  const pick = (p: Product) => {
    const { qty } = parseScanInput(text.includes("*") || /[xX×]/.test(text) ? text : "1*x");
    if (p.isAvailable === false) { show({ kind: "unavailable", name: p.name }); return; }
    onAdd(p, qty);
    show({ kind: "added", name: p.name, qty });
    setText("");
    inputRef.current?.focus();
  };

  return (
    <View style={[s.wrap, compact && { marginHorizontal: 0 }]}>
      <View style={s.row}>
        <View style={s.box}>
          <Feather name="maximize" size={17} color={Colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={s.input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            blurOnSubmit={false}
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="characters"
            placeholder={tr("امسح الباركود أو اكتب رقم المنتج", "Scan a barcode or type the item number")}
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
            accessibilityLabel={tr("الباركود أو رقم المنتج", "Barcode or item number")}
            {...(Platform.OS === "web" ? ({ dataSet: { scanTarget: "true" } } as object) : {})}
          />
          {text ? (
            <Pressable onPress={submit} hitSlop={8} style={s.go} accessibilityLabel={tr("إضافة", "Add")}>
              <Feather name="corner-down-left" size={16} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={s.cam} onPress={() => setCamera(true)} accessibilityLabel={tr("مسح بالكاميرا", "Scan with camera")}>
          <Feather name="camera" size={18} color="#fff" />
        </Pressable>
      </View>

      {suggestions.length > 0 && (
        <View style={s.sugs}>
          {suggestions.map((p) => (
            <Pressable key={p.id} style={s.sug} onPress={() => pick(p)}>
              <Text style={[s.sugName, p.isAvailable === false && { color: Colors.textMuted }]} numberOfLines={1}>{p.name}</Text>
              <Text style={s.sugMeta}>{[p.sku, p.barcode].filter(Boolean).join(" · ") || `${p.price} ${tr("ر.س", "SAR")}`}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {feedback && (
        <View style={[s.fb, feedback.kind === "added" ? s.fbOk : feedback.kind === "missing" ? s.fbBad : s.fbWarn]}>
          <Feather
            name={feedback.kind === "added" ? "check-circle" : feedback.kind === "missing" ? "x-circle" : "alert-circle"}
            size={16}
            color={feedback.kind === "added" ? Colors.success : feedback.kind === "missing" ? Colors.accent : Colors.warning}
          />
          <Text style={s.fbTxt} numberOfLines={2}>
            {feedback.kind === "added"
              ? trf("أُضيف: {n} × {q}", "Added: {n} × {q}", { n: feedback.name, q: feedback.qty })
              : feedback.kind === "missing"
              ? trf("لا يوجد منتج بالرمز {c}", "No product with code {c}", { c: feedback.code })
              : trf("{n} غير متوفر حالياً", "{n} is unavailable", { n: feedback.name })}
          </Text>
          {feedback.kind === "missing" && onCreateWithCode && (
            <Pressable style={s.fbBtn} onPress={() => { onCreateWithCode(feedback.code); setFeedback(null); }}>
              <Text style={s.fbBtnTxt}>{tr("إضافة منتج بهذا الرمز", "Add a product with this code")}</Text>
            </Pressable>
          )}
        </View>
      )}

      <CameraScanner visible={camera} continuous onClose={() => setCamera(false)} onDetected={(code) => { handle(code); }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  box: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: 10, letterSpacing: 0.5 },
  go: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  cam: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  sugs: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderLight, overflow: "hidden" },
  sug: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  sugName: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: "600", textAlign: "right" },
  sugMeta: { color: Colors.textMuted, fontSize: 12 },
  fb: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexWrap: "wrap" },
  fbOk: { backgroundColor: Colors.success + "14" },
  fbBad: { backgroundColor: Colors.accent + "12" },
  fbWarn: { backgroundColor: Colors.warning + "16" },
  fbTxt: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: "600", textAlign: "right" },
  fbBtn: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  fbBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
