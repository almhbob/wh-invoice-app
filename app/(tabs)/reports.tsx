import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";
import { fmtCurrency } from "@/utils/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "today" | "week" | "month" | "all";
type Tab = "revenue" | "products" | "cashier" | "delivery";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_COLORS: Record<string, string> = {
  cash: "#16a34a",
  card: "#2563eb",
  transfer: "#d97706",
};

const DEPT_META: Record<string, { label: string; color: string }> = {
  halwa:     { label: "حلا زفة",    color: Colors.halwa },
  mawali:    { label: "معجنات",     color: Colors.mawali },
  chocolate: { label: "شوكولاتة",  color: Colors.chocolate },
  cake:      { label: "كيك",        color: Colors.cake },
  packaging: { label: "تغليف",     color: Colors.packaging },
};

const TAB_ITEMS: { key: Tab; label: string; icon: string }[] = [
  { key: "revenue",  label: "الإيرادات",  icon: "trending-up" },
  { key: "products", label: "المنتجات",   icon: "package" },
  { key: "cashier",  label: "الكاشير",    icon: "user-check" },
  { key: "delivery", label: "التوصيل",    icon: "truck" },
];

// ─── Helper: date filter ──────────────────────────────────────────────────────

function isInFilter(isoDate: string, filter: Filter): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  if (filter === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (filter === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  if (filter === "month") {
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }
  return true;
}

function filterLabel(filter: Filter): string {
  if (filter === "today") return "اليوم";
  if (filter === "week")  return "هذا الأسبوع";
  if (filter === "month") return "هذا الشهر";
  return "كل الوقت";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: "currency" | "count";
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const displayVal = unit === "count" ? `${value}` : fmtCurrency(value);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.barValue}>{displayVal}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function PaymentRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.payRow}>
      <View style={[styles.payDot, { backgroundColor: color }]} />
      <Text style={styles.payLabel}>{label}</Text>
      <View style={styles.payBarWrap}>
        <View
          style={[
            styles.payBarFill,
            { width: `${pct}%` as any, backgroundColor: color + "55" },
          ]}
        />
      </View>
      <Text style={styles.payPct}>{pct}%</Text>
      <Text style={styles.payValue}>{fmtCurrency(value)}</Text>
    </View>
  );
}

function CashierRow({
  rank,
  name,
  orderCount,
  revenue,
  avg,
}: {
  rank: number;
  name: string;
  orderCount: number;
  revenue: number;
  avg: number;
}) {
  return (
    <View style={styles.cashierRow}>
      <View style={styles.cashierRankBadge}>
        <Text style={styles.cashierRank}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cashierName}>{name}</Text>
        <Text style={styles.cashierSub}>
          {orderCount} طلب · متوسط {fmtCurrency(avg)}
        </Text>
      </View>
      <Text style={styles.cashierRevenue}>{fmtCurrency(revenue)}</Text>
    </View>
  );
}

function DriverRow({
  rank,
  name,
  orderCount,
  delivered,
}: {
  rank: number;
  name: string;
  orderCount: number;
  delivered: number;
}) {
  return (
    <View style={styles.cashierRow}>
      <View style={[styles.cashierRankBadge, { backgroundColor: Colors.info + "22" }]}>
        <Text style={[styles.cashierRank, { color: Colors.info }]}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cashierName}>{name}</Text>
        <Text style={styles.cashierSub}>
          {delivered} مسلّم من {orderCount}
        </Text>
      </View>
      <Text style={[styles.cashierRevenue, { color: Colors.info }]}>
        {orderCount} طلب
      </Text>
    </View>
  );
}

// ─── Tab: Revenue ─────────────────────────────────────────────────────────────

