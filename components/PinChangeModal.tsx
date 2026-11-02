import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/colors";
import { secureAuthErrorText, secureAuthText } from "@/constants/secureAuthText";
import { useLang } from "@/context/LanguageContext";
import { localPinError, SecureAuthFailure } from "@/lib/secureAuth";

interface Props {
  visible: boolean;
  /** "self": the signed-in employee changes their own PIN. "other": a manager sets a temporary PIN. */
  mode: "self" | "other";
  forced?: boolean;
  employeeName?: string;
  /** When provided for "self", the current PIN field is pre-filled and hidden (just typed at login). */
  knownCurrentPin?: string;
  onSubmit: (newPin: string, currentPin?: string) => Promise<void>;
  onCancel: () => void;
}

export function PinChangeModal({ visible, mode, forced, employeeName, knownCurrentPin, onSubmit, onCancel }: Props) {
  const { lang, isRTL } = useLang();
  const tx = (k: Parameters<typeof secureAuthText>[0]) => secureAuthText(k, lang);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setCurrent(""); setPin(""); setConfirm(""); setError(null); setBusy(false); }
  }, [visible]);

  const needCurrent = mode === "self" && !knownCurrentPin;
  const align = isRTL ? "right" : "left";

  const submit = async () => {
    const local = localPinError(pin);
    if (local) { setError(secureAuthErrorText(local, lang)); return; }
    if (pin !== confirm) { setError(tx("pinMismatch")); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin, mode === "self" ? (knownCurrentPin ?? current) : undefined);
    } catch (e) {
      const f = e instanceof SecureAuthFailure ? e : null;
      setError(secureAuthErrorText(f?.code ?? "server_error", lang, f?.retryAfter));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "self" ? tx("changePinTitle") : tx("setPinTitle");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={st.backdrop}>
        <View style={st.card}>
          <View style={st.iconWrap}><Feather name="lock" size={22} color={Colors.gold} /></View>
          <Text style={st.title}>{title}</Text>
          {mode === "self" && forced && <Text style={st.sub}>{tx("changePinForced")}</Text>}
          {mode === "other" && (
            <Text style={st.sub}>{tx("setPinFor")} «{employeeName}». {tx("setPinTempNote")}</Text>
          )}

          {needCurrent && (
            <TextInput style={[st.input, { textAlign: align }]} value={current} onChangeText={setCurrent}
              placeholder={tx("currentPin")} placeholderTextColor={Colors.textMuted}
              secureTextEntry keyboardType="number-pad" maxLength={8} />
          )}
          <TextInput style={[st.input, { textAlign: align }]} value={pin} onChangeText={setPin}
            placeholder={tx("newPin")} placeholderTextColor={Colors.textMuted}
            secureTextEntry keyboardType="number-pad" maxLength={8} />
          <TextInput style={[st.input, { textAlign: align }]} value={confirm} onChangeText={setConfirm}
            placeholder={tx("confirmPin")} placeholderTextColor={Colors.textMuted}
            secureTextEntry keyboardType="number-pad" maxLength={8} onSubmitEditing={submit} />

          {!!error && <Text style={st.error}>{error}</Text>}

          <View style={st.row}>
            <Pressable style={[st.btn, st.btnGhost]} onPress={onCancel} disabled={busy}>
              <Text style={st.btnGhostTxt}>{forced ? tx("logout") : tx("cancel")}</Text>
            </Pressable>
            <Pressable style={[st.btn, st.btnPrimary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.btnPrimaryTxt}>{tx("save")}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  card:         { width: "100%", maxWidth: 380, backgroundColor: Colors.surface, borderRadius: 22, padding: 22, gap: 12 },
  iconWrap:     { alignSelf: "center", width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 18, fontWeight: "800", color: Colors.text, textAlign: "center" },
  sub:          { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  input:        { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.text, letterSpacing: 4 },
  error:        { color: Colors.accent, fontSize: 13, textAlign: "center" },
  row:          { flexDirection: "row", gap: 10, marginTop: 4 },
  btn:          { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  btnGhost:     { backgroundColor: Colors.surfaceSecondary },
  btnGhostTxt:  { color: Colors.textSecondary, fontWeight: "700" },
  btnPrimary:   { backgroundColor: Colors.primary },
  btnPrimaryTxt:{ color: "#fff", fontWeight: "800" },
});
