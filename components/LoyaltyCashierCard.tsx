import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { LoyaltySettings, nextTier, pointsFor, pointsValue, tierFor } from "@/constants/loyalty";
import type { LoyaltyAccount } from "@/lib/loyalty";
import { tr, trf } from "@/lib/i18n";

const TIER_COLOR: Record<string, string> = { silver: "#8E8E8A", gold: "#C9962B", platinum: "#5B6B73" };

/**
 * Counter view of the customer's loyalty: tier, balance, what this invoice earns,
 * and a one-tap switch to pay part of it with points.
 */
export function LoyaltyCashierCard({
  settings, account, loading, phoneKey, payable, redeemPoints, useRedeem, onToggle, dark,
}: {
  settings: LoyaltySettings;
  account: LoyaltyAccount | null;
  loading: boolean;
  phoneKey: string;
  /** Goods total after manual discounts (insurance excluded). */
  payable: number;
  /** Points that would be redeemed if the switch is on. */
  redeemPoints: number;
  useRedeem: boolean;
  onToggle: () => void;
  dark?: boolean;
}) {
  if (!settings.enabled || !phoneKey) return null;
  const balance = Math.max(0, Math.floor(account?.points ?? 0));
  const spent = account?.lifetimeSpent ?? 0;
  const tier = tierFor(spent, settings);
  const next = nextTier(spent, settings);
  const value = pointsValue(redeemPoints, settings);
  const earnBase = Math.max(0, payable - (useRedeem ? value : 0));
  const willEarn = pointsFor(earnBase, settings, tier);
  const c = dark ? darkC : lightC;

  return (
    <View style={[s.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={s.row}>
        <View style={[s.badge, { backgroundColor: (TIER_COLOR[tier.id] ?? Colors.gold) + "22" }]}>
          <Feather name="award" size={15} color={TIER_COLOR[tier.id] ?? Colors.gold} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[s.title, { color: c.text }]}>
            {account ? trf("عضو {t}", "{t} member", { t: tr(tier.name) }) : tr("عميل جديد في برنامج الولاء", "New loyalty member")}
          </Text>
          <Text style={[s.sub, { color: c.muted }]} numberOfLines={1}>
            {loading ? tr("جارٍ جلب الرصيد…", "Loading balance…") : trf("الرصيد {b} نقطة = {v} ر.س", "Balance {b} pts = {v} SAR", { b: balance, v: pointsValue(balance, settings).toFixed(2) })}
            {next && account ? trf(" · {r} ر.س للفئة {t}", " · {r} SAR to {t}", { r: next.remaining, t: tr(next.tier.name) }) : ""}
          </Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={Colors.gold} /> : null}
      </View>

      {redeemPoints > 0 ? (
        <Pressable
          style={[s.redeem, { borderColor: useRedeem ? Colors.gold : c.border, backgroundColor: useRedeem ? Colors.gold + "14" : "transparent" }]}
          onPress={() => { Haptics.selectionAsync(); onToggle(); }}
          accessibilityRole="switch"
          accessibilityState={{ checked: useRedeem }}
        >
          <Feather name={useRedeem ? "check-square" : "square"} size={16} color={useRedeem ? Colors.gold : c.muted} />
          <Text style={[s.redeemTxt, { color: c.text }]}>
            {trf("استخدام {p} نقطة — خصم {v} ر.س", "Use {p} points — {v} SAR off", { p: redeemPoints, v: value.toFixed(2) })}
          </Text>
        </Pressable>
      ) : balance > 0 ? (
        <Text style={[s.note, { color: c.muted }]}>
          {trf("الاستبدال يبدأ من {n} نقطة", "Redemption starts at {n} points", { n: settings.minRedeemPoints })}
        </Text>
      ) : null}

      {willEarn > 0 && (
        <Text style={[s.earn, { color: Colors.success }]}>{trf("+{n} نقطة على هذه الفاتورة", "+{n} points on this invoice", { n: willEarn })}</Text>
      )}
    </View>
  );
}

const lightC = { bg: Colors.surface, border: Colors.borderLight, text: Colors.text, muted: Colors.textSecondary };
const darkC = { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", text: "#fff", muted: "rgba(255,255,255,0.55)" };

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  badge: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontWeight: "700", textAlign: "right" },
  sub: { fontSize: 11, textAlign: "right" },
  redeem: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10 },
  redeemTxt: { flex: 1, fontSize: 12, fontWeight: "700", textAlign: "right" },
  note: { fontSize: 11, textAlign: "right" },
  earn: { fontSize: 11, fontWeight: "700", textAlign: "right" },
});