function RevenueTab({
  filtered,
}: {
  filtered: ReturnType<typeof useOrders>["orders"];
}) {
  const totalRevenue = filtered.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const orderCount   = filtered.length;
  const avgOrder     = orderCount > 0 ? totalRevenue / orderCount : 0;

  const totalDiscounts = useMemo(() => {
    return filtered.reduce((s, o) => {
      if (!o.discount) return s;
      if (o.discount.type === "fixed") return s + o.discount.value;
      if (o.discount.type === "percentage") {
        const base = (o.totalAmount ?? 0) + o.discount.value;
        return s + base * (o.discount.value / 100);
      }
      return s;
    }, 0);
  }, [filtered]);

  const byDept = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.department;
        map[key] = (map[key] ?? 0) + (item.price ?? 0) * item.quantity;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const maxDept = byDept[0]?.[1] ?? 1;

  const byPayment = useMemo(() => {
    const map: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
    filtered.forEach((o) => {
      const pm = o.paymentMethod ?? "cash";
      map[pm] = (map[pm] ?? 0) + (o.totalAmount ?? 0);
    });
    return map;
  }, [filtered]);

  const deliveryCount = filtered.filter((o) => o.orderType === "delivery").length;
  const pickupCount   = filtered.filter((o) => o.orderType !== "delivery").length;
  const deliveryRev   = filtered
    .filter((o) => o.orderType === "delivery")
    .reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const pickupRev     = filtered
    .filter((o) => o.orderType !== "delivery")
    .reduce((s, o) => s + (o.totalAmount ?? 0), 0);

  const paymentTotal = Object.values(byPayment).reduce((s, v) => s + v, 0);
  const paymentLabels: Record<string, string> = {
    cash: "نقداً",
    card: "بطاقة",
    transfer: "تحويل",
  };

  return (
    <>
      {/* KPI cards */}
      <View style={styles.kpiGrid}>
        <StatCard
          icon="trending-up"
          label="إجمالي الإيرادات"
          value={fmtCurrency(totalRevenue)}
          color={Colors.primary}
        />
        <StatCard
          icon="shopping-bag"
          label="عدد الطلبات"
          value={String(orderCount)}
          color={Colors.gold}
        />
        <StatCard
          icon="bar-chart-2"
          label="متوسط الطلب"
          value={fmtCurrency(avgOrder)}
          color={Colors.packaging}
        />
        <StatCard
          icon="tag"
          label="إجمالي الخصومات"
          value={fmtCurrency(totalDiscounts)}
          color={Colors.accent}
        />
      </View>

      {/* Revenue by department */}
      {byDept.length > 0 && (
        <View style={styles.card}>
          <SectionHeader title="الإيرادات حسب القسم" />
          {byDept.map(([dept, rev]) => (
            <BarRow
              key={dept}
              label={DEPT_META[dept]?.label ?? dept}
              value={rev}
              max={maxDept}
              color={DEPT_META[dept]?.color ?? Colors.primary}
              unit="currency"
            />
          ))}
        </View>
      )}

      {/* Payment methods */}
      <View style={styles.card}>
        <SectionHeader title="طرق الدفع" />
        {Object.entries(byPayment)
          .filter(([, v]) => v > 0)
          .map(([pm, val]) => (
            <PaymentRow
              key={pm}
              label={paymentLabels[pm] ?? pm}
              value={val}
              total={paymentTotal}
              color={PAYMENT_COLORS[pm] ?? Colors.primary}
            />
          ))}
        {paymentTotal === 0 && (
          <Text style={styles.emptyText}>لا توجد بيانات</Text>
        )}
      </View>

      {/* Delivery vs Pickup */}
      <View style={styles.card}>
        <SectionHeader title="التوصيل مقابل الاستلام" />
        <View style={styles.splitRow}>
          <View style={[styles.splitCard, { borderColor: Colors.info }]}>
            <Feather name="truck" size={20} color={Colors.info} />
            <Text style={styles.splitCount}>{deliveryCount}</Text>
            <Text style={styles.splitLabel}>توصيل</Text>
            <Text style={styles.splitRev}>{fmtCurrency(deliveryRev)}</Text>
          </View>
          <View style={[styles.splitCard, { borderColor: Colors.success }]}>
            <Feather name="shopping-bag" size={20} color={Colors.success} />
            <Text style={styles.splitCount}>{pickupCount}</Text>
            <Text style={styles.splitLabel}>استلام</Text>
            <Text style={styles.splitRev}>{fmtCurrency(pickupRev)}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

// ─── Tab: Products ────────────────────────────────────────────────────────────

function ProductsTab({
  filtered,
}: {
  filtered: ReturnType<typeof useOrders>["orders"];
}) {
  const topByQty = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((o) =>
      o.items.forEach((item) => {
        map[item.name] = (map[item.name] ?? 0) + item.quantity;
      })
    );
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const topByRev = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((o) =>
      o.items.forEach((item) => {
        map[item.name] =
          (map[item.name] ?? 0) + (item.price ?? 0) * item.quantity;
      })
    );
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const deptVolume = useMemo(() => {
    const map: Record<string, { pending: number; in_progress: number; done: number }> = {};
    filtered.forEach((o) => {
      Object.entries(o.departmentStatuses ?? {}).forEach(([dept, status]) => {
        if (!map[dept]) map[dept] = { pending: 0, in_progress: 0, done: 0 };
        if (status === "pending")     map[dept].pending++;
        else if (status === "in_progress") map[dept].in_progress++;
        else if (status === "done")   map[dept].done++;
      });
    });
    return Object.entries(map);
  }, [filtered]);

  const maxQty = topByQty[0]?.[1] ?? 1;
  const maxRev = topByRev[0]?.[1] ?? 1;

  return (
    <>
      {/* Top products by quantity */}
      {topByQty.length > 0 ? (
        <View style={styles.card}>
          <SectionHeader title="أكثر الأصناف مبيعاً (الكمية)" />
          {topByQty.map(([name, qty], idx) => (
            <View key={name} style={styles.prodRow}>
              <Text style={styles.prodRank}>#{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.prodName} numberOfLines={1}>{name}</Text>
                <View style={styles.prodBarTrack}>
                  <View
                    style={[
                      styles.prodBarFill,
                      {
                        width: `${(qty / maxQty) * 100}%` as any,
                        backgroundColor: Colors.primary + "40",
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.prodQty}>{qty} وحدة</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyText}>لا توجد بيانات</Text>
        </View>
      )}

      {/* Top products by revenue */}
      {topByRev.length > 0 && (
        <View style={styles.card}>
          <SectionHeader title="أكثر الأصناف إيراداً" />
          {topByRev.map(([name, rev]) => (
            <BarRow
              key={name}
              label={name}
              value={rev}
              max={maxRev}
              color={Colors.gold}
              unit="currency"
            />
          ))}
        </View>
      )}

      {/* Department order volume */}
      {deptVolume.length > 0 && (
        <View style={styles.card}>
          <SectionHeader title="حجم الطلبات حسب القسم" />
          {deptVolume.map(([dept, counts]) => (
            <View key={dept} style={styles.deptVolumeRow}>
              <View
                style={[
                  styles.deptColorDot,
                  { backgroundColor: DEPT_META[dept]?.color ?? Colors.primary },
                ]}
              />
              <Text style={styles.deptVolumeName}>
                {DEPT_META[dept]?.label ?? dept}
              </Text>
              <View style={styles.deptStatusBadges}>
                <View style={[styles.statusBadge, { backgroundColor: Colors.statusPending + "22" }]}>
                  <Text style={[styles.statusBadgeText, { color: Colors.statusPending }]}>
                    {counts.pending}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: Colors.statusInProgress + "22" }]}>
                  <Text style={[styles.statusBadgeText, { color: Colors.statusInProgress }]}>
                    {counts.in_progress}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: Colors.statusDone + "22" }]}>
                  <Text style={[styles.statusBadgeText, { color: Colors.statusDone }]}>
                    {counts.done}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          <View style={styles.deptVolumeLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.statusPending }]} />
              <Text style={styles.legendText}>انتظار</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.statusInProgress }]} />
              <Text style={styles.legendText}>جاري</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.statusDone }]} />
              <Text style={styles.legendText}>مكتمل</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

