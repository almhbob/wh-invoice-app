import { tr, trf } from "@/lib/i18n";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { BranchTransferModal } from "@/components/BranchTransferModal";
import { Colors } from "@/constants/colors";
import { useEmployee } from "@/context/EmployeeContext";
import { useLang } from "@/context/LanguageContext";
import { BranchTransfer, Department, EmployeeRef, Order, OrderStatus, useOrders } from "@/context/OrdersContext";
import { WritingBlock } from "@/components/WritingBlock";
import { DEPT_COLOR, DEPT_ICON, dueLabel, dueUrgency, orderDepartments, URGENCY_COLOR } from "@/utils/orderFlow";

interface DeptOrderCardProps {
  order: Order;
  department: Department;
  onStatusChange: (status: OrderStatus, receiver?: EmployeeRef) => void | Promise<void>;
}

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { pending: "in_progress", in_progress: "done" };

const DEPT_CYCLE: Record<Department, Department> = {
  halwa: "mawali", mawali: "halwa", chocolate: "cake", cake: "chocolate", packaging: "halwa",
};

function clock(iso: string, lang: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.length > 10 ? iso.slice(11, 16) : iso;
  return d.toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Kitchen ticket: what to make, how many, for when — with one big action.
 * Customer contact and money are intentionally hidden from production staff.
 */
export function DeptOrderCard({ order, department, onStatusChange }: DeptOrderCardProps) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const { currentEmployee } = useEmployee();
  const { transferToBranch } = useOrders();
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const status = order.departmentStatuses?.[department] ?? "pending";
  const next = NEXT[status];
  const color = DEPT_COLOR[department];
  const isPackaging = department === "packaging";
  const items = isPackaging ? order.items : order.items.filter((i) => i.department === department);
  const urg = dueUrgency(order);
  const due = dueLabel(order, lang);
  const receiver = order.departmentReceivers?.[department];
  const transfer = order.branchTransfer;
  const receivedTransfer = transfer?.toDept === department;
  const images = [order.imageUri, ...(order.referenceImages ?? [])].filter(Boolean) as string[];

  const deptName: Record<Department, string> = {
    halwa: t("deptHalwaShort"), mawali: t("deptMawaliShort"), chocolate: t("deptChocolateShort"), cake: t("deptCakeShort"), packaging: t("deptPackagingShort"),
  };

  // Packaging waits for the production departments.
  const prodDepts = orderDepartments(order).filter((d) => d !== "packaging");
  const prodDone = prodDepts.filter((d) => order.departmentStatuses?.[d] === "done").length;
  const packagingBlocked = isPackaging && prodDone < prodDepts.length;

  const statusMeta = {
    pending: { label: tr("جديد", "New"), color: Colors.statusPending },
    in_progress: { label: tr("قيد التحضير", "Preparing"), color: Colors.statusInProgress },
    done: { label: tr("منجز", "Done"), color: Colors.statusDone },
    cancelled: { label: tr("ملغي", "Cancelled"), color: Colors.statusCancelled },
  }[status];

  const actionLabel = status === "pending"
    ? (tr("استلام وبدء التحضير", "Accept & start"))
    : (isPackaging ? (tr("تم التغليف — جاهز للتسليم", "Packed — ready")) : (tr("تم التحضير", "Mark prepared")));

  const advance = async () => {
    if (!next) return;
    if (!currentEmployee) {
      Alert.alert(t("loginRequired"), t("loginToReceive"));
      return;
    }
    const go = async () => {
      setBusy(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await onStatusChange(next, next === "in_progress"
          ? { name: currentEmployee.name, employeeId: currentEmployee.employeeId, timestamp: new Date().toISOString() }
          : undefined);
      } catch { /* surfaced by the orders context */ } finally {
        setBusy(false);
      }
    };
    if (next === "done" && packagingBlocked) {
      Alert.alert(
        tr("الأقسام لم تنتهِ", "Departments not finished"),
        trf("{p0} من {p1} أقسام أنهت التحضير. تأكيد التغليف الآن؟", "{p0}/{p1} departments done. Mark packed anyway?", { p0: prodDone, p1: prodDepts.length }),
        [{ text: tr("إلغاء", "Cancel"), style: "cancel" }, { text: tr("تأكيد", "Confirm"), onPress: () => void go() }]
      );
      return;
    }
    await go();
  };

  const handleTransfer = async (tr: BranchTransfer) => { await transferToBranch(order.id, tr); };

  return (
    <View style={[st.card, urg === "overdue" && status !== "done" && { borderColor: Colors.statusCancelled + "80" }]}>
      {/* Head */}
      <View style={[st.head, { backgroundColor: color + "10" }]}>
        <View style={[st.deptIcon, { backgroundColor: color }]}>
          <Feather name={DEPT_ICON[department] as never} size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.row}>
            <Text style={st.num}>#{order.orderNumber}</Text>
            <View style={[st.status, { backgroundColor: statusMeta.color + "1A" }]}>
              <View style={[st.dot, { backgroundColor: statusMeta.color }]} />
              <Text style={[st.statusTxt, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
            {order.orderType === "delivery" && (
              <View style={st.tag}><Feather name="truck" size={10} color={Colors.textSecondary} /><Text style={st.tagTxt}>{tr("توصيل", "Delivery")}</Text></View>
            )}
          </View>
          <Text style={st.sub} numberOfLines={1}>
            {order.customerName} · {tr("استُلم", "In")} {clock(order.createdAt, lang)}
          </Text>
        </View>
        {order.deliveryTime ? (
          <View style={[st.due, { borderColor: URGENCY_COLOR[urg] + "55", backgroundColor: URGENCY_COLOR[urg] + "12" }]}>
            <Text style={[st.dueTime, { color: urg === "none" || urg === "ok" ? Colors.text : URGENCY_COLOR[urg] }]}>{order.deliveryTime.slice(-5)}</Text>
            {due && status !== "done" ? <Text style={[st.dueRel, { color: URGENCY_COLOR[urg] }]}>{due}</Text> : null}
          </View>
        ) : null}
      </View>

      {receivedTransfer && (
        <View style={[st.banner, { backgroundColor: color + "12" }]}>
          <Feather name="share-2" size={13} color={color} />
          <Text style={[st.bannerTxt, { color }]}>
            {tr("محوَّل من", "Transferred from")} {deptName[transfer!.fromDept]} · {transfer!.reason}
          </Text>
        </View>
      )}

      {/* Items */}
      <View style={st.items}>
        {items.map((it) => (
          <View key={it.id} style={st.item}>
            <View style={[st.qty, { backgroundColor: color + "16" }]}>
              <Text style={[st.qtyTxt, { color }]}>{it.quantity}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.itemName}>{it.name}</Text>
              {isPackaging && it.department !== "packaging" ? <Text style={st.itemDept}>{deptName[it.department]}</Text> : null}
              {it.note ? <Text style={st.itemNote}>{it.note}</Text> : null}
              {it.details ? <Text style={st.itemNote}>{it.details}</Text> : null}
              <WritingBlock item={it} status={order.writingStatus ?? "pending"} />
            </View>
          </View>
        ))}
      </View>

      {order.notes ? (
        <View style={st.notes}>
          <Feather name="alert-circle" size={14} color={Colors.warning} />
          <Text style={st.notesTxt}>{order.notes}</Text>
        </View>
      ) : null}

      {images.length > 0 && (
        <View style={st.imgs}>
          {images.map((u, i) => (
            <Pressable key={i} onPress={() => setZoom(u)}>
              <Image source={{ uri: u }} style={st.img} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      )}

      {isPackaging && prodDepts.length > 0 && (
        <View style={st.ready}>
          {prodDepts.map((d) => {
            const done = order.departmentStatuses?.[d] === "done";
            const prog = order.departmentStatuses?.[d] === "in_progress";
            return (
              <View key={d} style={[st.readyPill, { backgroundColor: done ? Colors.statusDone + "18" : Colors.surfaceSecondary }]}>
                <Feather name={done ? "check" : prog ? "loader" : "clock"} size={11} color={done ? Colors.statusDone : prog ? Colors.statusInProgress : Colors.textMuted} />
                <Text style={[st.readyTxt, done && { color: Colors.statusDone }]}>{deptName[d]}</Text>
              </View>
            );
          })}
        </View>
      )}

      {receiver ? (
        <Text style={st.trail}>
          <Feather name="user-check" size={11} color={Colors.textMuted} /> {tr("المسؤول:", "By:")} {receiver.name} · {clock(receiver.timestamp, lang)}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={st.actions}>
        {next ? (
          <Pressable
            style={[st.primary, { backgroundColor: status === "pending" ? Colors.primary : Colors.statusDone }, (busy || order.syncState) && { opacity: 0.6 }]}
            onPress={() => void advance()}
            disabled={busy}
          >
            <Feather name={status === "pending" ? "play" : "check"} size={18} color={status === "pending" ? Colors.goldLight : "#fff"} />
            <Text style={st.primaryTxt}>{actionLabel}</Text>
          </Pressable>
        ) : (
          <View style={[st.doneBox]}>
            <Feather name="check-circle" size={16} color={Colors.statusDone} />
            <Text style={st.doneTxt}>{isPackaging ? (tr("جاهز للتسليم", "Ready for handover")) : (tr("أُنجز في هذا القسم", "Done here"))}</Text>
          </View>
        )}
        {!isPackaging && status !== "done" && status !== "cancelled" && transfer?.fromDept !== department && (
          <Pressable style={st.secondary} onPress={() => setTransferOpen(true)}>
            <Feather name="share-2" size={16} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <BranchTransferModal
        visible={transferOpen}
        order={order}
        department={department}
        onConfirm={handleTransfer}
        onClose={() => setTransferOpen(false)}
      />
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={st.zoomBg} onPress={() => setZoom(null)}>
          {zoom ? <Image source={{ uri: zoom }} style={st.zoomImg} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

// Kept for screens that reference the transfer target colour.
export const transferTarget = (d: Department) => DEPT_CYCLE[d];

const st = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, overflow: "hidden", shadowColor: Colors.primary, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  deptIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  num: { fontSize: 20, fontWeight: "900", color: Colors.text },
  status: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: "800" },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagTxt: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  due: { alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, minWidth: 64 },
  dueTime: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  dueRel: { fontSize: 10, fontWeight: "800" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: 10, borderRadius: 10, padding: 8 },
  bannerTxt: { flex: 1, fontSize: 12, fontWeight: "700" },
  items: { paddingHorizontal: 12, paddingTop: 12, gap: 10 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  qty: { minWidth: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  qtyTxt: { fontSize: 16, fontWeight: "900" },
  itemName: { fontSize: 15, fontWeight: "800", color: Colors.text, lineHeight: 22 },
  itemDept: { fontSize: 11, color: Colors.textMuted, fontWeight: "700" },
  itemNote: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 19 },
  notes: { flexDirection: "row", gap: 8, alignItems: "flex-start", margin: 12, marginBottom: 0, backgroundColor: Colors.warning + "14", borderRadius: 12, padding: 10 },
  notesTxt: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: "600", lineHeight: 19 },
  imgs: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  img: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  ready: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingTop: 12 },
  readyPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  readyTxt: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  trail: { fontSize: 11, color: Colors.textMuted, paddingHorizontal: 12, paddingTop: 10 },
  actions: { flexDirection: "row", gap: 8, padding: 12 },
  primary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  primaryTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondary: { width: 52, borderRadius: 14, backgroundColor: Colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  doneBox: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 12, backgroundColor: Colors.statusDone + "12" },
  doneTxt: { color: Colors.statusDone, fontWeight: "800" },
  zoomBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  zoomImg: { width: "92%", height: "80%" },
});
