import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { ROLE_CAN_VIEW_ONLINE_ORDERS, canDo } from "@/constants/rbac";
import { useEmployee } from "@/context/EmployeeContext";
import { Department, Order, useOrders } from "@/context/OrdersContext";
import { ringAlert } from "@/hooks/useNewOrderAlert";
import { useLang } from "@/context/LanguageContext";
import { tr, trf } from "@/lib/i18n";
import { useOnlineOrders } from "@/hooks/useOnlineOrders";
import { hasOpenDriverRequest, hasWriting, isProductionDone } from "@/utils/orderFlow";

/**
 * App-wide live alerts: whatever screen an employee is on, they hear and see
 * the work that just arrived for *them* (their department, their deliveries,
 * new online orders for the counter). Tapping the alert opens the right screen.
 */

type Alert = { key: string; title: string; body: string; route: string; icon: keyof typeof Feather.glyphMap };

const DEPTS: Department[] = ["halwa", "mawali", "chocolate", "cake"];
const DEPT_AR: Record<Department, [string, string]> = { halwa: ["الحلا", "Sweets"], mawali: ["المعجنات", "Pastry"], chocolate: ["الشوكولاتة", "Chocolate"], cake: ["الكيك", "Cake"], packaging: ["التغليف", "Packaging"] };
const COUNTER_ROLES = new Set(["admin", "branch_supervisor", "cashier"]);
const DISMISS_KEY = "@alerts_permission_dismissed";

function orderLabel(o: Order) {
  return `#${o.orderNumber}${o.customerName ? ` · ${o.customerName}` : ""}`;
}

function alertsFor(role: string, me: string, orders: Order[]): Alert[] {
  const out: Alert[] = [];
  for (const o of orders) {
    if (o.deleted) continue;
    const st = o.departmentStatuses ?? {};
    if ((DEPTS as string[]).includes(role)) {
      const d = role as Department;
      if (st[d] === "pending" && o.items.some((i) => i.department === d)) {
        out.push({ key: `dept:${o.id}`, title: trf("طلب جديد لقسم {d}", "New order for {d}", { d: tr(...DEPT_AR[d]) }), body: orderLabel(o), route: `/${d}`, icon: "inbox" });
      }
    }
    if (role === "packaging" && st.packaging === "pending" && isProductionDone(o)) {
      out.push({ key: `pack:${o.id}`, title: tr("طلب جاهز للتغليف", "Order ready to pack"), body: orderLabel(o), route: "/packaging", icon: "package" });
    }
    if (role === "calligrapher" && hasWriting(o) && (o.writingStatus ?? "pending") === "pending") {
      out.push({ key: `w:${o.id}`, title: tr("عبارة جديدة للكتابة", "New cake writing"), body: orderLabel(o), route: "/writing", icon: "edit-3" });
    }
    if (role === "driver" && o.deliveryDriver?.employeeId === me && o.deliveryStatus === "assigned") {
      out.push({ key: `drv:${o.id}`, title: tr("أُسند إليك طلب توصيل", "A delivery was assigned to you"), body: orderLabel(o), route: "/driver", icon: "truck" });
    }
    if (COUNTER_ROLES.has(role) && hasOpenDriverRequest(o)) {
      const req = o.driverRequest!;
      out.push({
        key: `req:${o.id}:${req.at}`,
        title: req.type === "transfer" ? tr("سائق يطلب تحويل طلب", "Driver asks to transfer an order") : tr("سائق يطلب دعماً", "Driver asks for support"),
        body: `${orderLabel(o)} — ${tr(req.reason)}`,
        route: "/delivery",
        icon: "life-buoy",
      });
    }
  }
  return out;
}

