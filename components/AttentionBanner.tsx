import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { canDo, ROLE_CAN_VIEW_DELIVERY, ROLE_CAN_VIEW_ONLINE_ORDERS } from "@/constants/rbac";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";
import { useOnlineOrders } from "@/hooks/useOnlineOrders";
import { hasOpenDriverRequest } from "@/utils/orderFlow";

/** Things waiting on the branch: new online orders and open driver requests. */
export function AttentionBanner() {
  const { currentEmployee } = useEmployee();
  const role = currentEmployee?.role;
  if (!role || !canDo(role, ROLE_CAN_VIEW_ONLINE_ORDERS)) return null;
  return <Inner showRequests={canDo(role, ROLE_CAN_VIEW_DELIVERY)} />;
}

function Inner({ showRequests }: { showRequests: boolean }) {
  const { pending } = useOnlineOrders();
  const { orders } = useOrders();
  const { lang } = useLang();
  const ar = lang === "ar";
  const router = useRouter();
  const requests = useMemo(() => orders.filter(hasOpenDriverRequest).length, [orders]);
  if (!pending.length && !(showRequests && requests)) return null;
  return (
    <View style={{ gap: 8 }}>
      {pending.length > 0 && (
        <Pressable style={[st.bar, { borderColor: Colors.info + "66", backgroundColor: Colors.info + "12" }]} onPress={() => router.navigate("/(tabs)/online" as never)}>
          <Feather name="globe" size={17} color={Colors.info} />
          <Text style={st.txt}>{ar ? `${pending.length} طلب أونلاين بانتظار القبول` : `${pending.length} online order(s) awaiting acceptance`}</Text>
          <Feather name={ar ? "chevron-left" : "chevron-right"} size={17} color={Colors.info} />
        </Pressable>
      )}
      {showRequests && requests > 0 && (
        <Pressable style={[st.bar, { borderColor: Colors.warning + "66", backgroundColor: Colors.warning + "12" }]} onPress={() => router.navigate("/(tabs)/tracking" as never)}>
          <Feather name="life-buoy" size={17} color={Colors.warning} />
          <Text style={st.txt}>{ar ? `${requests} طلب من السائقين (دعم / تحويل)` : `${requests} driver request(s)`}</Text>
          <Feather name={ar ? "chevron-left" : "chevron-right"} size={17} color={Colors.warning} />
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  txt: { flex: 1, fontSize: 13, fontWeight: "800", color: Colors.text },
});
