import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { Department, OrderItem, OrderType, PAYMENT_LABEL_KEYS, PaymentMethod } from "@/context/OrdersContext";
import { DEPT_COLOR, DEPT_ICON, DEPT_ORDER } from "@/utils/orderFlow";

export interface OrderDraft {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  orderType: OrderType;
  deliveryAddress?: string;
  deliveryTime?: string;
  items: OrderItem[];
  notes?: string;
  images: string[];
  subtotal: number;
  discountAmount: number;
  discountReason?: string;
  insurance: number;
  grandTotal: number;
  paid: number;
  remaining: number;
  paymentMethod: PaymentMethod;
  cashierName?: string;
}

interface Props {
  visible: boolean;
  draft: OrderDraft;
  submitting: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

const DEPT_KEY: Record<Department, "deptHalwaShort" | "deptMawaliShort" | "deptChocolateShort" | "deptCakeShort" | "deptPackagingShort"> = {
  halwa: "deptHalwaShort", mawali: "deptMawaliShort", chocolate: "deptChocolateShort", cake: "deptCakeShort", packaging: "deptPackagingShort",
};

/** Final check before the order is sent to the factory. */
export function OrderReviewSheet({ visible, draft, submitting, onConfirm, onEdit }: Props) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const sar = t("sar");
  const byDept = DEPT_ORDER.map((d) => ({ d, items: draft.items.filter((i) => i.department === d) })).filter((g) => g.items.length);
  const missingPrice = draft.items.some((i) => !i.price);
  const isDelivery = draft.orderType === "delivery";
  const warnings: string[] = [];
  if (isDelivery && !draft.deliveryAddress?.trim()) warnings.push(ar ? "لا يوجد عنوان توصيل" : "No delivery address");
  if (!draft.deliveryTime) warnings.push(ar ? `لم يُحدَّد موعد ${isDelivery ? "التوصيل" : "الاستلام"}` : "No due time set");
  if (missingPrice) warnings.push(ar ? "بعض الأصناف بدون سعر" : "Some items have no price");
  if (draft.customerPhone.replace(/\D/g, "").length < 9) warnings.push(ar ? "رقم الجوال يبدو غير مكتمل" : "Phone number looks incomplete");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onEdit}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.handle} />
          <View style={st.head}>
            <Pressable onPress={onEdit} style={st.back} hitSlop={8}>
              <Feather name={ar ? "arrow-right" : "arrow-left"} size={20} color={Colors.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{ar ? "مراجعة الطلب قبل الإرسال" : "Review before sending"}</Text>
              <Text style={st.subtitle}>{ar ? "تأكد من التفاصيل — سيصل الطلب فوراً للأقسام" : "Check details — it goes straight to production"}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            {warnings.length > 0 && (
              <View style={st.warn}>
                {warnings.map((w) => (
                  <View key={w} style={st.warnRow}>
                    <Feather name="alert-triangle" size={13} color={Colors.warning} />
                    <Text style={st.warnTxt}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Customer & schedule */}
            <View style={st.card}>
              <View style={st.custRow}>
                <View style={st.avatar}><Text style={st.avatarTxt}>{draft.customerName.trim().charAt(0) || "؟"}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.custName}>{draft.customerName.trim() || (ar ? "بدون اسم" : "No name")}</Text>
                  <Text style={st.custPhone}>{draft.customerPhone}{draft.customerPhone2 ? ` · ${draft.customerPhone2}` : ""}</Text>
                </View>
                <View style={[st.typePill, isDelivery && { backgroundColor: Colors.gold + "22" }]}>
                  <Feather name={isDelivery ? "truck" : "shopping-bag"} size={12} color={isDelivery ? Colors.primary : Colors.success} />
                  <Text style={[st.typeTxt, { color: isDelivery ? Colors.primary : Colors.success }]}>{isDelivery ? (ar ? "توصيل" : "Delivery") : (ar ? "استلام" : "Pickup")}</Text>
                </View>
              </View>
              {draft.deliveryTime ? (
                <View style={st.line}><Feather name="calendar" size={14} color={Colors.gold} /><Text style={st.lineTxt}>{draft.deliveryTime}</Text></View>
              ) : null}
              {isDelivery && draft.deliveryAddress ? (
                <View style={st.line}><Feather name="map-pin" size={14} color={Colors.gold} /><Text style={st.lineTxt}>{draft.deliveryAddress}</Text></View>
              ) : null}
            </View>

            {/* Routing by department */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{ar ? "سيُرسل إلى الأقسام" : "Will be sent to"}</Text>
              {byDept.map(({ d, items }) => (
                <View key={d} style={st.dept}>
                  <View style={st.deptHead}>
                    <View style={[st.deptIcon, { backgroundColor: DEPT_COLOR[d] }]}><Feather name={DEPT_ICON[d] as never} size={13} color="#fff" /></View>
                    <Text style={st.deptName}>{t(DEPT_KEY[d])}</Text>
                    <Text style={st.deptCount}>{items.reduce((n, i) => n + i.quantity, 0)} {ar ? "قطعة" : "pcs"}</Text>
                  </View>
                  {items.map((i) => (
                    <View key={i.id} style={st.item}>
                      <Text style={st.qty}>{i.quantity}×</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={st.itemName}>{i.name}</Text>
                        {i.note ? <Text style={st.itemNote}>{i.note}</Text> : null}
                        {i.details ? <Text style={st.itemNote} numberOfLines={3}>{i.details}</Text> : null}
                      </View>
                      <Text style={[st.price, !i.price && { color: Colors.accent }]}>{i.price ? (i.price * i.quantity).toFixed(2) : "—"}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={st.deptHead}>
                <View style={[st.deptIcon, { backgroundColor: DEPT_COLOR.packaging }]}><Feather name="box" size={13} color="#fff" /></View>
                <Text style={st.deptName}>{t("deptPackagingShort")}</Text>
                <Text style={st.deptCount}>{ar ? "تجهيز نهائي" : "Final prep"}</Text>
              </View>
            </View>

            {draft.notes?.trim() || draft.images.length ? (
              <View style={st.card}>
                {draft.notes?.trim() ? (<><Text style={st.cardTitle}>{ar ? "ملاحظات للأقسام" : "Notes for production"}</Text><Text style={st.notes}>{draft.notes.trim()}</Text></>) : null}
                {draft.images.length ? (
                  <View style={st.imgs}>{draft.images.map((u, i) => <Image key={i} source={{ uri: u }} style={st.img} contentFit="cover" />)}</View>
                ) : null}
              </View>
            ) : null}

            {/* Money */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{ar ? "الحساب" : "Payment"}</Text>
              <Row label={ar ? "المجموع" : "Subtotal"} value={`${draft.subtotal.toFixed(2)} ${sar}`} />
              {draft.discountAmount > 0 && <Row label={`${ar ? "خصم" : "Discount"}${draft.discountReason ? ` (${draft.discountReason})` : ""}`} value={`− ${draft.discountAmount.toFixed(2)} ${sar}`} color={Colors.success} />}
              {draft.insurance > 0 && <Row label={ar ? "تأمين صواني" : "Tray deposit"} value={`${draft.insurance.toFixed(2)} ${sar}`} />}
              <View style={st.totalRow}>
                <Text style={st.totalLbl}>{ar ? "الإجمالي" : "Total"}</Text>
                <Text style={st.totalVal}>{draft.grandTotal.toFixed(2)} {sar}</Text>
              </View>
              <Row label={ar ? "طريقة الدفع" : "Method"} value={t(PAYMENT_LABEL_KEYS[draft.paymentMethod])} />
              {draft.paid > 0 && <Row label={ar ? "المدفوع" : "Paid"} value={`${draft.paid.toFixed(2)} ${sar}`} />}
              <Row
                label={draft.remaining > 0 ? (ar ? "المتبقي" : "Remaining") : (ar ? "الحالة" : "Status")}
                value={draft.remaining > 0 ? `${draft.remaining.toFixed(2)} ${sar}` : (ar ? "مدفوع بالكامل ✓" : "Fully paid ✓")}
                color={draft.remaining > 0 ? Colors.accent : Colors.success}
              />
            </View>

            {draft.cashierName ? <Text style={st.by}>{ar ? "المنشئ:" : "Created by:"} {draft.cashierName}</Text> : null}
          </ScrollView>

          <View style={st.actions}>
            <Pressable style={st.edit} onPress={onEdit}>
              <Feather name="edit-2" size={16} color={Colors.primary} />
              <Text style={st.editTxt}>{ar ? "تعديل" : "Edit"}</Text>
            </Pressable>
            <Pressable style={[st.confirm, submitting && { opacity: 0.6 }]} onPress={onConfirm} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Feather name="send" size={18} color={Colors.goldLight} />}
              <Text style={st.confirmTxt}>{submitting ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "تأكيد وإرسال للأقسام" : "Confirm & send")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLbl}>{label}</Text>
      <Text style={[st.rowVal, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, maxHeight: "94%", width: "100%", maxWidth: 720, alignSelf: "center" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900", color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  warn: { backgroundColor: Colors.warning + "14", borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: Colors.warning + "40" },
  warnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  warnTxt: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  cardTitle: { fontSize: 13, fontWeight: "800", color: Colors.textSecondary },
  custRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: Colors.goldLight, fontSize: 18, fontWeight: "900" },
  custName: { fontSize: 16, fontWeight: "900", color: Colors.text },
  custPhone: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.success + "16", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  typeTxt: { fontSize: 12, fontWeight: "800" },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  lineTxt: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text },
  dept: { gap: 8 },
  deptHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  deptIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deptName: { flex: 1, fontSize: 14, fontWeight: "800", color: Colors.text },
  deptCount: { fontSize: 12, color: Colors.textMuted, fontWeight: "700" },
  item: { flexDirection: "row", gap: 8, marginStart: 34, alignItems: "flex-start" },
  qty: { fontSize: 14, fontWeight: "900", color: Colors.primary, minWidth: 28 },
  itemName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  itemNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  price: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  notes: { fontSize: 13, color: Colors.text, lineHeight: 20, backgroundColor: Colors.gold + "12", borderRadius: 12, padding: 10 },
  imgs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  img: { width: 72, height: 72, borderRadius: 12 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLbl: { fontSize: 13, color: Colors.textSecondary },
  rowVal: { fontSize: 13, fontWeight: "700", color: Colors.text },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  totalLbl: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
  totalVal: { color: Colors.goldLight, fontSize: 18, fontWeight: "900" },
  by: { textAlign: "center", fontSize: 12, color: Colors.textMuted },
  actions: { flexDirection: "row", gap: 10, paddingVertical: 12 },
  edit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 18, borderWidth: 1, borderColor: Colors.border },
  editTxt: { color: Colors.primary, fontWeight: "800" },
  confirm: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15 },
  confirmTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
