import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChocolateCardType = "card" | "choco_large" | "choco_small";

export interface ChocolateCardValue {
  type: ChocolateCardType;
  quantity: number;
  message: string;
}

export interface ChocolateCardItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  department: "chocolate";
  note?: string;
}

export function buildChocoItems(val: ChocolateCardValue | null): ChocolateCardItem[] {
  if (!val) return [];
  const base = { id: `choco-${Date.now()}`, department: "chocolate" as const, note: val.message.trim() || undefined };
  if (val.type === "card")        return [{ ...base, name: "كرت هدية", quantity: 1, price: 0 }];
  if (val.type === "choco_large") return [{ ...base, name: "لوح شوكلاتة كبير", quantity: 1, price: 15 }];
  if (val.type === "choco_small") return [{ ...base, name: "لوح شوكلاتة صغير", quantity: val.quantity, price: 5 }];
  return [];
}

export function chocoCardTotal(val: ChocolateCardValue | null): number {
  if (!val) return 0;
  if (val.type === "card")        return 0;
  if (val.type === "choco_large") return 15;
  if (val.type === "choco_small") return 5 * val.quantity;
  return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  value: ChocolateCardValue | null;
  onChange: (v: ChocolateCardValue | null) => void;
  compact?: boolean;
}

export function ChocolateCardSection({ value, onChange, compact = false }: Props) {
  const { t } = useLang();
  const enabled = value !== null;

  function toggle() {
    Haptics.selectionAsync();
    if (enabled) {
      onChange(null);
    } else {
      onChange({ type: "card", quantity: 1, message: "" });
    }
  }

  function setType(type: ChocolateCardType) {
    Haptics.selectionAsync();
    onChange({ type, quantity: type === "choco_small" ? 1 : 1, message: value?.message ?? "" });
  }

  function setQty(delta: number) {
    if (!value || value.type !== "choco_small") return;
    Haptics.selectionAsync();
    const next = Math.max(1, Math.min(4, value.quantity + delta));
    onChange({ ...value, quantity: next });
  }

  const total = chocoCardTotal(value);

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      {/* Toggle header */}
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.8}>
        <View style={[styles.iconBox, enabled && styles.iconBoxActive]}>
          <Feather name="gift" size={16} color={enabled ? "#fff" : Colors.chocolate} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, enabled && styles.titleActive]}>{t("chocoCardTitle")}</Text>
          {!enabled && <Text style={styles.hint}>{t("chocoCardHint")}</Text>}
          {enabled && total > 0 && (
            <Text style={styles.totalBadge}>+{total.toFixed(0)} ر.س</Text>
          )}
          {enabled && total === 0 && (
            <Text style={[styles.totalBadge, { color: Colors.success }]}>{t("chocoCardFree")}</Text>
          )}
        </View>
        <View style={[styles.toggle, enabled && styles.toggleOn]}>
          <View style={[styles.thumb, enabled && styles.thumbOn]} />
        </View>
      </TouchableOpacity>

      {/* Options panel */}
      {enabled && value && (
        <View style={styles.panel}>
          {/* Type selector */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, value.type === "card" && styles.typeBtnActive]}
              onPress={() => setType("card")}
              activeOpacity={0.8}
            >
              <Feather name="credit-card" size={15} color={value.type === "card" ? "#fff" : Colors.chocolate} />
              <Text style={[styles.typeBtnText, value.type === "card" && styles.typeBtnTextActive]}>
                {t("chocoCardTypeCard")}
              </Text>
              <Text style={[styles.typeBtnSub, value.type === "card" && styles.typeBtnSubActive]}>
                {t("chocoCardFree")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, (value.type === "choco_large" || value.type === "choco_small") && styles.typeBtnActive]}
              onPress={() => setType("choco_large")}
              activeOpacity={0.8}
            >
              <Feather name="box" size={15} color={(value.type === "choco_large" || value.type === "choco_small") ? "#fff" : Colors.chocolate} />
              <Text style={[styles.typeBtnText, (value.type === "choco_large" || value.type === "choco_small") && styles.typeBtnTextActive]}>
                {t("chocoCardTypeChoco")}
              </Text>
              <Text style={[styles.typeBtnSub, (value.type === "choco_large" || value.type === "choco_small") && styles.typeBtnSubActive]}>
                5–15 ر.س
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chocolate size selector */}
          {(value.type === "choco_large" || value.type === "choco_small") && (
            <View style={styles.sizeRow}>
              <TouchableOpacity
                style={[styles.sizeBtn, value.type === "choco_large" && styles.sizeBtnActive]}
                onPress={() => setType("choco_large")}
                activeOpacity={0.8}
              >
                <Text style={[styles.sizeBtnText, value.type === "choco_large" && styles.sizeBtnTextActive]}>
                  {t("chocoCardLarge")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sizeBtn, value.type === "choco_small" && styles.sizeBtnActive]}
                onPress={() => setType("choco_small")}
                activeOpacity={0.8}
              >
                <Text style={[styles.sizeBtnText, value.type === "choco_small" && styles.sizeBtnTextActive]}>
                  {t("chocoCardSmall")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quantity picker for small chocolate */}
          {value.type === "choco_small" && (
            <View style={styles.qtySection}>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>{t("chocoCardSmallMax")}</Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, value.quantity <= 1 && styles.qtyBtnDisabled]}
                    onPress={() => setQty(-1)}
                    disabled={value.quantity <= 1}
                    activeOpacity={0.8}
                  >
                    <Feather name="minus" size={15} color={value.quantity <= 1 ? Colors.textMuted : Colors.chocolate} />
                  </TouchableOpacity>
                  <View style={styles.qtyDisplay}>
                    <Text style={styles.qtyNum}>{value.quantity}</Text>
                    <Text style={styles.qtyUnit}>{t("chocoCardPcs")}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.qtyBtn, value.quantity >= 4 && styles.qtyBtnDisabled, styles.qtyBtnAdd]}
                    onPress={() => setQty(1)}
                    disabled={value.quantity >= 4}
                    activeOpacity={0.8}
                  >
                    <Feather name="plus" size={15} color={value.quantity >= 4 ? Colors.textMuted : "#fff"} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Price preview */}
              <View style={styles.pricePreview}>
                <Text style={styles.pricePreviewText}>
                  {value.quantity} × 5 ر.س = <Text style={styles.pricePreviewTotal}>{(value.quantity * 5).toFixed(0)} ر.س</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Message field */}
          <View style={styles.messageSection}>
            <Text style={styles.messageLabel}>{t("chocoCardMessage")}</Text>
            <TextInput
              style={styles.messageInput}
              value={value.message}
              onChangeText={(text) => onChange({ ...value, message: text })}
              placeholder={t("chocoCardMsgHint")}
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlign="right"
              textAlignVertical="top"
              maxLength={200}
            />
            {value.message.length > 0 && (
              <Text style={styles.charCount}>{value.message.length}/200</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden",
    borderWidth: 1.5, borderColor: Colors.chocolate + "30",
    shadowColor: Colors.chocolate, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  wrapperCompact: { borderRadius: 14 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.chocolate + "18", borderWidth: 1.5, borderColor: Colors.chocolate + "30",
  },
  iconBoxActive: { backgroundColor: Colors.chocolate, borderColor: Colors.chocolate },
  title: { fontSize: 14, fontWeight: "700", color: Colors.text },
  titleActive: { color: Colors.chocolate },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  totalBadge: { fontSize: 12, fontWeight: "800", color: Colors.chocolate, marginTop: 1 },
  toggle: {
    width: 46, height: 26, borderRadius: 13, backgroundColor: Colors.border,
    padding: 2, justifyContent: "center",
  },
  toggleOn: { backgroundColor: Colors.chocolate },
  thumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
    alignSelf: "flex-start",
  },
  thumbOn: { alignSelf: "flex-end" },

  panel: {
    borderTopWidth: 1, borderTopColor: Colors.chocolate + "20",
    backgroundColor: Colors.chocolate + "04",
    padding: 14, gap: 12,
  },

  // type selector
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1, alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: Colors.chocolate + "40", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: Colors.surface,
  },
  typeBtnActive: { borderColor: Colors.chocolate, backgroundColor: Colors.chocolate },
  typeBtnText: { fontSize: 13, fontWeight: "700", color: Colors.chocolate },
  typeBtnTextActive: { color: "#fff" },
  typeBtnSub: { fontSize: 11, color: Colors.textMuted },
  typeBtnSubActive: { color: "rgba(255,255,255,0.75)" },

  // size buttons
  sizeRow: { flexDirection: "row", gap: 8 },
  sizeBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.chocolate + "40",
    backgroundColor: Colors.surface,
  },
  sizeBtnActive: { borderColor: Colors.chocolate, backgroundColor: Colors.chocolate + "12" },
  sizeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  sizeBtnTextActive: { color: Colors.chocolate, fontWeight: "700" },

  // quantity
  qtySection: { gap: 6 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qtyLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: Colors.chocolate + "50",
    backgroundColor: Colors.surface,
  },
  qtyBtnAdd: { backgroundColor: Colors.chocolate, borderColor: Colors.chocolate },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyDisplay: { alignItems: "center", minWidth: 44 },
  qtyNum: { fontSize: 20, fontWeight: "900", color: Colors.chocolate },
  qtyUnit: { fontSize: 10, color: Colors.textMuted },
  pricePreview: { alignItems: "flex-end" },
  pricePreviewText: { fontSize: 13, color: Colors.textSecondary },
  pricePreviewTotal: { fontWeight: "800", color: Colors.chocolate },

  // message
  messageSection: { gap: 6 },
  messageLabel: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  messageInput: {
    borderWidth: 1, borderColor: Colors.chocolate + "40", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.background,
    minHeight: 80, maxHeight: 120,
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: "left" },
});
