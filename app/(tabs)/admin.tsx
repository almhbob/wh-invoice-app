import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "expo-image";

import { Colors } from "@/constants/colors";
import { DevSettingsModal } from "@/components/DevSettingsModal";
import { ProductManagerModal } from "@/components/ProductManagerModal";
import { useLang } from "@/context/LanguageContext";
import {
  Employee,
  EmployeeRole,
  ROLE_LABELS,
  useEmployee,
} from "@/context/EmployeeContext";
import { Department, DISCOUNT_REASON_PRESETS, DiscountType, Order, PAYMENT_LABELS, PaymentMethod, useOrders } from "@/context/OrdersContext";
import { Offer, useOffers } from "@/context/OffersContext";
import { Product, useProducts } from "@/context/ProductsContext";
import { usePriceChange } from "@/context/PriceChangeContext";
import { useFeatures, AppFeatures } from "@/context/FeaturesContext";

// ─── helpers ───────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

const ROLE_COLORS: Record<EmployeeRole, string> = {
  cashier: Colors.gold,
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
  admin: Colors.primaryLight,
};
const ROLE_ICONS: Record<EmployeeRole, any> = {
  cashier: "dollar-sign",
  halwa: "coffee",
  mawali: "package",
  chocolate: "gift",
  cake: "layers",
  packaging: "box",
  admin: "shield",
};
const ALL_ROLES: EmployeeRole[] = ["cashier", "halwa", "mawali", "chocolate", "cake", "packaging", "admin"];

