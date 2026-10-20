import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { canBranchSupervisorAssignRole, canBranchSupervisorManageRole, defaultPermissionsForRole } from "@/constants/branchSupervisorPermissions";
import { useCompany } from "@/context/CompanyContext";
import { useTenantAuth } from "@/context/TenantAuthContext";
import { db } from "@/lib/firebase";

export type EmployeeRole = "cashier" | "halwa" | "mawali" | "chocolate" | "cake" | "packaging" | "admin" | "branch_supervisor" | "dept_supervisor" | "guest";
export interface Employee {
  id: string;
  companyId?: string;
  authUid?: string;
  name: string;
  employeeId: string;
  username?: string;
  /** Legacy field: never accepted, persisted, or used for authentication. */
  pinCode?: string;
  status?: "active" | "suspended";
  role: EmployeeRole;
  permissions?: string[];
  branchId?: string;
  createdBy?: string;
  createdAt: string;
  lastLoginAt?: string;
  isLocalFallback?: boolean;
}
export const ROLE_LABELS: Record<EmployeeRole, string> = {
  cashier: "كاشير", halwa: "قسم حلا زفة و ضيافة", mawali: "قسم معجنات و موالح",
  chocolate: "قسم شوكولاتة", cake: "قسم الكيك", packaging: "قسم التغليف",
  admin: "مشرف", branch_supervisor: "مشرف فرع", dept_supervisor: "مشرف قسم", guest: "ضيف",
};
interface EmployeeContextType {
  employees: Employee[];
  currentEmployee: Employee | null;
  setCurrentEmployee: (employee: Employee | null) => Promise<void>;
  addEmployee: (data: Omit<Employee, "id" | "createdAt" | "companyId">) => Promise<Employee>;
  removeEmployee: (id: string) => Promise<void>;
  updateEmployee: (id: string, changes: Partial<Pick<Employee, "name" | "role" | "status" | "pinCode">>) => Promise<void>;
  checkAndLogin: (employee: Employee, forceKick?: boolean) => Promise<"ok" | "conflict">;
  isLoading: boolean;
}
const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

