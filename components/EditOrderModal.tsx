import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { DeliveryDatePicker, DeliveryTimePicker } from "@/components/DeliveryDateTimePicker";
import { Colors } from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import {
  Order,
  OrderItem,
  PaymentMethod,
} from "@/context/OrdersContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Editable item row – keeps string buffers so the user can type freely
interface EditableItem {
  id: string;
  name: string;
  quantityStr: string;
  priceStr: string;
  /** carry-over fields we must not lose */
  department: OrderItem["department"];
  note?: string;
  details?: string;
}

function orderItemToEditable(item: OrderItem): EditableItem {
  return {
    id: item.id,
    name: item.name,
    quantityStr: String(item.quantity),
    priceStr: item.price !== undefined ? String(item.price) : "",
    department: item.department,
    note: item.note,
    details: item.details,
  };
}

function editableToOrderItem(e: EditableItem): OrderItem {
  return {
    id: e.id,
    name: e.name.trim(),
    quantity: parseFloat(e.quantityStr) || 0,
    price: e.priceStr.trim() !== "" ? parseFloat(e.priceStr) : undefined,
    department: e.department,
    note: e.note,
    details: e.details,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Order>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditOrderModal({
  order,
  visible,
  onClose,
  onSave,
}: Props) {
  const { t } = useLang();
  // ---- local state ----------------------------------------------------------
  const [items, setItems] = useState<EditableItem[]>([]);
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaidStr, setAmountPaidStr] = useState("");

  // Seed state whenever the order prop changes (or modal opens)
  useEffect(() => {
    if (!order) return;
    setItems(order.items.map(orderItemToEditable));
    setNotes(order.notes ?? "");
    // Split "YYYY-MM-DD HH:MM" into date and time parts
    const parts = (order.deliveryTime ?? "").split(" ");
    setDeliveryDate(parts[0] ?? "");
    setDeliveryTimeSlot(parts[1] ?? "");
    setPaymentMethod(order.paymentMethod ?? "cash");
    setAmountPaidStr(
      order.amountPaid !== undefined ? String(order.amountPaid) : ""
    );
  }, [order]);

  // ---- item helpers ---------------------------------------------------------

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  function removeItem(id: string) {
    Haptics.selectionAsync();
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function addItem() {
    Haptics.selectionAsync();
    const newItem: EditableItem = {
      id: generateId(),
      name: "",
      quantityStr: "1",
      priceStr: "",
      department: "halwa", // sensible default; cashier can refine later
    };
    setItems((prev) => [...prev, newItem]);
  }

  // ---- save -----------------------------------------------------------------

  function handleSave() {
    if (!order) return;
    Haptics.selectionAsync();

    const cleanedItems: OrderItem[] = items
      .filter((it) => it.name.trim() !== "")
      .map(editableToOrderItem);

    const patch: Partial<Order> = {
      items: cleanedItems,
      notes: notes.trim() || undefined,
      deliveryTime: [deliveryDate.trim(), deliveryTimeSlot.trim()].filter(Boolean).join(" ") || undefined,
      paymentMethod,
      amountPaid:
        amountPaidStr.trim() !== "" ? parseFloat(amountPaidStr) : undefined,
    };

    onSave(order.id, patch);
  }

  // ---- payment method selector ----------------------------------------------

  const PAYMENT_OPTIONS: PaymentMethod[] = ["cash", "card", "transfer"];
  const PAYMENT_DISPLAY: Record<PaymentMethod, string> = {
    cash: t("cash"),
    card: t("paidCard"),
    transfer: t("transfer"),
  };

  // ---- render ---------------------------------------------------------------

  if (!order) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Dark overlay — tap to close */}
      <Pressable style={styles.overlay} onPress={onClose} />

      <KeyboardAvoidingView
        style={styles.sheetWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={styles.sheet}>
          {/* ----------------------------------------------------------------
              Header
          ---------------------------------------------------------------- */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {t("editOrderHeader")}{order.orderNumber}
            </Text>

            {/* spacer to balance the X button */}
            <View style={styles.headerSpacer} />
          </View>

          {/* ----------------------------------------------------------------
              Body
          ---------------------------------------------------------------- */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ---- Section: Items ---------------------------------------- */}
            <SectionCard title={t("itemsSection")}>
              {/* Column headers */}
              <View style={styles.itemHeaderRow}>
                <Text style={[styles.itemHeaderCell, { flex: 3 }]}>
                  {t("itemNameCol")}
                </Text>
                <Text style={[styles.itemHeaderCell, { flex: 1.2 }]}>
                  {t("qtyCol")}
                </Text>
                <Text style={[styles.itemHeaderCell, { flex: 1.5 }]}>
                  {t("priceCol")}
                </Text>
                <View style={{ width: 32 }} />
              </View>

              {items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isLast={index === items.length - 1}
                  onChange={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}

              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={addItem}
                activeOpacity={0.75}
              >
                <Feather name="plus" size={15} color={Colors.primary} />
                <Text style={styles.addItemBtnText}>{t("editAddItem")}</Text>
              </TouchableOpacity>
            </SectionCard>

            {/* ---- Section: Notes ---------------------------------------- */}
            <SectionCard title={t("notesSection")}>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("editNotesPh")}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
                onFocus={() => Haptics.selectionAsync()}
              />
            </SectionCard>

            {/* ---- Section: Delivery Time --------------------------------- */}
            <SectionCard title={t("editDeliveryTime")}>
              <DeliveryDatePicker
                value={deliveryDate}
                onChange={(iso) => setDeliveryDate(iso)}
                accentColor={Colors.primary}
              />
              {deliveryDate ? (
                <View style={{ marginTop: 8 }}>
                  <DeliveryTimePicker
                    value={deliveryTimeSlot}
                    onChange={setDeliveryTimeSlot}
                    accentColor={Colors.primary}
                  />
                </View>
              ) : null}
              {(deliveryDate || deliveryTimeSlot) && (
                <TouchableOpacity
                  onPress={() => { setDeliveryDate(""); setDeliveryTimeSlot(""); }}
                  style={styles.clearDTBtn}
                >
                  <Feather name="x-circle" size={13} color={Colors.textMuted} />
                  <Text style={styles.clearDTText}>{t("editClearSchedule")}</Text>
                </TouchableOpacity>
              )}
            </SectionCard>

            {/* ---- Section: Payment Method -------------------------------- */}
            <SectionCard title={t("paymentMethod")}>
              <View style={styles.paymentRow}>
                {PAYMENT_OPTIONS.map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentBtn,
                        active && styles.paymentBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setPaymentMethod(method);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.paymentBtnText,
                          active && styles.paymentBtnTextActive,
                        ]}
                      >
                        {PAYMENT_DISPLAY[method]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </SectionCard>

            {/* ---- Section: Amount Paid ----------------------------------- */}
            <SectionCard title={t("amountPaid")}>
              <TextInput
                style={styles.textInput}
                value={amountPaidStr}
                onChangeText={setAmountPaidStr}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="right"
                returnKeyType="done"
                onFocus={() => Haptics.selectionAsync()}
              />
            </SectionCard>

            {/* Bottom padding so last card isn't hidden by footer */}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* ----------------------------------------------------------------
              Footer
          ---------------------------------------------------------------- */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Feather
                name="check"
                size={18}
                color={Colors.textLight}
                style={{ marginLeft: 6 }}
              />
              <Text style={styles.saveBtnText}>{t("editSave")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Titled card wrapper used for each section */
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface ItemRowProps {
  item: EditableItem;
  isLast: boolean;
  onChange: (patch: Partial<EditableItem>) => void;
  onRemove: () => void;
}

function ItemRow({ item, isLast, onChange, onRemove }: ItemRowProps) {
  const { t } = useLang();
  return (
    <View style={[styles.itemRow, !isLast && styles.itemRowBorder]}>
      {/* Name */}
      <TextInput
        style={[styles.itemInput, { flex: 3 }]}
        value={item.name}
        onChangeText={(v) => onChange({ name: v })}
        placeholder={t("editItemNamePh")}
        placeholderTextColor={Colors.textMuted}
        textAlign="right"
        returnKeyType="next"
        onFocus={() => Haptics.selectionAsync()}
      />

      {/* Quantity */}
      <TextInput
        style={[styles.itemInput, { flex: 1.2 }]}
        value={item.quantityStr}
        onChangeText={(v) => onChange({ quantityStr: v })}
        placeholder="1"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
        textAlign="center"
        returnKeyType="next"
        onFocus={() => Haptics.selectionAsync()}
      />

      {/* Price */}
      <TextInput
        style={[styles.itemInput, { flex: 1.5 }]}
        value={item.priceStr}
        onChangeText={(v) => onChange({ priceStr: v })}
        placeholder="0.00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
        textAlign="center"
        returnKeyType="done"
        onFocus={() => Haptics.selectionAsync()}
      />

      {/* Delete */}
      <TouchableOpacity
        style={styles.deleteItemBtn}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Feather name="x" size={15} color={Colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Overlay behind the sheet
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // Wrapper that sits above the keyboard
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },

  // The white bottom sheet
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },

  // ---- Header ----
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 32,
  },

  // ---- Body ----
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
  },

  // ---- Section Card ----
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "right",
    marginBottom: 10,
    letterSpacing: 0.3,
  },

  // ---- Item table ----
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemHeaderCell: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    color: Colors.text,
    minHeight: 36,
  },
  deleteItemBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF0F0",
    alignItems: "center",
    justifyContent: "center",
  },

  // ---- Add item button ----
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    backgroundColor: Colors.surfaceSecondary,
  },
  addItemBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },

  // ---- Text inputs (notes, deliveryTime, amountPaid) ----
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    minHeight: 42,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 10,
  },

  // ---- Payment method ----
  paymentRow: {
    flexDirection: "row",
    gap: 8,
  },
  paymentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceSecondary,
  },
  paymentBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  paymentBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  paymentBtnTextActive: {
    color: Colors.textLight,
  },

  // ---- Footer ----
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: Colors.textLight,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  clearDTBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, alignSelf: "flex-end",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, backgroundColor: Colors.background,
  },
  clearDTText: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
});