// ─── Tab: Cashier ─────────────────────────────────────────────────────────────

function CashierTab({
  filtered,
}: {
  filtered: ReturnType<typeof useOrders>["orders"];
}) {
  const cashierStats = useMemo(() => {
    const map: Record<string, { orderCount: number; revenue: number }> = {};
    filtered.forEach((o) => {
      const name = o.cashierEmployee?.name ?? "غير معروف";
      if (!map[name]) map[name] = { orderCount: 0, revenue: 0 };
      map[name].orderCount++;
      map[name].revenue += o.totalAmount ?? 0;
    });
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        orderCount: data.orderCount,
        revenue: data.revenue,
        avg: data.orderCount > 0 ? data.revenue / data.orderCount : 0,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
  }, [filtered]);

  if (cashierStats.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>لا توجد بيانات</Text>
      </View>
    );
  }

  const topCashier = cashierStats[0];

  return (
    <>
      {/* Summary */}
      <View style={styles.kpiGrid}>
        <StatCard
          icon="users"
          label="عدد الكاشيرات"
          value={String(cashierStats.length)}
          color={Colors.purple}
        />
        <StatCard
          icon="award"
          label="الأعلى أداءً"
          value={topCashier.name}
          color={Colors.gold}
          sub={`${topCashier.orderCount} طلب`}
        />
      </View>

      {/* Cashier list */}
      <View style={styles.card}>
        <SectionHeader title="أداء الكاشيرات" />
        {cashierStats.map((c, idx) => (
          <CashierRow
            key={c.name}
            rank={idx + 1}
            name={c.name}
            orderCount={c.orderCount}
            revenue={c.revenue}
            avg={c.avg}
          />
        ))}
      </View>
    </>
  );
}

