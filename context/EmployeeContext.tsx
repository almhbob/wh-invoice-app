import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  canBranchSupervisorAssignRole,
  canBranchSupervisorManageRole,
  defaultPermissionsForRole,
} from "@/constants/branchSupervisorPermissions";
import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";
import { t as t_ } from "@/constants/translations";

// Persistent unique ID for this browser/device — used to detect duplicate sessions
function getOrCreateDeviceId(): string {
  const KEY = "@wh_device_id";
  if (typeof localStorage !== "undefined") {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  }
  return `native-${Math.random().toString(36).slice(2)}`;
}
const MY_DEVICE_ID = getOrCreateDeviceId();

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
  updateEmployee: (id: string, changes: Partial<Pick<Employee, "name" | "role" | "status" | "pinCode">>) => Promise<void>;
  checkAndLogin: (emp: Employee, forceKick?: boolean) => Promise<"ok" | "conflict">;
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
  const { companyId, company } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentEmployeeRef = useRef<Employee | null>(null);

  const employeesCollection = useCallback(() => collection(db, "companies", companyId, "employees"), [companyId]);
  const employeeDoc = useCallback((id: string) => doc(db, "companies", companyId, "employees", id), [companyId]);
  const activeSessionRef = useCallback((empId: string) => doc(db, "companies", companyId, "activeSessions", empId), [companyId]);
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

  const setCurrentEmployee = useCallback(async (emp: Employee | null) => {
    const allowedEmployee = emp?.status === "suspended" ? null : emp;
    const withLoginTime = allowedEmployee ? { ...allowedEmployee, lastLoginAt: new Date().toISOString() } : null;
    const prev = currentEmployeeRef.current;
    currentEmployeeRef.current = withLoginTime;
    setCurrentEmployeeState(withLoginTime);
    if (withLoginTime) {
      setEmployees((existing) => mergeSessionIntoEmployees(existing, withLoginTime));
    }
    try {
      if (withLoginTime) {
        await AsyncStorage.setItem(sessionKey, withLoginTime.id);
        await AsyncStorage.setItem(sessionEmployeeKey, JSON.stringify(withLoginTime));
        // Write active session to Firestore (non-blocking)
        if (!withLoginTime.isLocalFallback && !(withLoginTime as Record<string, unknown>).isLocalBootstrap) {
          setDoc(activeSessionRef(withLoginTime.employeeId), {
            deviceId: MY_DEVICE_ID,
            employeeId: withLoginTime.employeeId,
            employeeName: withLoginTime.name,
            companyId,
            loggedInAt: new Date().toISOString(),
          }).catch(() => {});
        }
      } else {
        await AsyncStorage.removeItem(sessionKey);
        await AsyncStorage.removeItem(sessionEmployeeKey);
        // Delete session only if it's ours
        if (prev && !prev.isLocalFallback && !((prev as unknown) as Record<string, unknown>).isLocalBootstrap) {
          getDoc(activeSessionRef(prev.employeeId)).then((snap) => {
            if (snap.exists() && snap.data().deviceId === MY_DEVICE_ID) {
              deleteDoc(activeSessionRef(prev.employeeId)).catch(() => {});
            }
          }).catch(() => {});
        }
      }
    } catch {}
  }, [sessionKey, sessionEmployeeKey, companyId, activeSessionRef]);

  // Watch active session — if another device logs in as the same employee, force logout
  useEffect(() => {
    if (!currentEmployee || currentEmployee.isLocalFallback || ((currentEmployee as unknown) as Record<string, unknown>).isLocalBootstrap) return;
    const ref = activeSessionRef(currentEmployee.employeeId);
    const empName = currentEmployee.name;
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { deviceId?: string };
      if (data.deviceId && data.deviceId !== MY_DEVICE_ID) {
        currentEmployeeRef.current = null;
        setCurrentEmployeeState(null);
        AsyncStorage.removeItem(sessionKey).catch(() => {});
        AsyncStorage.removeItem(sessionEmployeeKey).catch(() => {});
        Alert.alert(
          "تسجيل دخول من جهاز آخر",
          `تم تسجيل دخول "${empName}" من جهاز آخر. سيتم تسجيل خروجك تلقائياً.`,
          [{ text: "حسناً" }]
        );
      }
    }, () => {}); // ignore Firestore errors silently
    return () => unsub();
  }, [currentEmployee?.id, currentEmployee?.employeeId, activeSessionRef, sessionKey, sessionEmployeeKey]);

  const checkAndLogin = useCallback(async (emp: Employee, forceKick = false): Promise<"ok" | "conflict"> => {
    if (emp.isLocalFallback || ((emp as unknown) as Record<string, unknown>).isLocalBootstrap) {
      await setCurrentEmployee(emp);
      return "ok";
    }
    if (!forceKick) {
      try {
        const snap = await getDoc(activeSessionRef(emp.employeeId));
        if (snap.exists() && (snap.data() as { deviceId?: string }).deviceId !== MY_DEVICE_ID) {
          return "conflict";
        }
      } catch {
        // Firestore unavailable — allow login
      }
    }
    await setCurrentEmployee(emp);
    return "ok";
  }, [activeSessionRef, setCurrentEmployee]);

  useEffect(() => {
    if (!currentEmployee) return;
    const updated = employees.find((e) => e.id === currentEmployee.id);
    if (updated && updated.status !== "suspended") setCurrentEmployeeState(updated);
    if (updated?.status === "suspended") setCurrentEmployee(null);
  }, [employees, currentEmployee, setCurrentEmployee]);

  const addEmployee = useCallback(
    async (data: Omit<Employee, "id" | "createdAt" | "companyId">): Promise<Employee> => {
      if (currentEmployee?.role === "branch_supervisor" && !canBranchSupervisorAssignRole(data.role)) {
        throw new Error("BRANCH_SUPERVISOR_CANNOT_ASSIGN_PROTECTED_ROLE");
      }

      const lang = "ar" as const;
      const activeCount = employees.filter((e) => !e.isLocalFallback && !((e as unknown) as Record<string, unknown>).isLocalBootstrap && e.status !== "suspended").length;
      if (company.maxUsers && activeCount >= company.maxUsers) {
        const msg = t_("limitMaxUsersMsg", lang).replace("{n}", String(company.maxUsers));
        Alert.alert(t_("limitMaxUsersTitle", lang), msg);
        throw new Error("MAX_USERS_EXCEEDED");
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

  const updateEmployee = useCallback(
    async (id: string, changes: Partial<Pick<Employee, "name" | "role" | "status" | "pinCode">>) => {
      // Update local state immediately
      setEmployees((current) =>
        current.map((e) => (e.id === id ? { ...e, ...changes } : e))
      );

      // Persist to AsyncStorage — update stored session if it's the current employee
      try {
        const raw = await AsyncStorage.getItem(sessionEmployeeKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Employee;
          if (parsed.id === id) {
            const updated = { ...parsed, ...changes };
            await AsyncStorage.setItem(sessionEmployeeKey, JSON.stringify(updated));
          }
        }
      } catch {}

      // Update Firestore (non-blocking; skip for local-fallback employees)
      const target = employees.find((e) => e.id === id);
      if (!target?.isLocalFallback) {
        updateDoc(employeeDoc(id), changes as Record<string, unknown>).catch(() => {});
      }

      // If the updated employee is the current employee and status becomes "suspended", log them out
      if (currentEmployee?.id === id && changes.status === "suspended") {
        setCurrentEmployee(null);
      }
    },
    [currentEmployee, employeeDoc, employees, sessionEmployeeKey, setCurrentEmployee]
  );

  return (
    <EmployeeContext.Provider value={{ employees, currentEmployee, setCurrentEmployee, addEmployee, removeEmployee, updateEmployee, checkAndLogin, isLoading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployee must be used inside EmployeeProvider");
  return ctx;
}