function safeEmployee(id: string, data: Record<string, unknown>): Employee | null {
  if (typeof data.name !== "string" || typeof data.employeeId !== "string" || !Object.hasOwn(ROLE_LABELS, String(data.role))) return null;
  // Whitelist profile fields. Never copy credentials or client-supplied permissions.
  return {
    id, name: data.name, employeeId: data.employeeId,
    companyId: typeof data.companyId === "string" ? data.companyId : undefined,
    authUid: typeof data.authUid === "string" ? data.authUid : undefined,
    username: typeof data.username === "string" ? data.username : undefined,
    role: data.role as EmployeeRole,
    status: data.status === "suspended" ? "suspended" : "active",
    branchId: typeof data.branchId === "string" ? data.branchId : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    permissions: defaultPermissionsForRole(data.role as EmployeeRole),
  };
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { companyId, company } = useCompany();
  const { identity, logout } = useTenantAuth();
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setLoading] = useState(true);
  const uid = identity?.uid;
  const employeeDocId = identity?.employeeDocId;
  const cacheKey = `@fawtara_verified_employee_v2_${uid}_${companyId}`;

  useEffect(() => {
    let active = true;
    let receivedServerProfile = false;
    setCurrentEmployeeState(null);
    setEmployees([]);
    setLoading(true);
    if (!uid || !employeeDocId || identity?.companyId !== companyId) {
      setLoading(false);
      return;
    }
    const validOwnProfile = (employee: Employee | null) =>
      employee?.id === employeeDocId && employee.authUid === uid &&
      employee.companyId === companyId && employee.status === "active";

    AsyncStorage.getItem(cacheKey).then((raw) => {
      if (!active || receivedServerProfile || !raw) return;
      const cached = safeEmployee(employeeDocId, JSON.parse(raw));
      if (validOwnProfile(cached)) {
        setCurrentEmployeeState(cached);
        setLoading(false);
      }
    }).catch(() => undefined);

    const timeout = setTimeout(() => { if (active) setLoading(false); }, 6000);
    const unsubscribe = onSnapshot(doc(db, "companies", companyId, "employees", employeeDocId), { includeMetadataChanges: true }, (snapshot) => {
      if (!active) return;
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      receivedServerProfile = true;
      clearTimeout(timeout);
      const employee = snapshot.exists() ? safeEmployee(snapshot.id, snapshot.data()) : null;
      if (!validOwnProfile(employee)) {
        setCurrentEmployeeState(null);
        AsyncStorage.removeItem(cacheKey).catch(() => undefined);
        void logout();
      } else {
        setCurrentEmployeeState(employee);
        AsyncStorage.setItem(cacheKey, JSON.stringify(employee)).catch(() => undefined);
      }
      setLoading(false);
    }, (failure) => {
      if (!active) return;
      clearTimeout(timeout);
      setLoading(false);
      if (failure.code === "permission-denied" || failure.code === "unauthenticated") {
        receivedServerProfile = true;
        setCurrentEmployeeState(null);
        AsyncStorage.removeItem(cacheKey).catch(() => undefined);
        void logout();
      }
    });
    return () => { active = false; clearTimeout(timeout); unsubscribe(); };
  }, [companyId, identity?.companyId, uid, employeeDocId, cacheKey, logout]);

  useEffect(() => {
    if (!currentEmployee) return;
    const unsubscribe = onSnapshot(query(collection(db, "companies", companyId, "employees"), orderBy("createdAt", "asc")), (snapshot) => {
      setEmployees(snapshot.docs.map((entry) => safeEmployee(entry.id, entry.data())).filter((entry): entry is Employee => Boolean(entry)));
    }, () => setEmployees([currentEmployee]));
    return unsubscribe;
  }, [companyId, currentEmployee?.id]);

  const setCurrentEmployee = useCallback(async (employee: Employee | null) => {
    if (!employee) {
      setCurrentEmployeeState(null);
      await logout();
    } else if (employee.id !== employeeDocId || employee.authUid !== uid || employee.companyId !== companyId) {
      throw new Error("AUTH_EMPLOYEE_SWITCH_REQUIRES_SIGN_IN");
    }
  }, [companyId, employeeDocId, uid, logout]);

  const checkAndLogin = useCallback(async (employee: Employee): Promise<"ok" | "conflict"> => {
    await setCurrentEmployee(employee);
    return "ok";
  }, [setCurrentEmployee]);

  const requireManager = useCallback(() => {
    if (!currentEmployee || !["admin", "branch_supervisor"].includes(currentEmployee.role)) {
      throw new Error("EMPLOYEE_MANAGEMENT_FORBIDDEN");
    }
  }, [currentEmployee]);

  const addEmployee = useCallback(async (data: Omit<Employee, "id" | "createdAt" | "companyId">): Promise<Employee> => {
    requireManager();
    if (data.pinCode || data.authUid) throw new Error("CREDENTIALS_REQUIRE_TRUSTED_PROVISIONING");
    if (currentEmployee?.role === "branch_supervisor" && !canBranchSupervisorAssignRole(data.role)) throw new Error("PROTECTED_ROLE");
    if (company.maxUsers && employees.filter((entry) => entry.status !== "suspended").length >= company.maxUsers) throw new Error("MAX_USERS_EXCEEDED");
    const payload = {
      name: data.name.trim(), employeeId: data.employeeId.trim().toUpperCase(),
      companyId, role: data.role, status: "active" as const,
      createdAt: new Date().toISOString(),
      ...(currentEmployee?.branchId ? { branchId: currentEmployee.branchId } : {}),
    };
    const ref = await addDoc(collection(db, "companies", companyId, "employees"), payload);
    // A profile is not a login. Accounts are provisioned by the trusted admin script.
    return { id: ref.id, ...payload };
  }, [requireManager, currentEmployee, company, companyId, employees]);

  const removeEmployee = useCallback(async (id: string) => {
    requireManager();
    const target = employees.find((entry) => entry.id === id);
    if (currentEmployee?.role === "branch_supervisor" && (!target || !canBranchSupervisorManageRole(target.role))) throw new Error("PROTECTED_ROLE");
    await deleteDoc(doc(db, "companies", companyId, "employees", id));
  }, [companyId, currentEmployee, employees, requireManager]);

  const updateEmployee = useCallback(async (id: string, changes: Partial<Pick<Employee, "name" | "role" | "status" | "pinCode">>) => {
    requireManager();
    if ("pinCode" in changes) throw new Error("CREDENTIALS_REQUIRE_TRUSTED_PROVISIONING");
    const target = employees.find((entry) => entry.id === id);
    if (currentEmployee?.role === "branch_supervisor" &&
      (!target || !canBranchSupervisorManageRole(target.role) || (changes.role && !canBranchSupervisorAssignRole(changes.role)))) throw new Error("PROTECTED_ROLE");
    const payload = Object.fromEntries(Object.entries(changes).filter(([key, value]) => ["name", "role", "status"].includes(key) && value !== undefined));
    await updateDoc(doc(db, "companies", companyId, "employees", id), payload);
  }, [companyId, currentEmployee, employees, requireManager]);

  return <EmployeeContext.Provider value={{ employees, currentEmployee, setCurrentEmployee, checkAndLogin, addEmployee, removeEmployee, updateEmployee, isLoading }}>{children}</EmployeeContext.Provider>;
}

export function useEmployee() {
  const value = useContext(EmployeeContext);
  if (!value) throw new Error("useEmployee must be used inside EmployeeProvider");
  return value;
}