// ─── Tab: Delivery ────────────────────────────────────────────────────────────

function DeliveryTab({
  filtered,
}: {
  filtered: ReturnType<typeof useOrders>["orders"];
}) {
  const deliveryOrders = filtered.filter((o) => o.orderType === "delivery");
  const pickupOrders   = filtered.filter((o) => o.orderType !== "delivery");

  const deliveredCount = deliveryOrders.filter(
    (o) => o.deliveryStatus === "delivered"
  ).length;
  const pendingDelivery = deliveryOrders.filter(
    (o) => o.deliveryStatus !== "delivered"
  ).length;
  const completionRate  =
    deliveryOrders.length > 0
      ? Math.round((deliveredCount / deliveryOrders.length) * 100)
      : 0;

  const deliveryRevenue = deliveryOrders.reduce(
    (s, o) => s + (o.totalAmount ?? 0),
    0
  );

  const driverStats = useMemo(() => {
    const map: Record<string, { orderCount: number; delivered: number }> = {};
    deliveryOrders.forEach((o) => {
      const name = o.deliveryDriver?.name ?? "غير معين";
      if (!map[name]) map[name] = { orderCount: 0, delivered: 0 };
      map[name].orderCount++;
      if (o.deliveryStatus === "delivered") map[name].delivered++;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, orderCount: d.orderCount, delivered: d.delivered }))
      .sort((a, b) => b.orderCount - a.orderCount);
  }, [deliveryOrders]);

  // Average delivery time (minutes)
  const avgDeliveryTime = useMemo(() => {
    const times: number[] = [];
    deliveryOrders.forEach((o) => {
      if (o.deliveryDeliveredAt && o.createdAt) {
        const diff =
          new Date(o.deliveryDeliveredAt).getTime() -
          new Date(o.createdAt).getTime();
        if (diff > 0) times.push(diff / 60000);
      }
    });
    if (times.length === 0) return null;
    return Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  }, [deliveryOrders]);

  return (
    <>
      {/* KPIs */}
      <View style={styles.kpiGrid}>
        <StatCard
          icon="truck"
          label="طلبات التوصيل"
          value={String(deliveryOrders.length)}
          color={Colors.info}
        />
        <StatCard
          icon="shopping-bag"
          label="طلبات الاستلام"
          value={String(pickupOrders.length)}
          color={Colors.success}
        />
        <StatCard
          icon="check-circle"
          label="نسبة الإنجاز"
          value={`${completionRate}%`}
          color={Colors.statusDone}
          sub={`${deliveredCount} مسلّم`}
        />
        <StatCard
          icon="dollar-sign"
          label="إيرادات التوصيل"
          value={fmtCurrency(deliveryRevenue)}
          color={Colors.gold}
        />
      </View>

      {/* Avg delivery time */}
      {avgDeliveryTime !== null && (
        <View style={styles.card}>
          <SectionHeader title="متوسط وقت التوصيل" />
          <View style={styles.avgTimeRow}>
            <Feather name="clock" size={28} color={Colors.info} />
            <Text style={styles.avgTimeValue}>{avgDeliveryTime} دقيقة</Text>
          </View>
        </View>
      )}

      {/* Pending vs Delivered */}
      <View style={styles.card}>
        <SectionHeader title="حالة طلبات التوصيل" />
        <View style={styles.splitRow}>
          <View style={[styles.splitCard, { borderColor: Colors.statusDone }]}>
            <Feather name="check-circle" size={20} color={Colors.statusDone} />
            <Text style={styles.splitCount}>{deliveredCount}</Text>
            <Text style={styles.splitLabel}>مسلّم</Text>
          </View>
          <View style={[styles.splitCard, { borderColor: Colors.statusPending }]}>
            <Feather name="clock" size={20} color={Colors.statusPending} />
            <Text style={styles.splitCount}>{pendingDelivery}</Text>
            <Text style={styles.splitLabel}>قيد التسليم</Text>
          </View>
        </View>
      </View>

      {/* Driver performance */}
      {driverStats.length > 0 && (
        <View style={styles.card}>
          <SectionHeader title="أداء السائقين" />
          {driverStats.map((d, idx) => (
            <DriverRow
              key={d.name}
              rank={idx + 1}
              name={d.name}
              orderCount={d.orderCount}
              delivered={d.delivered}
            />
          ))}
        </View>
      )}

      {deliveryOrders.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.emptyText}>لا توجد طلبات توصيل</Text>
        </View>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { t } = useLang();
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<Filter>("month");
  const [activeTab, setActiveTab] = useState<Tab>("revenue");

  const filtered = useMemo(
    () => orders.filter((o) => isInFilter(o.createdAt, filter)),
    [orders, filter]
  );

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "today", label: t("repFilterToday") },
    { key: "week",  label: t("repFilterWeek") },
    { key: "month", label: t("repFilterMonth") },
    { key: "all",   label: t("repFilterAll") },
  ];

  function handleFilterChange(key: Filter) {
    Haptics.selectionAsync();
    setFilter(key);
  }

  function handleTabChange(key: Tab) {
    Haptics.selectionAsync();
    setActiveTab(key);
  }

  async function handleShare() {
    Haptics.selectionAsync();

    // Build share text
    const totalRevenue = filtered.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const orderCount   = filtered.length;

    const byPayment: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
    filtered.forEach((o) => {
      const pm = o.paymentMethod ?? "cash";
      byPayment[pm] = (byPayment[pm] ?? 0) + (o.totalAmount ?? 0);
    });

    const deliveryCount = filtered.filter((o) => o.orderType === "delivery").length;
    const pickupCount   = filtered.filter((o) => o.orderType !== "delivery").length;

    // Top product by qty
    const qtyMap: Record<string, number> = {};
    filtered.forEach((o) =>
      o.items.forEach((item) => {
        qtyMap[item.name] = (qtyMap[item.name] ?? 0) + item.quantity;
      })
    );
    const topProductEntries = Object.entries(qtyMap).sort((a, b) => b[1] - a[1]);
    const topProduct = topProductEntries[0];

    // Top cashier by order count
    const cashierMap: Record<string, number> = {};
    filtered.forEach((o) => {
      const name = o.cashierEmployee?.name ?? "غير معروف";
      cashierMap[name] = (cashierMap[name] ?? 0) + 1;
    });
    const topCashierEntries = Object.entries(cashierMap).sort((a, b) => b[1] - a[1]);
    const topCashier = topCashierEntries[0];

    const dateStr = new Date().toLocaleDateString("ar-SA");
    const label   = filterLabel(filter);

    const text = [
      `📊 تقرير — ${label} ${dateStr}`,
      "══════════════════════════════",
      `📦 الطلبات: ${orderCount}`,
      `💰 الإيرادات: ${fmtCurrency(totalRevenue)}`,
      `   نقد: ${fmtCurrency(byPayment.cash)} | شبكة: ${fmtCurrency(byPayment.card)} | تحويل: ${fmtCurrency(byPayment.transfer)}`,
      `🚗 توصيل: ${deliveryCount} | 🛍 استلام: ${pickupCount}`,
      topProduct
        ? `🏆 أعلى منتج: ${topProduct[0]} (${topProduct[1]} وحدة)`
        : null,
      topCashier
        ? `👤 أعلى كاشير: ${topCashier[0]} (${topCashier[1]} طلب)`
        : null,
      "══════════════════════════════",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await Share.share({ message: text });
    } catch (_) {
      // user cancelled or permission denied
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>التقارير</Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.75}
        >
          <Feather name="share-2" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Time filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterBtn,
              filter === f.key && styles.filterBtnActive,
            ]}
            onPress={() => handleFilterChange(f.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterBtnText,
                filter === f.key && styles.filterBtnTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabItem,
              activeTab === tab.key && styles.tabItemActive,
            ]}
            onPress={() => handleTabChange(tab.key)}
            activeOpacity={0.75}
          >
            <Feather
              name={tab.icon as any}
              size={14}
              color={
                activeTab === tab.key ? Colors.primary : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="bar-chart-2" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>لا توجد بيانات</Text>
          </View>
        )}

        {filtered.length > 0 && activeTab === "revenue" && (
          <RevenueTab filtered={filtered} />
        )}
        {filtered.length > 0 && activeTab === "products" && (
          <ProductsTab filtered={filtered} />
        )}
        {filtered.length > 0 && activeTab === "cashier" && (
          <CashierTab filtered={filtered} />
        )}
        {filtered.length > 0 && activeTab === "delivery" && (
          <DeliveryTab filtered={filtered} />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Filter pills
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: "wrap",
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterBtnTextActive: {
    color: "#fff",
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: Colors.primary + "15",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: "700",
  },

  // Scroll area
  scrollArea: {
    flex: 1,
  },

  // KPI grid
  kpiGrid: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    marginBottom: 4,
  },

  // Stat card
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // Card
  card: {
    margin: 16,
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Section header
  sectionHeader: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },

  // Bar row
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  barLabel: {
    width: 72,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barValue: {
    width: 90,
    fontSize: 11,
    color: Colors.text,
    fontWeight: "700",
    textAlign: "right",
  },

  // Payment row
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  payDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  payLabel: {
    width: 50,
    fontSize: 13,
    color: Colors.text,
  },
  payBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  payBarFill: {
    height: 6,
    borderRadius: 3,
  },
  payPct: {
    width: 34,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "right",
    fontWeight: "600",
  },
  payValue: {
    width: 80,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "right",
  },

  // Delivery vs pickup split
  splitRow: {
    flexDirection: "row",
    gap: 12,
  },
  splitCard: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: Colors.background,
    gap: 4,
  },
  splitCount: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.text,
  },
  splitLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  splitRev: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Product rows
  prodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  prodRank: {
    width: 26,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
  },
  prodName: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 3,
  },
  prodBarTrack: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  prodBarFill: {
    height: 5,
    borderRadius: 3,
  },
  prodQty: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    width: 64,
    textAlign: "right",
  },

  // Department volume
  deptVolumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deptColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deptVolumeName: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  deptStatusBadges: {
    flexDirection: "row",
    gap: 6,
  },
  statusBadge: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  deptVolumeLegend: {
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Cashier rows
  cashierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cashierRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  cashierRank: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
  },
  cashierName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  cashierSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cashierRevenue: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.success,
  },

  // Avg delivery time
  avgTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  avgTimeValue: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.info,
  },

  // Empty states
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
});
