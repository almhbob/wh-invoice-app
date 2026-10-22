import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import QRCode from "qrcode";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NewOrderBanner } from "@/components/NewOrderBanner";
import { RoleGate } from "@/components/RoleGate";
import { WritingBlock } from "@/components/WritingBlock";
import { Colors } from "@/constants/colors";
import { LAVIVIANE_COMPANY_ID } from "@/constants/lavivianeProducts";
import { ROLE_CAN_VIEW_ONLINE_ORDERS } from "@/constants/rbac";
import { useCompany } from "@/context/CompanyContext";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { OrderItem, PaymentMethod, useOrders } from "@/context/OrdersContext";
import { useProducts } from "@/context/TenantProductsContext";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { OnlineItem, OnlineOrder, useOnlineOrders } from "@/hooks/useOnlineOrders";
import { appOrigin, callPhone, DEPT_COLOR, openWhatsApp } from "@/utils/orderFlow";

const REJECT_REASONS = ["الموعد المطلوب غير متاح", "الأصناف غير متوفرة", "خارج نطاق التوصيل", "تعذّر التواصل مع العميل", "طلب مكرر", "أخرى"];

function orderLink(companyId: string) {
  const slug = companyId === LAVIVIANE_COMPANY_ID ? "laviviane" : companyId;
  return `${appOrigin()}/order/${slug}`;
}

function ago(iso: string, ar: boolean) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return ar ? "الآن" : "now";
  if (m < 60) return ar ? `منذ ${m} د` : `${m}m ago`;
  const h = Math.round(m / 60);
  return ar ? `منذ ${h} س` : `${h}h ago`;
}

