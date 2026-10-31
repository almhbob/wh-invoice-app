import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { onAuthStateChanged } from "firebase/auth";

import { useCompany } from "@/context/CompanyContext";
import { useLang } from "@/context/LanguageContext";
import { auth } from "@/lib/firebase";
import { readSessionClaims, secureLogout, secureResetEmployeePin, secureSetPin, useSecureAuthMode } from "@/lib/secureAuth";
import { db } from "@/lib/firebase";
import { t as t_ } from "@/constants/translations";
import { showPlatformAlert } from "@/lib/platformAlert";

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

export type EmployeeRole = "cashier" | "halwa" | "mawali" | "chocolate" | "cake" | "packaging" | "calligrapher" | "driver" | "admin" | "branch_supervisor" | "dept_supervisor" | "guest";

export interface Employee {
  id: string;
  companyId?: string;
  name: string;
  employeeId: string;
  username?: string;
  /** Contact number (used for drivers). */
  phone?: string;
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
  updateEmployee: (id: string, changes: Partial<Pick<Employee, "name" | "role" | "status" | "pinCode" | "phone" | "branchId">>) => Promise<void>;
  checkAndLogin: (emp: Employee, forceKick?: boolean) => Promise<"ok" | "conflict">;
  /** Sets an employee's login PIN through the server (secure mode only). */
  setEmployeePin: (id: string, pin: string) => Promise<void>;
  /** Resets another employee's PIN through the admin-only server endpoint. */
  resetEmployeePin: (id: string, pin: string) => Promise<void>;
  /** Legacy access requires explicit local opt-in; production may fail closed. */
  authMode: "checking" | "secure" | "legacy" | "unavailable";
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
  calligrapher: "الخطاط",
  driver: "سائق توصيل",
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

function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function mergeSessionIntoEmployees(employees: Employee[], sessionEmployee: Employee | null): Employee[] {
  if (!sessionEmployee || sessionEmployee.status === "suspended") return employees;
  const exists = employees.some((emp) => emp.id === sessionEmployee.id);
  return exists ? employees : [sessionEmployee, ...employees];
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { companyId, company } = useCompany();
  const { t } = useLang();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentEmployeeRef = useRef<Employee | null>(null);
  const authMode = useSecureAuthMode();
  const isSecure = authMode !== "legacy";
  const [authUid, setAuthUid] = useState<string | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, (user) => setAuthUid(user && !user.isAnonymous ? user.uid : user ? `anon:${user.uid}` : null)), []);

  const employeesCollection = useCallback(() => collection(db, "companies", companyId, "employees"), [companyId]);
  const employeeDoc = useCallback((id: string) => doc(db, "companies", companyId, "employees", id), [companyId]);
  const activeSessionRef = useCallback((empId: string) => doc(db, "companies", companyId, "activeSessions", empId), [companyId]);
  const sessionKey = `${SESSION_KEY_PREFIX}_${companyId}`;
  const sessionEmployeeKey = `${SESSION_EMPLOYEE_KEY_PREFIX}_${companyId}`;

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setEmployees([]);
    if (authMode === "checking" || authUid === undefined) return () => { mounted = false; };
    if (authMode === "unavailable") {
      currentEmployeeRef.current = null;
      setCurrentEmployeeState(null);
      setIsLoading(false);
      return () => { mounted = false; };
    }
    // Secure mode: nothing is readable until the employee signs in with a server-issued token.
    const canRead = !isSecure || (authUid !== null && !authUid.startsWith("anon:"));
    // The hardcoded fallback admin only exists in legacy mode.
    const fallbackList = (): Employee[] => (isSecure ? [] : [fallbackEmployee(companyId)]);

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
        const base = existing.length ? existing : fallbackList();
        return mergeSessionIntoEmployees(base, restored);
      });
      setIsLoading(false);
    }, FIRESTORE_EMPLOYEE_TIMEOUT_MS);

    if (!canRead) {
      clearTimeout(timeout);
      restoredPromise.then(() => { if (mounted) setIsLoading(false); });
      return () => { mounted = false; };
    }

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
        const base = loaded.length ? loaded : fallbackList();
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
        setEmployees(mergeSessionIntoEmployees(fallbackList(), restored));
        if (restored) setCurrentEmployeeState(restored);
        setIsLoading(false);
      }
    );
    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsub();
    };
  }, [companyId, employeesCollection, sessionKey, sessionEmployeeKey, authMode, authUid, isSecure]);

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
        if (isSecure) void secureLogout();
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
  }, [sessionKey, sessionEmployeeKey, companyId, activeSessionRef, isSecure]);

  // Secure mode: a remembered employee is only trusted if the Firebase session proves it.
  useEffect(() => {
    if (!isSecure || !currentEmployee || authUid === undefined) return;
    let alive = true;
    readSessionClaims().then((claims) => {
      if (!alive) return;
      if (!claims || claims.eid !== currentEmployee.id || claims.companyId !== companyId) {
        setCurrentEmployee(null);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [isSecure, currentEmployee?.id, companyId, authUid, setCurrentEmployee]);

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
        showPlatformAlert(
          t("sessionKickedTitle"),
          t("sessionKickedMsg").replace("{name}", empName)
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
        // A slow or offline connection must never hold the login screen hostage.
        const snap = await Promise.race([
          getDoc(activeSessionRef(emp.employeeId)),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]);
        if (snap && snap.exists() && (snap.data() as { deviceId?: string }).deviceId !== MY_DEVICE_ID) {
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
        showPlatformAlert(t_("limitMaxUsersTitle", lang), msg);
        throw new Error("MAX_USERS_EXCEEDED");
      }

      const now = new Date().toISOString();
      // The PIN never goes into the employee document in secure mode (rules reject it).
      const { pinCode: initialPin, ...profile } = data;
      if (isSecure && !initialPin) throw new Error("PIN_REQUIRED");
      const payload = {
        ...profile,
        username: data.username || data.employeeId.toLowerCase(),
        // Secure mode never stores PINs in readable documents; they are hashed server-side.
        ...(isSecure ? {} : { pinCode: initialPin || "1234" }),
        status: data.status || "active",
        companyId,
        permissions: data.permissions?.length ? data.permissions : defaultPermissionsForRole(data.role),
        branchId: data.branchId ?? currentEmployee?.branchId,
        createdBy: data.createdBy ?? currentEmployee?.employeeId,
        createdAt: now,
        lastLoginAt: data.lastLoginAt,
      };
      const ref = await addDoc(employeesCollection(), cleanUndefined(payload));
      if (isSecure && initialPin) {
        try {
          await secureSetPin({ employeeDocId: ref.id, newPin: initialPin });
        } catch (err) {
          // Never leave an account behind without a PIN.
          await deleteDoc(ref).catch(() => undefined);
          throw err;
        }
      }
      return { id: ref.id, ...payload };
    },
    [companyId, currentEmployee, employeesCollection, isSecure]
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
    async (id: string, rawChanges: Partial<Pick<Employee, "name" | "role" | "status" | "pinCode" | "phone" | "branchId">>) => {
      let changes = rawChanges;
      if (isSecure && rawChanges.pinCode !== undefined) {
        const { pinCode, ...rest } = rawChanges;
        await secureSetPin({ employeeDocId: id, newPin: String(pinCode) });
        changes = rest;
        if (!Object.keys(rest).length) return;
      }
      // Persist remote employee changes before presenting them as saved locally.
      const target = employees.find((e) => e.id === id);
      if (!target?.isLocalFallback) {
        await updateDoc(employeeDoc(id), changes as Record<string, unknown>);
      }

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

      // If the updated employee is the current employee and status becomes "suspended", log them out
      if (currentEmployee?.id === id && changes.status === "suspended") {
        setCurrentEmployee(null);
      }
    },
    [currentEmployee, employeeDoc, employees, sessionEmployeeKey, setCurrentEmployee, isSecure]
  );

  const setEmployeePin = useCallback(async (id: string, pin: string) => {
    await secureSetPin({ employeeDocId: id, newPin: pin });
  }, []);

  const resetEmployeePin = useCallback(async (id: string, pin: string) => {
    await secureResetEmployeePin({ employeeDocId: id, newPin: pin });
  }, []);

  return (
    <EmployeeContext.Provider value={{ employees, currentEmployee, setCurrentEmployee, addEmployee, removeEmployee, updateEmployee, checkAndLogin, setEmployeePin, resetEmployeePin, authMode, isLoading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployee must be used inside EmployeeProvider");
  return ctx;
}
