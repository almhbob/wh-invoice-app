import { EmployeeRole } from "@/context/EmployeeContext";

export interface EmployeeCredentialInput {
  name: string;
  employeeId: string;
  username?: string;
  pinCode?: string;
  role: EmployeeRole;
  branchId?: string;
  permissions?: string[];
}

export function normalizeEmployeeId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ".");
}

export function normalizePinCode(value?: string) {
  const pin = String(value ?? "").trim();
  return pin.length >= 4 ? pin : "1234";
}

export function prepareEmployeeCredentialPayload(input: EmployeeCredentialInput) {
  const employeeId = normalizeEmployeeId(input.employeeId);
  const username = normalizeUsername(input.username || employeeId);
  const pinCode = normalizePinCode(input.pinCode);

  return {
    ...input,
    name: input.name.trim(),
    employeeId,
    username,
    pinCode,
    status: "active" as const,
  };
}

export function employeeCredentialErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("BRANCH_SUPERVISOR_CANNOT_ASSIGN_PROTECTED_ROLE")) {
    return "مشرف الفرع لا يستطيع إنشاء مشرف عام أو مشرف فرع آخر. اختر دورًا تشغيليًا أو مشرف قسم.";
  }
  if (message.includes("permission-denied")) {
    return "لا توجد صلاحية كافية في Firebase لإضافة الموظف. راجع قواعد Firestore أو أكمل ربط Firebase Auth.";
  }
  if (message.includes("unavailable") || message.includes("network")) {
    return "تعذر الاتصال بقاعدة البيانات. تحقق من الإنترنت ثم حاول مرة أخرى.";
  }
  return "تعذر تنفيذ العملية. تحقق من البيانات والصلاحيات ثم حاول مرة أخرى.";
}