function wallClock(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function OnlineScreen() {
  return (
    <RoleGate allow={ROLE_CAN_VIEW_ONLINE_ORDERS}>
      <OnlineInner />
    </RoleGate>
  );
}

function OnlineInner() {
  const { pending, decidedToday, loading, decide } = useOnlineOrders();
  const { company } = useCompany();
  const { lang } = useLang();
  const ar = lang === "ar";
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"new" | "done">("new");
  const [banner, setBanner] = useState(false);
  useNewOrderAlert(pending.length, () => setBanner(true));
  const list = tab === "new" ? pending : decidedToday;

  return (
    <View style={st.screen}>
      <NewOrderBanner visible={banner} count={pending.length} accentColor={Colors.info} onDismiss={() => setBanner(false)} />
      <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <ShareCard companyId={company.id} />

        <View style={st.tabs}>
          {([["new", ar ? "بانتظار القبول" : "Awaiting", pending.length], ["done", ar ? "عولجت اليوم" : "Handled today", decidedToday.length]] as const).map(([k, l, n]) => (
            <Pressable key={k} style={[st.tab, tab === k && { backgroundColor: Colors.surface }]} onPress={() => setTab(k)}>
              <Text style={[st.tabTxt, tab === k && { color: Colors.text, fontWeight: "900" }]}>{l}</Text>
              {n > 0 && <View style={[st.badge, tab === k && k === "new" && { backgroundColor: Colors.accent }]}><Text style={st.badgeTxt}>{n}</Text></View>}
            </Pressable>
          ))}
        </View>

        {loading && <ActivityIndicator color={Colors.gold} />}
        {!loading && list.length === 0 && (
          <View style={st.empty}>
            <Feather name="inbox" size={30} color={Colors.textMuted} />
            <Text style={st.emptyTxt}>{tab === "new" ? (ar ? "لا توجد طلبات أونلاين جديدة" : "No new online orders") : (ar ? "لا شيء اليوم بعد" : "Nothing yet today")}</Text>
          </View>
        )}
        {list.map((o) => <OnlineCard key={o.id} order={o} decide={decide} />)}
      </ScrollView>
    </View>
  );
}

function ShareCard({ companyId }: { companyId: string }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const link = orderLink(companyId);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: "#2B211B", light: "#ffffff" } }).then(setQr).catch(() => setQr("")); }, [link]);
  const copy = async () => {
    try {
      if (Platform.OS === "web" && navigator.clipboard) { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* ignore */ }
  };
  return (
    <View style={st.share}>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={st.shareTitle}>{ar ? "رابط الطلب الأونلاين لعملائك" : "Your customer ordering link"}</Text>
        <Text style={st.shareLink} selectable numberOfLines={1}>{link}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable style={st.shareBtn} onPress={() => void copy()}><Feather name={copied ? "check" : "copy"} size={13} color={Colors.primary} /><Text style={st.shareBtnTxt}>{copied ? (ar ? "نُسخ" : "Copied") : (ar ? "نسخ" : "Copy")}</Text></Pressable>
          <Pressable style={st.shareBtn} onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent((ar ? "اطلب الآن أونلاين: " : "Order online: ") + link)}`)}><Feather name="send" size={13} color={Colors.primary} /><Text style={st.shareBtnTxt}>{ar ? "مشاركة" : "Share"}</Text></Pressable>
          <Pressable style={st.shareBtn} onPress={() => Linking.openURL(link)}><Feather name="external-link" size={13} color={Colors.primary} /><Text style={st.shareBtnTxt}>{ar ? "فتح" : "Open"}</Text></Pressable>
        </View>
      </View>
      {qr ? <Image source={{ uri: qr }} style={st.qr} contentFit="contain" /> : null}
    </View>
  );
}

function OnlineCard({ order, decide }: { order: OnlineOrder; decide: (id: string, patch: Partial<OnlineOrder>) => Promise<void> }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const { addOrder } = useOrders();
  const { currentEmployee } = useEmployee();
  const { company } = useCompany();
  const { products } = useProducts();
  const [items, setItems] = useState<OnlineItem[]>(order.items);
  const [editing, setEditing] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const isNew = order.status === "new";
  const modified = JSON.stringify(items.map((i) => [i.productId, i.name, i.quantity])) !== JSON.stringify(order.items.map((i) => [i.productId, i.name, i.quantity]));
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const by = currentEmployee ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId } : undefined;
  const brand = company.name || "Laviviane";
  const trackUrl = `${appOrigin()}/track?c=${encodeURIComponent(company.id)}&t=${order.trackingCode}`;

  const setQty = (id: string, q: number) => setItems((prev) => (q <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity: Math.min(50, q) } : i))));
  const replace = (id: string, p: { id: string; name: string; price: number; department: string }) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, productId: p.id, name: p.name, price: p.price, department: p.department as OnlineItem["department"] } : i)));
    setReplaceFor(null);
    setSearch("");
  };

  const changesText = () => {
    const lines: string[] = [];
    order.items.forEach((o) => {
      const n = items.find((i) => i.id === o.id);
      if (!n) lines.push(`• حُذف: ${o.name} (غير متوفر)`);
      else if (n.name !== o.name) lines.push(`• استُبدل ${o.name} بـ ${n.name}`);
      else if (n.quantity !== o.quantity) lines.push(`• ${o.name}: الكمية ${n.quantity} بدلاً من ${o.quantity}`);
    });
    return lines.join("\n");
  };

  const accept = async () => {
    if (!items.length) { Alert.alert(ar ? "لا أصناف" : "No items", ar ? "لا يمكن قبول طلب فارغ — ارفضه بدلاً من ذلك." : "Reject it instead."); return; }
    setBusy(true);
    try {
      const orderItems: OrderItem[] = items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, department: i.department, ...(i.writing ? { writing: i.writing } : {}) }));
      const notes = [order.notes, order.locationUrl ? `📍 ${order.locationUrl}` : "", modified && changeNote.trim() ? `تعديل: ${changeNote.trim()}` : ""].filter(Boolean).join("\n");
      const created = await addOrder({
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderType: order.orderType,
        deliveryAddress: order.orderType === "delivery" ? (order.deliveryAddress || order.locationUrl) : undefined,
        receivedAt: wallClock(order.createdAt),
        deliveryTime: order.deliveryTime,
        items: orderItems,
        totalAmount: total,
        paymentMethod: payment,
        notes: notes || undefined,
        cashierEmployee: by ? { ...by, timestamp: new Date().toISOString() } : undefined,
        source: "online",
        onlineOrderId: order.id,
        trackingCode: order.trackingCode,
      });
      await decide(order.id, {
        status: "accepted", orderId: created.id, orderNumber: created.orderNumber, decidedAt: new Date().toISOString(), decidedBy: by,
        modified, ...(modified ? { items, changeNote: changeNote.trim() || undefined } : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const msg = [
        `مرحباً ${order.customerName} 🌸`,
        `تم تأكيد طلبك من ${brand} — رقم الطلب #${created.orderNumber}`,
        modified ? `\nتعديلات على الطلب:\n${changesText()}${changeNote.trim() ? `\n${changeNote.trim()}` : ""}` : "",
        `\nالإجمالي: ${total.toFixed(2)} ر.س`,
        `الموعد: ${order.deliveryTime} (${order.orderType === "delivery" ? "توصيل" : "استلام من الفرع"})`,
        `تابع طلبك: ${trackUrl}`,
      ].filter(Boolean).join("\n");
      openWhatsApp(order.customerPhone, msg);
    } catch {
      Alert.alert(ar ? "تعذّر القبول" : "Could not accept", ar ? "تحقق من الاتصال وأعد المحاولة." : "Check the connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    const r = reason === "أخرى" ? reasonNote.trim() : [reason, reasonNote.trim()].filter(Boolean).join(" — ");
    if (!r) return;
    setBusy(true);
    try {
      await decide(order.id, { status: "rejected", rejectReason: r, decidedAt: new Date().toISOString(), decidedBy: by });
      openWhatsApp(order.customerPhone, `مرحباً ${order.customerName}،\nنعتذر، لم نتمكن من قبول طلبك من ${brand}.\nالسبب: ${r}\nيسعدنا خدمتك بموعد أو أصناف أخرى 🌸`);
      setRejecting(false);
    } catch {
      Alert.alert(ar ? "تعذّر الحفظ" : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.isAvailable !== false && (!q || p.name.toLowerCase().includes(q))).slice(0, 30);
  }, [products, search]);

  return (
    <View style={[st.card, isNew && { borderColor: Colors.info + "66" }]}>
      <View style={st.head}>
        <View style={st.webIcon}><Feather name="globe" size={16} color={Colors.info} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.cust}>{order.customerName}</Text>
          <Text style={st.sub}>{order.customerPhone} · {ago(order.createdAt, ar)}</Text>
        </View>
        {!isNew && (
          <View style={[st.status, { backgroundColor: (order.status === "accepted" ? Colors.success : Colors.accent) + "18" }]}>
            <Text style={[st.statusTxt, { color: order.status === "accepted" ? Colors.success : Colors.accent }]}>
              {order.status === "accepted" ? `${ar ? "قُبل" : "Accepted"}${order.orderNumber ? ` #${order.orderNumber}` : ""}` : (ar ? "مرفوض" : "Rejected")}
            </Text>
          </View>
        )}
      </View>

      <View style={st.metaRow}>
        <View style={st.meta}><Feather name={order.orderType === "delivery" ? "truck" : "shopping-bag"} size={12} color={Colors.textSecondary} /><Text style={st.metaTxt}>{order.orderType === "delivery" ? (ar ? "توصيل" : "Delivery") : (ar ? "استلام" : "Pickup")}</Text></View>
        <View style={[st.meta, { backgroundColor: Colors.gold + "1A" }]}><Feather name="calendar" size={12} color={Colors.primary} /><Text style={[st.metaTxt, { color: Colors.primary }]}>{order.deliveryTime}</Text></View>
      </View>
      {order.deliveryAddress ? <Text style={st.addr}>📍 {order.deliveryAddress}</Text> : null}
      {order.locationUrl ? <Pressable onPress={() => Linking.openURL(order.locationUrl!)}><Text style={st.loc}>🗺️ {ar ? "موقع العميل على الخريطة" : "Customer location"}</Text></Pressable> : null}

      <View style={st.items}>
        {items.map((i) => (
          <View key={i.id} style={st.item}>
            <View style={[st.dot, { backgroundColor: DEPT_COLOR[i.department] ?? Colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.itemName}>{i.name}</Text>
              <Text style={st.itemPrice}>{i.price} ر.س × {i.quantity} = {(i.price * i.quantity).toFixed(2)}</Text>
              <WritingBlock item={{ ...i } as OrderItem} />
            </View>
            {editing && isNew ? (
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={st.qty}>
                  <Pressable onPress={() => setQty(i.id, i.quantity + 1)} style={st.qtyBtn}><Text style={st.qtyTxt}>+</Text></Pressable>
                  <Text style={st.qtyNum}>{i.quantity}</Text>
                  <Pressable onPress={() => setQty(i.id, i.quantity - 1)} style={st.qtyBtn}><Text style={st.qtyTxt}>−</Text></Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => setReplaceFor(i.id)}><Text style={st.link}>{ar ? "استبدال" : "Replace"}</Text></Pressable>
                  <Pressable onPress={() => setQty(i.id, 0)}><Text style={[st.link, { color: Colors.accent }]}>{ar ? "غير متوفر" : "Unavailable"}</Text></Pressable>
                </View>
              </View>
            ) : (
              <Text style={st.itemQ}>×{i.quantity}</Text>
            )}
          </View>
        ))}
      </View>
      {order.notes ? <Text style={st.notes}>📝 {order.notes}</Text> : null}
      {order.rejectReason ? <Text style={[st.notes, { backgroundColor: Colors.accent + "12" }]}>{ar ? "سبب الرفض:" : "Reason:"} {order.rejectReason}</Text> : null}
      {order.changeNote ? <Text style={st.notes}>{ar ? "ملاحظة التعديل:" : "Change note:"} {order.changeNote}</Text> : null}

      <View style={st.total}><Text style={st.totalLbl}>{ar ? "الإجمالي" : "Total"}{modified ? (ar ? " (بعد التعديل)" : " (modified)") : ""}</Text><Text style={st.totalVal}>{total.toFixed(2)} ر.س</Text></View>

      {isNew && !rejecting && (
        <>
          {editing && (
            <TextInput style={st.input} value={changeNote} onChangeText={setChangeNote} placeholder={ar ? "توضيح للعميل عن التعديل (اختياري)" : "Note to customer about the change"} placeholderTextColor={Colors.textMuted} />
          )}
          <View style={st.payRow}>
            {([["cash", ar ? "نقداً عند الاستلام" : "Cash"], ["card", ar ? "شبكة" : "Card"], ["transfer", ar ? "تحويل" : "Transfer"]] as const).map(([k, l]) => (
              <Pressable key={k} style={[st.pay, payment === k && st.payOn]} onPress={() => setPayment(k)}><Text style={[st.payTxt, payment === k && { color: "#fff" }]}>{l}</Text></Pressable>
            ))}
          </View>
          <Pressable style={[st.primary, busy && { opacity: 0.6 }]} onPress={() => void accept()} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Feather name="check-circle" size={18} color={Colors.goldLight} />}
            <Text style={st.primaryTxt}>{modified ? (ar ? "قبول مع التعديلات وإرسال للأقسام" : "Accept with changes") : (ar ? "قبول وإرسال للأقسام" : "Accept & send to production")}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={st.secondary} onPress={() => setEditing((v) => !v)}><Feather name="edit-2" size={14} color={Colors.primary} /><Text style={st.secondaryTxt}>{editing ? (ar ? "إنهاء التعديل" : "Done editing") : (ar ? "تعديل (صنف غير متوفر)" : "Modify")}</Text></Pressable>
            <Pressable style={st.secondary} onPress={() => callPhone(order.customerPhone)}><Feather name="phone" size={14} color={Colors.primary} /><Text style={st.secondaryTxt}>{ar ? "اتصال" : "Call"}</Text></Pressable>
            <Pressable style={[st.secondary, { backgroundColor: Colors.accent + "12" }]} onPress={() => setRejecting(true)}><Feather name="x-circle" size={14} color={Colors.accent} /><Text style={[st.secondaryTxt, { color: Colors.accent }]}>{ar ? "رفض" : "Reject"}</Text></Pressable>
          </View>
        </>
      )}

      {isNew && rejecting && (
        <View style={{ gap: 8 }}>
          <Text style={st.lbl}>{ar ? "سبب الرفض" : "Reason"}</Text>
          <View style={st.chips}>
            {REJECT_REASONS.map((r) => (
              <Pressable key={r} style={[st.chip, reason === r && st.chipOn]} onPress={() => setReason(r)}><Text style={[st.chipTxt, reason === r && { color: "#fff" }]}>{r}</Text></Pressable>
            ))}
          </View>
          <TextInput style={st.input} value={reasonNote} onChangeText={setReasonNote} placeholder={ar ? "توضيح للعميل" : "Details for the customer"} placeholderTextColor={Colors.textMuted} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={st.secondary} onPress={() => setRejecting(false)}><Text style={st.secondaryTxt}>{ar ? "رجوع" : "Back"}</Text></Pressable>
            <Pressable style={[st.secondary, { backgroundColor: Colors.accent, flex: 2 }, (!reason || (reason === "أخرى" && !reasonNote.trim())) && { opacity: 0.5 }]} disabled={!reason || busy} onPress={() => void reject()}>
              <Text style={[st.secondaryTxt, { color: "#fff" }]}>{ar ? "تأكيد الرفض وإبلاغ العميل" : "Reject & notify"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={!!replaceFor} transparent animationType="slide" onRequestClose={() => setReplaceFor(null)}>
        <View style={st.backdrop}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>{ar ? "اختر صنفاً بديلاً" : "Choose a replacement"}</Text>
            <TextInput style={st.input} value={search} onChangeText={setSearch} placeholder={ar ? "ابحث…" : "Search…"} placeholderTextColor={Colors.textMuted} />
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 6 }}>
              {matches.map((p) => (
                <Pressable key={p.id} style={st.pick} onPress={() => replace(replaceFor!, p)}>
                  <Text style={{ flex: 1, fontWeight: "700", color: Colors.text }}>{p.name}</Text>
                  <Text style={{ color: Colors.textSecondary, fontWeight: "800" }}>{p.price} ر.س</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={st.secondary} onPress={() => setReplaceFor(null)}><Text style={st.secondaryTxt}>{ar ? "إلغاء" : "Cancel"}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  share: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: Colors.primary, borderRadius: 20, padding: 14 },
  shareTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  shareLink: { color: Colors.goldLight, fontSize: 12, fontWeight: "700" },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.goldLight, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  shareBtnTxt: { color: Colors.primary, fontSize: 12, fontWeight: "800" },
  qr: { width: 88, height: 88, borderRadius: 12, backgroundColor: "#fff" },
  tabs: { flexDirection: "row", backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 11, paddingVertical: 9 },
  tabTxt: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 36 },
  emptyTxt: { color: Colors.textMuted, fontWeight: "700" },
  card: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  webIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: Colors.info + "16", alignItems: "center", justifyContent: "center" },
  cust: { fontSize: 16, fontWeight: "900", color: Colors.text },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt: { fontSize: 11, fontWeight: "800" },
  metaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  metaTxt: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  addr: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  loc: { fontSize: 13, color: Colors.info, fontWeight: "800" },
  items: { gap: 10 },
  item: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  itemName: { fontSize: 14, fontWeight: "800", color: Colors.text },
  itemPrice: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemQ: { fontSize: 15, fontWeight: "900", color: Colors.primary },
  qty: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceSecondary, borderRadius: 10 },
  qtyBtn: { width: 32, height: 30, alignItems: "center", justifyContent: "center" },
  qtyTxt: { fontSize: 17, fontWeight: "900", color: Colors.primary },
  qtyNum: { fontWeight: "900", minWidth: 18, textAlign: "center" },
  link: { fontSize: 12, fontWeight: "800", color: Colors.info },
  notes: { fontSize: 12, color: Colors.text, backgroundColor: Colors.gold + "12", borderRadius: 10, padding: 8, lineHeight: 18 },
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  totalLbl: { color: Colors.textSecondary, fontWeight: "700" },
  totalVal: { color: Colors.primary, fontWeight: "900", fontSize: 16 },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  payRow: { flexDirection: "row", gap: 6 },
  pay: { flex: 1, alignItems: "center", borderRadius: 10, paddingVertical: 8, backgroundColor: Colors.surfaceSecondary },
  payOn: { backgroundColor: Colors.primary },
  payTxt: { fontSize: 12, fontWeight: "800", color: Colors.textSecondary },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14 },
  primaryTxt: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, paddingVertical: 10 },
  secondaryTxt: { color: Colors.primary, fontSize: 12, fontWeight: "800" },
  lbl: { fontSize: 12, fontWeight: "800", color: Colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: Colors.surfaceSecondary },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { fontSize: 12, fontWeight: "700", color: Colors.text },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 10 },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: Colors.text },
  pick: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: 12 },
});