export function LiveAlertsHost() {
  const router = useRouter();
  const { currentEmployee } = useEmployee();
  useLang(); // re-render on language change
  const { orders } = useOrders();
  const role = currentEmployee?.role ?? "";
  const me = currentEmployee?.employeeId ?? "";
  const counter = canDo(currentEmployee?.role, ROLE_CAN_VIEW_ONLINE_ORDERS);
  const { pending: online, loading: onlineLoading } = useOnlineOrders(Boolean(currentEmployee) && counter);

  const current = useMemo(() => {
    if (!currentEmployee) return [] as Alert[];
    const list = alertsFor(role, me, orders);
    if (counter) {
      for (const o of online) {
        list.push({ key: `on:${o.id}`, title: tr("طلب أونلاين جديد", "New online order"), body: `${o.customerName} · ${Math.round(o.total ?? o.subtotal)} ${tr("ر.س", "SAR")}`, route: "/online", icon: "globe" });
      }
    }
    return list;
  }, [counter, currentEmployee, me, online, orders, role]);

  // Seed with what is already there (no alert on first load / after login), then
  // alert only for keys that appear later.
  const seen = useRef<Set<string> | null>(null);
  const seededFor = useRef("");
  const [toast, setToast] = useState<(Alert & { more: number }) | null>(null);

  useEffect(() => {
    const who = `${me}|${role}`;
    if (!currentEmployee) { seen.current = null; seededFor.current = ""; return; }
    if (counter && onlineLoading) return;
    if (seededFor.current !== who || !seen.current) {
      seen.current = new Set(current.map((a) => a.key));
      seededFor.current = who;
      return;
    }
    const fresh = current.filter((a) => !seen.current!.has(a.key));
    current.forEach((a) => seen.current!.add(a.key));
    if (!fresh.length) return;
    const first = fresh[0];
    ringAlert(first.title, fresh.length > 1 ? `${first.body} (+${fresh.length - 1})` : first.body, first.key.split(":")[0]);
    setToast({ ...first, more: fresh.length - 1 });
  }, [counter, current, currentEmployee, me, onlineLoading, role]);

  // Tab title badge while the app is in the background (web).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    const n = current.length;
    document.title = n > 0 ? `(${n}) ${base}` : base;
  }, [current.length]);

  // Auto-hide the toast.
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    Animated.spring(slide, { toValue: 1, useNativeDriver: Platform.OS !== "web", friction: 8 }).start();
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [slide, toast]);

  // One-time prompt to allow system notifications (needs a user tap on most browsers).
  const [askPermission, setAskPermission] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof Notification === "undefined" || !currentEmployee) { setAskPermission(false); return; }
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* storage blocked */ }
    setAskPermission(Notification.permission === "default" && !dismissed);
  }, [currentEmployee]);

  const dismissPermission = () => {
    setAskPermission(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage blocked */ }
  };

  if (!currentEmployee) return null;

  return (
    <>
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[s.toastWrap, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }]}
        >
          <Pressable
            style={s.toast}
            onPress={() => { setToast(null); router.push(toast.route as never); }}
            accessibilityRole="button"
            accessibilityLabel={`${toast.title} ${toast.body}`}
          >
            <View style={s.toastIcon}><Feather name={toast.icon} size={18} color={Colors.goldLight} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.toastTitle} numberOfLines={1}>{toast.title}{toast.more > 0 ? `  +${toast.more}` : ""}</Text>
              <Text style={s.toastBody} numberOfLines={1}>{toast.body}</Text>
            </View>
            <Text style={s.toastOpen}>{tr("فتح", "Open")}</Text>
            <Pressable hitSlop={10} onPress={() => setToast(null)} accessibilityLabel={tr("إغلاق", "Close")}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </Pressable>
        </Animated.View>
      )}

      {askPermission && (
        <View style={s.permBar}>
          <Feather name="bell" size={16} color={Colors.gold} />
          <Text style={s.permTxt}>{tr("فعّل الإشعارات ليصلك تنبيه بالطلبات حتى لو كانت الشاشة في الخلفية", "Turn on notifications to hear about new orders even when this screen is in the background")}</Text>
          <Pressable
            style={s.permBtn}
            onPress={() => {
              Notification.requestPermission().finally(() => setAskPermission(false));
            }}
          >
            <Text style={s.permBtnTxt}>{tr("تفعيل", "Enable")}</Text>
          </Pressable>
          <Pressable hitSlop={10} onPress={dismissPermission} accessibilityLabel={tr("لاحقاً", "Later")}>
            <Feather name="x" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  toastWrap: { position: "absolute", top: 12, left: 12, right: 12, zIndex: 1000, alignItems: "center" },
  toast: {
    width: "100%", maxWidth: 560, flexDirection: "row-reverse", alignItems: "center", gap: 12,
    backgroundColor: Colors.espressoMid, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  toastIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(217,96,43,0.18)", alignItems: "center", justifyContent: "center" },
  toastTitle: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "right" },
  toastBody: { color: "rgba(255,255,255,0.65)", fontSize: 12, textAlign: "right" },
  toastOpen: { color: Colors.goldLight, fontSize: 13, fontWeight: "700" },
  permBar: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10, marginHorizontal: 12, marginTop: 8,
    backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  permTxt: { flex: 1, color: Colors.textSecondary, fontSize: 12, textAlign: "right" },
  permBtn: { backgroundColor: Colors.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  permBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