// ─── sub-components ────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color, sub,
}: {
  icon: any; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconBox, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: any }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBox}>
        <Feather name={icon} size={14} color={Colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Employee Management ──────────────────────────────────────────────────
function EmployeesSection() {
  const { employees, addEmployee, removeEmployee } = useEmployee();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [empId, setEmpId] = useState("");
  const [role, setRole] = useState<EmployeeRole>("cashier");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) { Alert.alert("خطأ", "أدخل اسم الموظف"); return; }
    if (!empId.trim()) { Alert.alert("خطأ", "أدخل الرقم الوظيفي"); return; }
    const dup = employees.find((e) => e.employeeId.toLowerCase() === empId.trim().toLowerCase());
    if (dup) { Alert.alert("خطأ", "هذا الرقم الوظيفي مستخدم مسبقاً"); return; }
    setSaving(true);
    try {
      await addEmployee({ name: name.trim(), employeeId: empId.trim().toUpperCase(), role });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName(""); setEmpId(""); setRole("cashier"); setShowAdd(false);
    } finally { setSaving(false); }
  };

  const handleRemove = (emp: Employee) => {
    Alert.alert("حذف الموظف", `هل تريد حذف "${emp.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => removeEmployee(emp.id) },
    ]);
  };

  const grouped = ALL_ROLES.reduce<Record<EmployeeRole, Employee[]>>((acc, r) => {
    acc[r] = employees.filter((e) => e.role === r);
    return acc;
  }, {} as any);

  return (
    <View style={styles.section}>
      <SectionHeader title="إدارة الموظفين" icon="users" />

      {/* Counts row */}
      <View style={styles.empCountRow}>
        {ALL_ROLES.map((r) => (
          <View key={r} style={[styles.empCountPill, { backgroundColor: ROLE_COLORS[r] + "18", borderColor: ROLE_COLORS[r] + "40" }]}>
            <Text style={[styles.empCountNum, { color: ROLE_COLORS[r] }]}>{grouped[r].length}</Text>
            <Text style={[styles.empCountLabel, { color: ROLE_COLORS[r] }]}>{ROLE_LABELS[r]}</Text>
          </View>
        ))}
      </View>

      {/* Employee list */}
      {employees.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="users" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>لا يوجد موظفون — أضف الآن</Text>
        </View>
      ) : (
        ALL_ROLES.map((r) => {
          const list = grouped[r];
          if (list.length === 0) return null;
          return (
            <View key={r}>
              <View style={[styles.roleTag, { backgroundColor: ROLE_COLORS[r] + "15" }]}>
                <Feather name={ROLE_ICONS[r]} size={12} color={ROLE_COLORS[r]} />
                <Text style={[styles.roleTagText, { color: ROLE_COLORS[r] }]}>{ROLE_LABELS[r]}</Text>
              </View>
              {list.map((emp) => (
                <View key={emp.id} style={styles.empRow}>
                  <View style={[styles.empAvatar, { backgroundColor: ROLE_COLORS[r] }]}>
                    <Text style={styles.empAvatarLetter}>{emp.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{emp.name}</Text>
                    <Text style={styles.empIdText}>#{emp.employeeId}</Text>
                  </View>
                  <TouchableOpacity style={styles.delBtn} onPress={() => handleRemove(emp)} hitSlop={10}>
                    <Feather name="trash-2" size={15} color={Colors.accent} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })
      )}

      {/* Add form */}
      {showAdd ? (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>اسم الموظف *</Text>
          <TextInput style={styles.formInput} value={name} onChangeText={setName}
            placeholder="الاسم الكامل" placeholderTextColor={Colors.textMuted} textAlign="right" />
          <Text style={styles.formLabel}>الرقم الوظيفي *</Text>
          <TextInput style={styles.formInput} value={empId} onChangeText={setEmpId}
            placeholder="مثال: EMP001" placeholderTextColor={Colors.textMuted}
            textAlign="right" autoCapitalize="characters" />
          <Text style={styles.formLabel}>الدور الوظيفي</Text>
          <View style={styles.roleRow}>
            {ALL_ROLES.map((r) => (
              <TouchableOpacity key={r}
                style={[styles.roleChip, role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                onPress={() => { Haptics.selectionAsync(); setRole(r); }}>
                <Text style={[styles.roleChipText, role === r && { color: "#fff" }]}>{ROLE_LABELS[r]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setName(""); setEmpId(""); setRole("cashier"); }}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              <Feather name="user-plus" size={15} color="#fff" />
              <Text style={styles.saveBtnText}>{saving ? "..." : "حفظ"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => { Haptics.selectionAsync(); setShowAdd(true); }}>
          <Feather name="plus" size={16} color={Colors.primary} />
          <Text style={styles.addBtnText}>إضافة موظف جديد</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Financial Summary ────────────────────────────────────────────────────
function FinancialSection({ orders }: { orders: Order[] }) {
  const today = todayStr();
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(today));

  const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const ordersWithTotal = orders.filter((o) => (o.totalAmount ?? 0) > 0);
  const avgOrder = ordersWithTotal.length > 0 ? totalRevenue / ordersWithTotal.length : 0;
  const totalInsurance = orders.reduce((s, o) => s + (o.insuranceAmount ?? 0), 0);

  // discount stats
  const ordersWithDiscount = orders.filter((o) => o.discount && o.discount.value > 0);
  const totalDiscountAmount = orders.reduce((s, o) => {
    if (!o.discount || o.discount.value <= 0) return s;
    const subtotalEst = (o.totalAmount ?? 0) + (
      o.discount.type === "percentage"
        ? (o.totalAmount ?? 0) / (1 - o.discount.value / 100) - (o.totalAmount ?? 0)
        : o.discount.value
    );
    const discAmt = o.discount.type === "percentage"
      ? subtotalEst * (o.discount.value / 100)
      : o.discount.value;
    return s + discAmt;
  }, 0);

  // payment method breakdown
  const pmCounts: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0 };
  orders.forEach((o) => { if (o.paymentMethod) pmCounts[o.paymentMethod]++; });
  const topPm = (Object.entries(pmCounts) as [PaymentMethod, number][]).sort((a, b) => b[1] - a[1])[0];

  return (
    <View style={styles.section}>
      <SectionHeader title="الملخص المالي" icon="dollar-sign" />
      <View style={styles.statsGrid}>
        <StatCard icon="trending-up" label="إجمالي الإيرادات" value={fmtCurrency(totalRevenue)} color={Colors.gold}
          sub={`${ordersWithTotal.length} فاتورة مسعَّرة`} />
        <StatCard icon="sun" label="إيرادات اليوم" value={fmtCurrency(todayRevenue)} color={Colors.success} />
        <StatCard icon="bar-chart-2" label="متوسط الفاتورة" value={fmtCurrency(avgOrder)} color={Colors.info} />
        <StatCard icon="shield" label="إجمالي التأمينات" value={fmtCurrency(totalInsurance)} color={Colors.primaryLight} />
        {ordersWithDiscount.length > 0 && (
          <StatCard
            icon="tag"
            label="إجمالي الخصومات"
            value={fmtCurrency(totalDiscountAmount)}
            color={Colors.warning}
            sub={`${ordersWithDiscount.length} فاتورة بخصم`}
          />
        )}
      </View>

      {/* Payment method breakdown */}
      {(pmCounts.cash + pmCounts.card + pmCounts.transfer) > 0 && (
        <View style={styles.pmCard}>
          <Text style={styles.pmTitle}>طرق الدفع</Text>
          <View style={styles.pmRow}>
            {(["cash", "card", "transfer"] as PaymentMethod[]).map((pm) => (
              pmCounts[pm] > 0 ? (
                <View key={pm} style={[styles.pmItem, pm === topPm?.[0] && styles.pmItemTop]}>
                  <Text style={styles.pmCount}>{pmCounts[pm]}</Text>
                  <Text style={styles.pmLabel}>{PAYMENT_LABELS[pm]}</Text>
                </View>
              ) : null
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Operations Overview ──────────────────────────────────────────────────
function OperationsSection({ orders }: { orders: Order[] }) {
  const today = todayStr();
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(today));

  // overall
  const totalAll = orders.length;
  const totalToday = todayOrders.length;
  const doneAll = orders.filter((o) =>
    Object.values(o.departmentStatuses).every((s) => s === "done")
  ).length;

  // per dept
  function deptStats(dept: Department) {
    const deptOrders = orders.filter((o) => o.items.some((i) => i.department === dept));
    const pending = deptOrders.filter((o) => o.departmentStatuses[dept] === "pending").length;
    const inProg = deptOrders.filter((o) => o.departmentStatuses[dept] === "in_progress").length;
    const done = deptOrders.filter((o) => o.departmentStatuses[dept] === "done").length;
    return { total: deptOrders.length, pending, inProg, done };
  }

  const halwa = deptStats("halwa");
  const mawali = deptStats("mawali");

  return (
    <View style={styles.section}>
      <SectionHeader title="مراقبة سير العمل" icon="activity" />

      <View style={styles.statsGrid}>
        <StatCard icon="file-text" label="إجمالي الطلبات" value={totalAll} color={Colors.primary} />
        <StatCard icon="calendar" label="طلبات اليوم" value={totalToday} color={Colors.info} />
        <StatCard icon="check-circle" label="مكتملة بالكامل" value={doneAll} color={Colors.success} />
        <StatCard icon="clock" label="قيد التنفيذ" value={totalAll - doneAll} color={Colors.warning} />
      </View>

      {/* Dept breakdown */}
      {[
        { dept: "halwa" as Department, label: "قسم الحلا", stats: halwa, color: Colors.halwa },
        { dept: "mawali" as Department, label: "قسم الموالح", stats: mawali, color: Colors.mawali },
      ].map(({ label, stats, color }) => (
        <View key={label} style={[styles.deptCard, { borderLeftColor: color }]}>
          <Text style={[styles.deptCardTitle, { color }]}>{label}</Text>
          <View style={styles.deptCardStats}>
            <View style={styles.deptStat}>
              <Text style={styles.deptStatNum}>{stats.total}</Text>
              <Text style={styles.deptStatLabel}>إجمالي</Text>
            </View>
            <View style={styles.deptStatDivider} />
            <View style={styles.deptStat}>
              <Text style={[styles.deptStatNum, { color: Colors.statusPending }]}>{stats.pending}</Text>
              <Text style={styles.deptStatLabel}>انتظار</Text>
            </View>
            <View style={styles.deptStatDivider} />
            <View style={styles.deptStat}>
              <Text style={[styles.deptStatNum, { color: Colors.statusInProgress }]}>{stats.inProg}</Text>
              <Text style={styles.deptStatLabel}>تحضير</Text>
            </View>
            <View style={styles.deptStatDivider} />
            <View style={styles.deptStat}>
              <Text style={[styles.deptStatNum, { color: Colors.statusDone }]}>{stats.done}</Text>
              <Text style={styles.deptStatLabel}>تم</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Cashier Performance ──────────────────────────────────────────────────
function CashierPerformanceSection({ orders }: { orders: Order[] }) {
  const byEmp = useMemo(() => {
    const map: Record<string, { name: string; empId: string; count: number; revenue: number; insurance: number }> = {};
    orders.forEach((o) => {
      const key = o.cashierEmployee?.employeeId ?? "__unknown__";
      if (!map[key]) {
        map[key] = {
          name: o.cashierEmployee?.name ?? "غير محدد",
          empId: o.cashierEmployee?.employeeId ?? "-",
          count: 0,
          revenue: 0,
          insurance: 0,
        };
      }
      map[key].count++;
      map[key].revenue += o.totalAmount ?? 0;
      map[key].insurance += o.insuranceAmount ?? 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [orders]);

  if (byEmp.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="أداء الكاشيرية" icon="bar-chart-2" />
      {byEmp.map((emp, idx) => (
        <View key={idx} style={styles.perfRow}>
          <View style={styles.perfRank}>
            <Text style={styles.perfRankText}>{idx + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.perfName}>{emp.name}</Text>
            <Text style={styles.perfId}>#{emp.empId}</Text>
          </View>
          <View style={styles.perfStats}>
            <View style={styles.perfStat}>
              <Text style={styles.perfStatNum}>{emp.count}</Text>
              <Text style={styles.perfStatLabel}>فاتورة</Text>
            </View>
            {emp.revenue > 0 && (
              <View style={[styles.perfStat, { backgroundColor: Colors.success + "15" }]}>
                <Text style={[styles.perfStatNum, { color: Colors.success }]}>{fmtCurrency(emp.revenue)}</Text>
                <Text style={[styles.perfStatLabel, { color: Colors.success }]}>إيرادات</Text>
              </View>
            )}
            {emp.insurance > 0 && (
              <View style={[styles.perfStat, { backgroundColor: Colors.gold + "18" }]}>
                <Text style={[styles.perfStatNum, { color: Colors.gold }]}>{fmtCurrency(emp.insurance)}</Text>
                <Text style={[styles.perfStatLabel, { color: Colors.gold }]}>تأمين</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────
function RecentActivitySection({ orders }: { orders: Order[] }) {
  const recent = orders.slice(0, 8);
  if (recent.length === 0) return null;

  const statusConf = {
    pending: { label: "انتظار", color: Colors.statusPending },
    in_progress: { label: "تحضير", color: Colors.statusInProgress },
    done: { label: "تم", color: Colors.statusDone },
    cancelled: { label: "ملغي", color: Colors.statusCancelled },
  };

  function overallStatus(order: Order) {
    const statuses = Object.values(order.departmentStatuses);
    if (statuses.every((s) => s === "done")) return "done";
    if (statuses.some((s) => s === "in_progress")) return "in_progress";
    return "pending";
  }

  return (
    <View style={styles.section}>
      <SectionHeader title="آخر الفواتير" icon="list" />
      {recent.map((o) => {
        const os = overallStatus(o);
        const conf = statusConf[os];
        const depts = [...new Set(o.items.map((i) => i.department))];
        return (
          <View key={o.id} style={styles.actRow}>
            <View style={styles.actNumBox}>
              <Text style={styles.actNum}>#{o.orderNumber}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actName} numberOfLines={1}>{o.customerName}</Text>
              <View style={styles.actDepts}>
                {depts.includes("halwa") && (
                  <Text style={[styles.actDeptTag, { backgroundColor: Colors.halwa + "20", color: Colors.halwa }]}>حلا</Text>
                )}
                {depts.includes("mawali") && (
                  <Text style={[styles.actDeptTag, { backgroundColor: Colors.mawali + "20", color: Colors.mawali }]}>موالح</Text>
                )}
              </View>
            </View>
            <View style={styles.actRight}>
              <View style={[styles.actStatusBadge, { backgroundColor: conf.color + "18" }]}>
                <View style={[styles.actStatusDot, { backgroundColor: conf.color }]} />
                <Text style={[styles.actStatusText, { color: conf.color }]}>{conf.label}</Text>
              </View>
              {o.totalAmount ? (
                <Text style={styles.actInsurance}>{fmtCurrency(o.totalAmount)}</Text>
              ) : o.insuranceAmount ? (
                <Text style={[styles.actInsurance, { color: Colors.primaryLight }]}>
                  تأمين {fmtCurrency(o.insuranceAmount)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Products Section ─────────────────────────────────────────────────────
function ProductsSection() {
  const { products, deleteProduct, updateProduct } = useProducts();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [filterDept, setFilterDept] = useState<"all" | "halwa" | "mawali" | "chocolate" | "cake">("all");
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    if (filterDept !== "all" && p.department !== filterDept) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.nameEn ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const halwaCount     = products.filter((p) => p.department === "halwa").length;
  const mawaliCount    = products.filter((p) => p.department === "mawali").length;
  const chocolateCount = products.filter((p) => p.department === "chocolate").length;
  const cakeCount      = products.filter((p) => p.department === "cake").length;
  const unavailableCount = products.filter((p) => !p.isAvailable).length;

  const handleDelete = (prod: Product) => {
    Alert.alert(
      "حذف المنتج",
      `هل تريد حذف "${prod.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => deleteProduct(prod.id) },
      ]
    );
  };

  const handleToggleAvail = (prod: Product) => {
    Haptics.selectionAsync();
    updateProduct(prod.id, { isAvailable: !prod.isAvailable });
  };

  const openAdd = () => { setEditing(null); setModalVisible(true); };
  const openEdit = (p: Product) => { setEditing(p); setModalVisible(true); };

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.prodHeader}>
        <SectionHeader title="إدارة المنتجات" icon="shopping-bag" />
        <TouchableOpacity style={styles.addProdBtn} onPress={openAdd} activeOpacity={0.85}>
          <Feather name="plus" size={15} color="#fff" />
          <Text style={styles.addProdBtnText}>إضافة منتج</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.prodStats}>
        <View style={[styles.prodStatPill, { backgroundColor: Colors.primary + "12" }]}>
          <Text style={[styles.prodStatNum, { color: Colors.primary }]}>{products.length}</Text>
          <Text style={[styles.prodStatLabel, { color: Colors.primary }]}>الكل</Text>
        </View>
        <View style={[styles.prodStatPill, { backgroundColor: Colors.halwa + "12" }]}>
          <Text style={[styles.prodStatNum, { color: Colors.halwa }]}>{halwaCount}</Text>
          <Text style={[styles.prodStatLabel, { color: Colors.halwa }]}>حلا</Text>
        </View>
        <View style={[styles.prodStatPill, { backgroundColor: Colors.mawali + "12" }]}>
          <Text style={[styles.prodStatNum, { color: Colors.mawali }]}>{mawaliCount}</Text>
          <Text style={[styles.prodStatLabel, { color: Colors.mawali }]}>موالح</Text>
        </View>
        <View style={[styles.prodStatPill, { backgroundColor: Colors.chocolate + "12" }]}>
          <Text style={[styles.prodStatNum, { color: Colors.chocolate }]}>{chocolateCount}</Text>
          <Text style={[styles.prodStatLabel, { color: Colors.chocolate }]}>شوكلت</Text>
        </View>
        <View style={[styles.prodStatPill, { backgroundColor: Colors.cake + "12" }]}>
          <Text style={[styles.prodStatNum, { color: Colors.cake }]}>{cakeCount}</Text>
          <Text style={[styles.prodStatLabel, { color: Colors.cake }]}>كيك</Text>
        </View>
        {unavailableCount > 0 && (
          <View style={[styles.prodStatPill, { backgroundColor: Colors.accent + "12" }]}>
            <Text style={[styles.prodStatNum, { color: Colors.accent }]}>{unavailableCount}</Text>
            <Text style={[styles.prodStatLabel, { color: Colors.accent }]}>غير متوفر</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.prodSearch}>
        <Feather name="search" size={14} color={Colors.textMuted} />
        <TextInput
          style={styles.prodSearchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="بحث عن منتج..."
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter tabs */}
      <View style={styles.prodFilterRow}>
        {(["all", "halwa", "mawali", "chocolate", "cake"] as const).map((f) => {
          const labels: Record<string, string> = {
            all: "الكل", halwa: "حلا", mawali: "موالح", chocolate: "شوكلت", cake: "كيك",
          };
          const colors: Record<string, string> = {
            all: Colors.primary, halwa: Colors.halwa, mawali: Colors.mawali,
            chocolate: Colors.chocolate, cake: Colors.cake,
          };
          const isActive = filterDept === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.prodFilterChip, isActive && { backgroundColor: colors[f], borderColor: colors[f] }]}
              onPress={() => { Haptics.selectionAsync(); setFilterDept(f); }}
            >
              <Text style={[styles.prodFilterText, isActive && { color: "#fff" }]}>{labels[f]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Products list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="shopping-bag" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{search ? "لا توجد نتائج" : "لا يوجد منتجات — أضف الآن"}</Text>
        </View>
      ) : (
        filtered.map((prod) => {
          const deptColorMap: Record<string, string> = {
            halwa: Colors.halwa, mawali: Colors.mawali, chocolate: Colors.chocolate, cake: Colors.cake,
          };
          const deptLabelMap: Record<string, string> = {
            halwa: "حلا", mawali: "موالح", chocolate: "شوكلت", cake: "كيك",
          };
          const deptIconMap: Record<string, string> = {
            halwa: "coffee", mawali: "package", chocolate: "gift", cake: "layers",
          };
          const deptColor = deptColorMap[prod.department] ?? Colors.primary;
          const deptLabel = deptLabelMap[prod.department] ?? prod.department;
          return (
            <View key={prod.id} style={[styles.prodRow, !prod.isAvailable && { opacity: 0.6 }]}>
              {/* Image/icon */}
              <View style={[styles.prodThumb, { backgroundColor: deptColor + "15" }]}>
                {prod.imageUri ? (
                  <Image source={{ uri: prod.imageUri }} style={styles.prodThumbImg} contentFit="cover" />
                ) : (
                  <Feather name={deptIconMap[prod.department] as any ?? "tag"} size={18} color={deptColor} />
                )}
              </View>
              {/* Info */}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.prodRowName} numberOfLines={1}>{prod.name}</Text>
                  <View style={[styles.prodDeptBadge, { backgroundColor: deptColor }]}>
                    <Text style={styles.prodDeptBadgeText}>{deptLabel}</Text>
                  </View>
                </View>
                {prod.nameEn ? <Text style={styles.prodRowNameEn} numberOfLines={1}>{prod.nameEn}</Text> : null}
                <Text style={[styles.prodRowPrice, { color: Colors.gold }]}>
                  {prod.price.toFixed(2)} ر.س
                </Text>
              </View>
              {/* Actions */}
              <View style={styles.prodActions}>
                <TouchableOpacity
                  style={[styles.prodActionBtn, { backgroundColor: prod.isAvailable ? Colors.success + "18" : Colors.textMuted + "18" }]}
                  onPress={() => handleToggleAvail(prod)}
                  hitSlop={6}
                >
                  <Feather name={prod.isAvailable ? "eye" : "eye-off"} size={14} color={prod.isAvailable ? Colors.success : Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.prodActionBtn, { backgroundColor: Colors.primary + "18" }]}
                  onPress={() => openEdit(prod)} hitSlop={6}
                >
                  <Feather name="edit-2" size={14} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.prodActionBtn, { backgroundColor: Colors.accent + "18" }]}
                  onPress={() => handleDelete(prod)} hitSlop={6}
                >
                  <Feather name="trash-2" size={14} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <ProductManagerModal
        visible={modalVisible}
        product={editing}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Offers Section ───────────────────────────────────────────────────────
function OffersSection() {
  const { offers, addOffer, updateOffer, deleteOffer } = useOffers();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [reason, setReason] = useState("");
  const [limitUsage, setLimitUsage] = useState(false);
  const [maxUsage, setMaxUsage] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const openAdd = () => {
    setEditing(null);
    setPhone(""); setCustomerName(""); setDiscountType("percentage");
    setDiscountValue(""); setReason(""); setLimitUsage(false);
    setMaxUsage(""); setHasExpiry(false); setExpiresAt(""); setNotes("");
    setModalVisible(true);
  };

  const openEdit = (offer: Offer) => {
    setEditing(offer);
    setPhone(offer.phoneNumber);
    setCustomerName(offer.customerName ?? "");
    setDiscountType(offer.discountType);
    setDiscountValue(offer.discountValue.toString());
    setReason(offer.reason);
    setLimitUsage(offer.maxUsage !== null);
    setMaxUsage(offer.maxUsage?.toString() ?? "");
    setHasExpiry(!!offer.expiresAt);
    setExpiresAt(offer.expiresAt ?? "");
    setNotes(offer.notes ?? "");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!phone.trim()) { Alert.alert("خطأ", "رقم الهاتف مطلوب"); return; }
    const val = parseFloat(discountValue);
    if (!val || val <= 0) { Alert.alert("خطأ", "قيمة الخصم يجب أن تكون أكبر من صفر"); return; }
    if (discountType === "percentage" && val > 100) { Alert.alert("خطأ", "نسبة الخصم لا تتجاوز 100%"); return; }

    const data = {
      phoneNumber: phone.trim(),
      customerName: customerName.trim() || undefined,
      discountType,
      discountValue: val,
      reason: reason.trim(),
      active: editing?.active ?? true,
      maxUsage: limitUsage && maxUsage.trim() ? parseInt(maxUsage) : null,
      expiresAt: hasExpiry && expiresAt.trim() ? expiresAt.trim() : null,
      notes: notes.trim() || undefined,
    };

    try {
      if (editing) {
        await updateOffer(editing.id, data);
      } else {
        await addOffer(data);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
    } catch {
      Alert.alert("خطأ", "فشل الحفظ، حاول مرة أخرى");
    }
  };

  const handleDelete = (offer: Offer) => {
    Alert.alert(
      "حذف العرض",
      `هل تريد حذف عرض الزبون ${offer.phoneNumber}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => deleteOffer(offer.id) },
      ]
    );
  };

  const toggleActive = (offer: Offer) => {
    updateOffer(offer.id, { active: !offer.active });
    Haptics.selectionAsync();
  };

  const activeCount = offers.filter((o) => o.active).length;
  const totalUsage = offers.reduce((s, o) => s + o.usageCount, 0);

  return (
    <View style={styles.section}>
      <SectionHeader title="عروض الزبائن" icon="tag" />

      {/* Stats bar */}
      <View style={styles.offerStats}>
        <View style={styles.offerStatBox}>
          <Text style={styles.offerStatNum}>{offers.length}</Text>
          <Text style={styles.offerStatLabel}>إجمالي</Text>
        </View>
        <View style={[styles.offerStatBox, { borderColor: Colors.success + "40" }]}>
          <Text style={[styles.offerStatNum, { color: Colors.success }]}>{activeCount}</Text>
          <Text style={styles.offerStatLabel}>نشطة</Text>
        </View>
        <View style={[styles.offerStatBox, { borderColor: Colors.gold + "40" }]}>
          <Text style={[styles.offerStatNum, { color: Colors.gold }]}>{totalUsage}</Text>
          <Text style={styles.offerStatLabel}>مرة استُخدم</Text>
        </View>
      </View>

      {/* Add button */}
      <TouchableOpacity style={styles.addOfferBtn} onPress={openAdd} activeOpacity={0.85}>
        <Feather name="plus" size={16} color="#fff" />
        <Text style={styles.addOfferBtnText}>إضافة عرض جديد</Text>
      </TouchableOpacity>

      {/* List */}
      {offers.length === 0 ? (
        <View style={styles.offerEmpty}>
          <Feather name="tag" size={36} color={Colors.textMuted} />
          <Text style={styles.offerEmptyText}>لا توجد عروض بعد</Text>
          <Text style={styles.offerEmptyHint}>أضف عروضاً مخصصة لزبائنك بحسب رقم الهاتف</Text>
        </View>
      ) : (
        offers.map((offer) => (
          <View key={offer.id} style={[styles.offerCard, !offer.active && styles.offerCardInactive]}>
            {/* Header */}
            <View style={styles.offerCardHeader}>
              <View style={styles.offerPhoneRow}>
                <View style={[styles.offerPhoneIcon, offer.active && styles.offerPhoneIconActive]}>
                  <Feather name="phone" size={13} color={offer.active ? "#fff" : Colors.textMuted} />
                </View>
                <View>
                  <Text style={[styles.offerPhone, !offer.active && styles.offerPhoneDim]}>
                    {offer.phoneNumber}
                  </Text>
                  {offer.customerName ? (
                    <Text style={styles.offerCustomerName}>{offer.customerName}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.offerCardActions}>
                <TouchableOpacity
                  style={[styles.offerStatusPill, offer.active && styles.offerStatusPillActive]}
                  onPress={() => toggleActive(offer)}
                >
                  <Text style={[styles.offerStatusText, offer.active && styles.offerStatusTextActive]}>
                    {offer.active ? "نشط" : "موقوف"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(offer)} hitSlop={8}>
                  <Feather name="edit-2" size={14} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(offer)} hitSlop={8}>
                  <Feather name="trash-2" size={14} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Discount info */}
            <View style={styles.offerDiscountRow}>
              <View style={styles.offerDiscountBadge}>
                <Feather name="tag" size={12} color={Colors.warning} />
                <Text style={styles.offerDiscountText}>
                  {offer.discountType === "percentage"
                    ? `${offer.discountValue}% خصم`
                    : `${offer.discountValue.toFixed(2)} ر.س خصم`}
                </Text>
              </View>
              {offer.reason ? <Text style={styles.offerReason}>{offer.reason}</Text> : null}
            </View>

            {/* Footer */}
            <View style={styles.offerFooter}>
              <View style={styles.offerUsagePill}>
                <Feather name="refresh-cw" size={10} color={Colors.textMuted} />
                <Text style={styles.offerUsageText}>
                  {offer.usageCount} استخدام
                  {offer.maxUsage !== null ? ` / ${offer.maxUsage}` : ""}
                </Text>
              </View>
              {offer.expiresAt ? (
                <View style={styles.offerUsagePill}>
                  <Feather name="calendar" size={10} color={Colors.textMuted} />
                  <Text style={styles.offerUsageText}>ينتهي {offer.expiresAt.slice(0, 10)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}

      {/* ─── Add/Edit Modal ─── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.offerModalOverlay}>
          <View style={styles.offerModalSheet}>
            <View style={styles.offerModalHandle} />
            <View style={styles.offerModalHeader}>
              <Text style={styles.offerModalTitle}>
                {editing ? "تعديل العرض" : "إضافة عرض جديد"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.offerModalBody} keyboardShouldPersistTaps="handled">
              {/* Phone */}
              <Text style={styles.offerModalLabel}>رقم هاتف الزبون *</Text>
              <View style={styles.offerModalInputRow}>
                <Feather name="phone" size={16} color={Colors.primary} />
                <TextInput
                  style={styles.offerModalInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="05XXXXXXXX"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  textAlign="right"
                />
              </View>

              {/* Customer name */}
              <Text style={styles.offerModalLabel}>اسم الزبون (اختياري)</Text>
              <TextInput
                style={styles.offerModalInputBox}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="اسم الزبون..."
                placeholderTextColor={Colors.textMuted}
                textAlign="right"
              />

              {/* Discount type */}
              <Text style={styles.offerModalLabel}>نوع الخصم</Text>
              <View style={styles.offerTypeRow}>
                {(["percentage", "fixed"] as DiscountType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.offerTypeBtn, discountType === t && styles.offerTypeBtnActive]}
                    onPress={() => { Haptics.selectionAsync(); setDiscountType(t); }}
                  >
                    <Text style={[styles.offerTypeBtnText, discountType === t && styles.offerTypeBtnTextActive]}>
                      {t === "percentage" ? "نسبة %" : "مبلغ ثابت ر.س"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Discount value */}
              <Text style={styles.offerModalLabel}>قيمة الخصم *</Text>
              <View style={styles.offerModalInputRow}>
                <TextInput
                  style={[styles.offerModalInput, { flex: 1 }]}
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  placeholder={discountType === "percentage" ? "مثال: 15" : "مثال: 25.00"}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  textAlign="right"
                />
                <View style={styles.offerUnitBox}>
                  <Text style={styles.offerUnitText}>{discountType === "percentage" ? "%" : "ر.س"}</Text>
                </View>
              </View>

              {/* Reason presets */}
              <Text style={styles.offerModalLabel}>سبب العرض</Text>
              <View style={styles.offerPresets}>
                {DISCOUNT_REASON_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.offerPresetChip, reason === p && styles.offerPresetChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setReason(reason === p ? "" : p); }}
                  >
                    <Text style={[styles.offerPresetText, reason === p && styles.offerPresetTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.offerModalInputBox}
                value={reason}
                onChangeText={setReason}
                placeholder="أو اكتب سبباً مخصصاً..."
                placeholderTextColor={Colors.textMuted}
                textAlign="right"
              />

              {/* Max usage toggle */}
              <TouchableOpacity
                style={styles.offerToggleRow}
                onPress={() => { Haptics.selectionAsync(); setLimitUsage((v) => !v); }}
              >
                <Text style={styles.offerToggleLabel}>تحديد عدد الاستخدامات</Text>
                <View style={[styles.miniSwitch, limitUsage && styles.miniSwitchActive]}>
                  <View style={[styles.miniThumb, limitUsage && styles.miniThumbActive]} />
                </View>
              </TouchableOpacity>
              {limitUsage && (
                <TextInput
                  style={styles.offerModalInputBox}
                  value={maxUsage}
                  onChangeText={setMaxUsage}
                  placeholder="عدد مرات الاستخدام (مثال: 3)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  textAlign="right"
                />
              )}

              {/* Expiry toggle */}
              <TouchableOpacity
                style={styles.offerToggleRow}
                onPress={() => { Haptics.selectionAsync(); setHasExpiry((v) => !v); }}
              >
                <Text style={styles.offerToggleLabel}>تحديد تاريخ انتهاء العرض</Text>
                <View style={[styles.miniSwitch, hasExpiry && styles.miniSwitchActive]}>
                  <View style={[styles.miniThumb, hasExpiry && styles.miniThumbActive]} />
                </View>
              </TouchableOpacity>
              {hasExpiry && (
                <TextInput
                  style={styles.offerModalInputBox}
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD (مثال: 2026-06-01)"
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                />
              )}

              {/* Notes */}
              <Text style={styles.offerModalLabel}>ملاحظات (اختياري)</Text>
              <TextInput
                style={[styles.offerModalInputBox, { height: 70, textAlignVertical: "top" }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="أي ملاحظات..."
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlign="right"
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Actions */}
            <View style={styles.offerModalActions}>
              <TouchableOpacity style={styles.offerModalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.offerModalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.offerModalSaveBtn} onPress={handleSave} activeOpacity={0.85}>
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.offerModalSaveText}>{editing ? "حفظ التعديلات" : "إضافة العرض"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Price Requests Section ────────────────────────────────────────────────
function PriceRequestsSection() {
  const { requests, approveRequest, rejectRequest } = usePriceChange();
  const pending = requests.filter((r) => r.status === "pending");

  return (
    <View style={styles.section}>
      <SectionHeader title="طلبات تعديل الأسعار" icon="tag" />

      {pending.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="check-circle" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>لا توجد طلبات معلقة</Text>
        </View>
      ) : (
        pending.map((req) => (
          <View key={req.id} style={styles.priceReqCard}>
            <View style={styles.priceReqHeader}>
              <Text style={styles.priceReqProduct}>{req.productName}</Text>
              <View style={styles.priceReqBadge}>
                <Text style={styles.priceReqBadgeText}>معلق</Text>
              </View>
            </View>

            <View style={styles.priceReqRow}>
              <Text style={styles.priceReqLabel}>السعر الحالي:</Text>
              <Text style={styles.priceReqCurrent}>{fmtCurrency(req.currentPrice)}</Text>
              <Feather name="arrow-left" size={12} color={Colors.textMuted} />
              <Text style={styles.priceReqNew}>{fmtCurrency(req.newPrice)}</Text>
            </View>

            {req.reason ? (
              <Text style={styles.priceReqReason}>{req.reason}</Text>
            ) : null}

            <Text style={styles.priceReqBy}>
              بواسطة: {req.requestedBy.name} • {new Date(req.createdAt).toLocaleDateString("ar-SA")}
            </Text>

            <View style={styles.priceReqActions}>
              <TouchableOpacity
                style={[styles.priceReqBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => approveRequest(req.id)}
                activeOpacity={0.8}
              >
                <Feather name="check" size={14} color="#fff" />
                <Text style={styles.priceReqBtnText}>موافقة</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priceReqBtn, { backgroundColor: Colors.statusCancelled }]}
                onPress={() => rejectRequest(req.id)}
                activeOpacity={0.8}
              >
                <Feather name="x" size={14} color="#fff" />
                <Text style={styles.priceReqBtnText}>رفض</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Recent resolved */}
      {requests.filter((r) => r.status !== "pending").length > 0 && (
        <>
          <Text style={styles.resolvedTitle}>المنجزة مؤخراً</Text>
          {requests
            .filter((r) => r.status !== "pending")
            .slice(0, 5)
            .map((req) => (
              <View key={req.id} style={[styles.priceReqCard, { opacity: 0.6 }]}>
                <View style={styles.priceReqHeader}>
                  <Text style={styles.priceReqProduct}>{req.productName}</Text>
                  <View style={[styles.priceReqBadge, {
                    backgroundColor: req.status === "approved" ? "#16a34a20" : Colors.statusCancelled + "20",
                    borderColor: req.status === "approved" ? "#16a34a40" : Colors.statusCancelled + "40",
                  }]}>
                    <Text style={[styles.priceReqBadgeText, {
                      color: req.status === "approved" ? "#16a34a" : Colors.statusCancelled,
                    }]}>
                      {req.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceReqRow}>
                  <Text style={styles.priceReqLabel}>التعديل:</Text>
                  <Text style={styles.priceReqCurrent}>{fmtCurrency(req.currentPrice)}</Text>
                  <Feather name="arrow-left" size={12} color={Colors.textMuted} />
                  <Text style={styles.priceReqNew}>{fmtCurrency(req.newPrice)}</Text>
                </View>
              </View>
            ))}
        </>
      )}
    </View>
  );
}

// ─── Features Section ──────────────────────────────────────────────────────
const FEATURE_ITEMS: { key: keyof AppFeatures; label: string; icon: string; color: string }[] = [
  { key: "halwaEnabled",     label: "حلا زفة و ضيافة",  icon: "coffee",       color: Colors.halwa },
  { key: "mawaliEnabled",    label: "معجنات و موالح",   icon: "package",      color: Colors.mawali },
  { key: "chocolateEnabled", label: "شوكولاتة",          icon: "gift",         color: Colors.chocolate },
  { key: "cakeEnabled",      label: "كيك",              icon: "layers",       color: Colors.cake },
  { key: "packagingEnabled", label: "التغليف",           icon: "box",          color: Colors.packaging },
  { key: "reportsEnabled",   label: "التقارير",          icon: "pie-chart",    color: "#8b5cf6" },
  { key: "customersEnabled", label: "العملاء",           icon: "users",        color: "#0891b2" },
  { key: "deliveryEnabled",  label: "التوصيل",           icon: "truck",        color: "#0d9488" },
  { key: "traysEnabled",     label: "الصواني",           icon: "layers",       color: Colors.gold },
];

function FeaturesSection() {
  const { features, setFeature, isLoading } = useFeatures();

  return (
    <View style={styles.section}>
      <SectionHeader title="إعدادات الأقسام" icon="sliders" />
      <Text style={styles.featuresDesc}>تفعيل أو تعطيل الأقسام والميزات</Text>

      {FEATURE_ITEMS.map((item) => {
        const enabled = features[item.key];
        return (
          <View key={item.key} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: item.color + "20" }]}>
              <Feather name={item.icon as any} size={16} color={item.color} />
            </View>
            <Text style={styles.featureLabel}>{item.label}</Text>
            <TouchableOpacity
              style={[styles.featureToggle, enabled && styles.featureToggleOn]}
              onPress={() => setFeature(item.key, !enabled)}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <View style={[styles.featureThumb, enabled && styles.featureThumbOn]} />
            </TouchableOpacity>
            <Text style={[styles.featureStatus, enabled ? styles.featureStatusOn : styles.featureStatusOff]}>
              {enabled ? "مفعّل" : "معطّل"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const { currentEmployee } = useEmployee();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "products" | "offers" | "priceRequests" | "features">("overview");
  const [showDev, setShowDev] = useState(false);
  const { pendingCount: priceReqCount } = usePriceChange();

  const isAdmin =
    currentEmployee?.role === "admin" || currentEmployee?.role === "cashier";

  const TABS = [
    { key: "overview",      label: t("adminTabOverview"),  icon: "grid" },
    { key: "products",      label: t("adminTabProducts"),  icon: "shopping-bag" },
    { key: "employees",     label: t("adminTabEmployees"), icon: "users" },
    { key: "offers",        label: t("adminTabOffers"),    icon: "tag" },
    { key: "priceRequests", label: `${t("adminTabPrices")}${priceReqCount > 0 ? ` (${priceReqCount})` : ""}`, icon: "dollar-sign" },
    { key: "features",      label: t("adminTabFeatures"),  icon: "sliders" },
  ] as const;

  return (
    <View style={styles.container}>
      {/* Dev settings modal */}
      <DevSettingsModal visible={showDev} onClose={() => setShowDev(false)} />

      {/* Tab bar with hidden dev button */}
      <View style={styles.tabBarWrapper}>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(t.key); }}
          >
            <Feather name={t.icon} size={15} color={activeTab === t.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
        {/* Hidden developer button */}
        <TouchableOpacity
          style={styles.devBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setShowDev(true); }}
          hitSlop={6}
        >
          <Feather name="settings" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "overview" ? (
          <>
            {/* Access warning */}
            {!currentEmployee && (
              <View style={styles.warningBanner}>
                <Feather name="alert-triangle" size={15} color={Colors.warning} />
                <Text style={styles.warningText}>
                  سجّل دخولك للاطلاع على البيانات الكاملة
                </Text>
              </View>
            )}

            {/* Summary cards */}
            <FinancialSection orders={orders} />
            <OperationsSection orders={orders} />
            <CashierPerformanceSection orders={orders} />
            <RecentActivitySection orders={orders} />
          </>
        ) : activeTab === "products" ? (
          <ProductsSection />
        ) : activeTab === "offers" ? (
          <OffersSection />
        ) : activeTab === "priceRequests" ? (
          <PriceRequestsSection />
        ) : activeTab === "features" ? (
          <FeaturesSection />
        ) : (
          <EmployeesSection />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // tabs
  tabBarWrapper: {
    flexDirection: "row", alignItems: "center",
    paddingRight: 12, marginTop: 12, marginBottom: 4,
  },
  tabBar: {
    flex: 1, flexDirection: "row", backgroundColor: Colors.surface,
    marginLeft: 16,
    borderRadius: 14, padding: 4,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  devBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.borderLight,
    marginLeft: 6,
  },
  tabItem: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabItemActive: { backgroundColor: Colors.primary + "12" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary },

  scroll: { padding: 16, gap: 16 },

  // warning
  warningBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.warning + "12", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.warning + "30",
  },
  warningText: { flex: 1, fontSize: 13, color: Colors.warning, fontWeight: "600" },

  // section
  section: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 12,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  sectionIconBox: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.primary },

  // stat cards
  statsGrid: { gap: 10 },
  statCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    borderLeftWidth: 4,
  },
  statIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 17, fontWeight: "800", color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  statSub: { fontSize: 11, color: Colors.textMuted },

  // dept breakdown
  deptCard: {
    borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 12,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12,
  },
  deptCardTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  deptCardStats: { flexDirection: "row", alignItems: "center" },
  deptStat: { flex: 1, alignItems: "center" },
  deptStatNum: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  deptStatLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  deptStatDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  // employees section
  empCountRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  empCountPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  empCountNum: { fontSize: 16, fontWeight: "800" },
  empCountLabel: { fontSize: 12, fontWeight: "600" },
  emptyBox: { alignItems: "center", gap: 10, paddingVertical: 30 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4, marginBottom: 4 },
  roleTagText: { fontSize: 12, fontWeight: "700" },
  empRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  empAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  empAvatarLetter: { color: "#fff", fontSize: 16, fontWeight: "800" },
  empName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  empIdText: { fontSize: 12, color: Colors.textMuted },
  delBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.accent + "10",
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.primary + "50",
    borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  addBtnText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  addForm: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 14, gap: 8, marginTop: 4,
  },
  formLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  formInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14,
    color: Colors.text, backgroundColor: Colors.surface,
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  roleChipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: "center",
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  cancelBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: Colors.primary, paddingVertical: 11, borderRadius: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // cashier performance
  perfRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  perfRank: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  perfRankText: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  perfName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  perfId: { fontSize: 11, color: Colors.textMuted },
  perfStats: { flexDirection: "row", gap: 8 },
  perfStat: {
    alignItems: "center", paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 8,
  },
  perfStatNum: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  perfStatLabel: { fontSize: 10, color: Colors.textMuted },

  // recent activity
  actRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  actNumBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary + "10",
    alignItems: "center", justifyContent: "center",
  },
  actNum: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  actName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  actDepts: { flexDirection: "row", gap: 5, marginTop: 3 },
  actDeptTag: { fontSize: 10, fontWeight: "700", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  actRight: { alignItems: "flex-end", gap: 4 },
  actStatusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  actStatusDot: { width: 5, height: 5, borderRadius: 3 },
  actStatusText: { fontSize: 11, fontWeight: "600" },
  actInsurance: { fontSize: 11, color: Colors.gold, fontWeight: "700" },

  // payment method card in financial section
  pmCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginTop: 4,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  pmTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 10 },
  pmRow: { flexDirection: "row", gap: 10 },
  pmItem: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  pmItemTop: {
    backgroundColor: Colors.primary + "12", borderColor: Colors.primary + "40",
  },
  pmCount: { fontSize: 22, fontWeight: "800", color: Colors.primary },
  pmLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // products section
  prodHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addProdBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  addProdBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  prodStats: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  prodStatPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  prodStatNum: { fontSize: 16, fontWeight: "800" },
  prodStatLabel: { fontSize: 11, fontWeight: "600" },
  prodSearch: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  prodSearchInput: { flex: 1, fontSize: 13, color: Colors.text },
  prodFilterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  prodFilterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  prodFilterText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  prodRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  prodThumb: {
    width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  prodThumbImg: { width: "100%", height: "100%" },
  prodDeptBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  prodDeptBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  prodRowName: { fontSize: 13, fontWeight: "700", color: Colors.text, flex: 1 },
  prodRowNameEn: { fontSize: 11, color: Colors.textMuted },
  prodRowPrice: { fontSize: 13, fontWeight: "800" },
  prodActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  prodActionBtn: {
    width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center",
  },

  // ─── Offers Section Styles ────────────────────────────────────────────────
  offerStats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  offerStatBox: {
    flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 10,
    alignItems: "center", borderWidth: 1, borderColor: Colors.borderLight,
  },
  offerStatNum: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  offerStatLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  addOfferBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.gold, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    justifyContent: "center", marginBottom: 16,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  addOfferBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  offerEmpty: { alignItems: "center", paddingVertical: 36, gap: 8 },
  offerEmptyText: { fontSize: 15, fontWeight: "700", color: Colors.textSecondary },
  offerEmptyHint: { fontSize: 12, color: Colors.textMuted, textAlign: "center" },

  offerCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  offerCardInactive: { opacity: 0.55 },

  offerCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  offerPhoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  offerPhoneIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center",
  },
  offerPhoneIconActive: { backgroundColor: Colors.primary },
  offerPhone: { fontSize: 14, fontWeight: "700", color: Colors.text },
  offerPhoneDim: { color: Colors.textMuted },
  offerCustomerName: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  offerCardActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  offerStatusPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  offerStatusPillActive: { borderColor: Colors.success + "60", backgroundColor: Colors.success + "14" },
  offerStatusText: { fontSize: 10, fontWeight: "600", color: Colors.textMuted },
  offerStatusTextActive: { color: Colors.success },

  offerDiscountRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  offerDiscountBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.warning + "18", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.warning + "40",
  },
  offerDiscountText: { fontSize: 12, fontWeight: "700", color: Colors.warning },
  offerReason: { fontSize: 11, color: Colors.textSecondary, flex: 1, textAlign: "right" },

  offerFooter: { flexDirection: "row", gap: 8, alignItems: "center" },
  offerUsagePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1, borderColor: Colors.borderLight,
  },
  offerUsageText: { fontSize: 10, color: Colors.textMuted },

  // ─── Offer Modal ───────────────────────────────────────────────────────────
  offerModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end",
  },
  offerModalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  offerModalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  offerModalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  offerModalTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  offerModalBody: { padding: 20, gap: 6 },
  offerModalLabel: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary, marginBottom: 4, marginTop: 8 },
  offerModalInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  offerModalInput: { flex: 1, fontSize: 14, color: Colors.text },
  offerModalInputBox: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 12,
    fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight,
  },
  offerTypeRow: { flexDirection: "row", gap: 8 },
  offerTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
  },
  offerTypeBtnActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + "14" },
  offerTypeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  offerTypeBtnTextActive: { color: Colors.gold },
  offerUnitBox: {
    backgroundColor: Colors.borderLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  offerUnitText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },

  offerPresets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  offerPresetChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary,
  },
  offerPresetChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + "14" },
  offerPresetText: { fontSize: 11, color: Colors.textSecondary },
  offerPresetTextActive: { color: Colors.gold, fontWeight: "700" },

  offerToggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  offerToggleLabel: { fontSize: 13, color: Colors.text },
  miniSwitch: {
    width: 40, height: 22, borderRadius: 11, backgroundColor: Colors.borderLight,
    justifyContent: "center", padding: 2,
  },
  miniSwitchActive: { backgroundColor: Colors.success },
  miniThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.surface, alignSelf: "flex-end" },
  miniThumbActive: { alignSelf: "flex-start" },

  offerModalActions: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  offerModalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center",
    backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border,
  },
  offerModalCancelText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  offerModalSaveBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.gold,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  offerModalSaveText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // ─── Price Requests ───────────────────────────────────────────────────────
  priceReqCard: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight,
  },
  priceReqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  priceReqProduct: { fontSize: 15, fontWeight: "800", color: Colors.text, flex: 1 },
  priceReqBadge: {
    backgroundColor: Colors.warning + "20", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.warning + "40",
  },
  priceReqBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.warning },
  priceReqRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  priceReqLabel: { fontSize: 12, color: Colors.textSecondary },
  priceReqCurrent: { fontSize: 13, fontWeight: "700", color: Colors.textMuted, textDecorationLine: "line-through" },
  priceReqNew: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  priceReqReason: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, fontStyle: "italic" },
  priceReqBy: { fontSize: 11, color: Colors.textMuted, marginBottom: 10 },
  priceReqActions: { flexDirection: "row", gap: 8 },
  priceReqBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  priceReqBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  resolvedTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },

  // ─── Features ─────────────────────────────────────────────────────────────
  featuresDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  featureRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.text },
  featureToggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: Colors.borderLight, padding: 3, justifyContent: "center",
  },
  featureToggleOn: { backgroundColor: Colors.primary },
  featureThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", alignSelf: "flex-start" },
  featureThumbOn: { alignSelf: "flex-end" },
  featureStatus: { fontSize: 11, fontWeight: "700", width: 44, textAlign: "center" },
  featureStatusOn: { color: Colors.primary },
  featureStatusOff: { color: Colors.textMuted },
});
