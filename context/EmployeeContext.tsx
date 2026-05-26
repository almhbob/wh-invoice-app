import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  canBranchSupervisorAssignRole,
  canBranchSupervisorManageRole,
  defaultPermissionsForRole,
} from "@/constants/branchSupervisorPermissions";
import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";

export type EmployeeRole = "cashier" | "halwa" | "mawali" | "chocolate" | "cake" | "packaging" | "admin" | "branch_supervisor" | "dept_supervisor" | "guest";

export interface Employee {
  id: string;
  companyId?: string;
  name: string;
  employeeId: string;
  username?: string;
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

interface EmployeeContextType {
  employees: Employee[];
  currentEmployee: Employee | null;
  setCurrentEmployee: (emp: Employee | null) => void;
  addEmployee: (data: Omit<Employee, "id" | "createdAt" | "companyId">) => Promise<Employee>;
  removeEmployee: (id: string) => Promise<void>;
  isLoading: boolean;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);
const SESSION_KEY_PREFIX = "@wh_session_v1";
const SESSION_EMPLOYEE_KEY_PREFIX = "@wh_session_employee_v1";
const FIRESTORE_EMPLOYEE_TIMEOUT_MS = 5000;

const ROLE_LABELS: Record<EmployeeRole, string> = {
  cashier: "كاشير",
  halwa: "قسم حلا زفة و ضيافة",
  mawali: "قسم معجنات و موالح",
  chocolate: "قسم شوكولاتة",
  cake: "قسم الكيك",
  packaging: "قسم التغليف",
  admin: "مشرف",
  branch_supervisor: "مشرف فرع",
  dept_supervisor: "مشرف قسم",
  guest: "ضيف",
};
export { ROLE_LABELS };

function fallbackEmployee(companyId: string): Employee {
  const fallbackByCompany: Record<string, { name: string; employeeId: string; username: string }> = {
    "new-trial-company": {
      name: "مسؤول الشركة التجريبية",
      employeeId: "TRIAL001",
      username: "trial",
    },
    "laviviane-trial": {
      name: "مسؤول شركة Laviviane",
      employeeId: "LAVI001",
      username: "laviviane",
    },
  };
  const fallback = fallbackByCompany[companyId] ?? {
    name: "مسؤول الشركة",
    employeeId: "000001",
    username: "admin",
  };

  return {
    id: `local-fallback-${companyId}`,
    companyId,
    name: fallback.name,
    employeeId: fallback.employeeId,
    username: fallback.username,
    pinCode: "1234",
    status: "active",
    role: "admin",
    permissions: defaultPermissionsForRole("admin"),
    createdAt: new Date().toISOString(),
    lastLoginAt: undefined,
    isLocalFallback: true,
  };
}

function mergeSessionIntoEmployees(employees: Employee[], sessionEmployee: Employee | null): Employee[] {
  if (!sessionEmployee || sessionEmployee.status === "suspended") return employees;
  const exists = employees.some((emp) => emp.id === sessionEmployee.id);
  return exists ? employees : [sessionEmployee, ...employees];
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const employeesCollection = useCallback(() => collection(db, "companies", companyId, "employees"), [companyId]);
  const employeeDoc = useCallback((id: string) => doc(db, "companies", companyId, "employees", id), [companyId]);
  const sessionKey = `${SESSION_KEY_PREFIX}_${companyId}`;
  const sessionEmployeeKey = `${SESSION_EMPLOYEE_KEY_PREFIX}_${companyId}`;

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setEmployees([]);

    async function restoreSessionSnapshot() {
      try {
        const raw = await AsyncStorage.getItem(sessionEmployeeKey);
        if (!mounted || !raw) return null;
        const parsed = JSON.parse(raw) as Employee;
        if (parsed?.status === "suspended") return null;
        setCurrentEmployeeState(parsed);
        setEmployees((existing) => mergeSessionIntoEmployees(existing, parsed));
        return parsed;
      } catch {
        return null;
      }
    }

    const restoredPromise = restoreSessionSnapshot();

    const timeout = setTimeout(async () => {
      const restored = await restoredPromise;
      if (!mounted) return;
      setEmployees((existing) => {
        const base = existing.length ? existing : [fallbackEmployee(companyId)];
        return mergeSessionIntoEmployees(base, restored);
      });
      setIsLoading(false);
    }, FIRESTORE_EMPLOYEE_TIMEOUT_MS);

    const q = query(employeesCollection(), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        clearTimeout(timeout);
        const restored = await restoredPromise;
        if (!mounted) return;
        const loaded: Employee[] = snapshot.docs.map((d) => ({
          id: d.id,
          companyId,
          ...(d.data() as Omit<Employee, "id">),
        }));
        const base = loaded.length ? loaded : [fallbackEmployee(companyId)];
        const withSession = mergeSessionIntoEmployees(base, restored);
        setEmployees(withSession);
        setIsLoading(false);

        try {
          const sessionId = await AsyncStorage.getItem(sessionKey);
          if (sessionId) {
            const found = withSession.find((e) => e.id === sessionId) || restored;
            if (found && found.status !== "suspended") {
              setCurrentEmployeeState(found);
            } else {
              await AsyncStorage.removeItem(sessionKey);
              await AsyncStorage.removeItem(sessionEmployeeKey);
              setCurrentEmployeeState(null);
            }
          }
        } catch {}
      },
      async (err) => {
        clearTimeout(timeout);
        console.error("Firestore company employees error:", err);
        const restored = await restoredPromise;
        if (!mounted) return;
        setEmployees(mergeSessionIntoEmployees([fallbackEmployee(companyId)], restored));
        if (restored) setCurrentEmployeeState(restored);
        setIsLoading(false);
      }
    );
    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsub();
    };
  }, [companyId, employeesCollection, sessionKey, sessionEmployeeKey]);

  useEffect(() => {
    if (!currentEmployee) return;
    const updated = employees.find((e) => e.id === currentEmployee.id);
    if (updated && updated.status !== "suspended") setCurrentEmployeeState(updated);
    if (updated?.status === "suspended") setCurrentEmployee(null);
  }, [employees, currentEmployee, setCurrentEmployee]);

  const setCurrentEmployee = useCallback(async (emp: Employee | null) => {
    const allowedEmployee = emp?.status === "suspended" ? null : emp;
    const withLoginTime = allowedEmployee ? { ...allowedEmployee, lastLoginAt: new Date().toISOString() } : null;
    setCurrentEmployeeState(withLoginTime);
    if (withLoginTime) {
      setEmployees((existing) => mergeSessionIntoEmployees(existing, withLoginTime));
    }
    try {
      if (withLoginTime) {
        await AsyncStorage.setItem(sessionKey, withLoginTime.id);
        await AsyncStorage.setItem(sessionEmployeeKey, JSON.stringify(withLoginTime));
      } else {
        await AsyncStorage.removeItem(sessionKey);
        await AsyncStorage.removeItem(sessionEmployeeKey);
      }
    } catch {}
  }, [sessionKey, sessionEmployeeKey]);

  const addEmployee = useCallback(
    async (data: Omit<Employee, "id" | "createdAt" | "companyId">): Promise<Employee> => {
      if (currentEmployee?.role === "branch_supervisor" && !canBranchSupervisorAssignRole(data.role)) {
        throw new Error("BRANCH_SUPERVISOR_CANNOT_ASSIGN_PROTECTED_ROLE");
      }

      const now = new Date().toISOString();
      const payload = {
        ...data,
        username: data.username || data.employeeId.toLowerCase(),
        pinCode: data.pinCode || "1234",
        status: data.status || "active",
        companyId,
        permissions: data.permissions?.length ? data.permissions : defaultPermissionsForRole(data.role),
        branchId: data.branchId ?? currentEmployee?.branchId,
        createdBy: data.createdBy ?? currentEmployee?.employeeId,
        createdAt: now,
        lastLoginAt: data.lastLoginAt,
      };
      const ref = await addDoc(employeesCollection(), payload);
      return { id: ref.id, ...payload };
    },
    [companyId, currentEmployee, employeesCollection]
  );

  const removeEmployee = useCallback(
    async (id: string) => {
      const target = employees.find((e) => e.id === id);
      if (target?.isLocalFallback) {
        setEmployees((current) => current.filter((e) => e.id !== id));
        return;
      }
      if (currentEmployee?.role === "branch_supervisor" && target && !canBranchSupervisorManageRole(target.role)) {
        throw new Error("BRANCH_SUPERVISOR_CANNOT_REMOVE_PROTECTED_ROLE");
      }

      await deleteDoc(employeeDoc(id));
      if (currentEmployee?.id === id) setCurrentEmployee(null);
    },
    [currentEmployee, employeeDoc, employees, setCurrentEmployee]
  );

  return (
    <EmployeeContext.Provider value={{ employees, currentEmployee, setCurrentEmployee, addEmployee, removeEmployee, isLoading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployee must be used inside EmployeeProvider");
  return ctx;
}
