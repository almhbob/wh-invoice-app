import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";

/** Visible only while some orders exist on this device but have not reached the server/departments yet. */
export function SyncStatusBanner() {
  const { pendingSyncCount, retrySync } = useOrders();
  const { lang } = useLang();
  if (!pendingSyncCount) return null;
  const ar = lang === "ar";
  return (
    <View style={st.bar}>
      <Feather name="upload-cloud" size={16} color={Colors.warning} />
      <Text style={st.txt}>
        {ar
          ? `${pendingSyncCount} طلب محفوظ على هذا الجهاز ولم يصل للأقسام بعد — يُعاد الإرسال تلقائياً`
          : `${pendingSyncCount} order(s) saved on this device, not yet sent to departments — retrying automatically`}
      </Text>
      <Pressable style={st.btn} onPress={retrySync}>
        <Text style={st.btnTxt}>{ar ? "أرسل الآن" : "Send now"}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  bar:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.warning + "18", borderColor: Colors.warning + "55", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  txt:    { flex: 1, color: Colors.text, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  btn:    { backgroundColor: Colors.warning, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  btnTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
