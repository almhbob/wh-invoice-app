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

import { useCompany } from "@/context/CompanyContext";
import { db } from "@/lib/firebase";

export type EmployeeRole = "cashier" | "halwa" | "mawali" | "chocolate" | "cake" | "packaging" | "admin" | "branch_supervisor" | "dept_supervisor" | "guest";

export interface Employee {
  id: string;
  companyId?: string;
  name: string;
  employeeId: string;
  role: EmployeeRole;
  permissions?: string[];
  createdAt: string;
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

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const employeesCollection = useCallback(() => collection(db, "companies", companyId, "employees"), [companyId]);
  const employeeDoc = useCallback((id: string) => doc(db, "companies", companyId, "employees", id), [companyId]);
  const sessionKey = `${SESSION_KEY_PREFIX}_${companyId}`;

  useEffect(() => {
    setIsLoading(true);
    setEmployees([]);
    setCurrentEmployeeState(null);

    const q = query(employeesCollection(), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const loaded: Employee[] = snapshot.docs.map((d) => ({
          id: d.id,
          companyId,
          ...(d.data() as Omit<Employee, "id">),
        }));
        setEmployees(loaded);
        setIsLoading(false);

        try {
          const sessionId = await AsyncStorage.getItem(sessionKey);
          if (sessionId) {
            const found = loaded.find((e) => e.id === sessionId);
            if (found) setCurrentEmployeeState(found);
            else {
              await AsyncStorage.removeItem(sessionKey);
              setCurrentEmployeeState(null);
            }
          }
        } catch {}
      },
      (err) => {
        console.error("Firestore company employees error:", err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [companyId, employeesCollection, sessionKey]);

  useEffect(() => {
    if (!currentEmployee) return;
    const updated = employees.find((e) => e.id === currentEmployee.id);
    if (updated) setCurrentEmployeeState(updated);
  }, [employees, currentEmployee]);

  const setCurrentEmployee = useCallback(async (emp: Employee | null) => {
    setCurrentEmployeeState(emp);
    try {
      if (emp) await AsyncStorage.setItem(sessionKey, emp.id);
      else await AsyncStorage.removeItem(sessionKey);
    } catch {}
  }, [sessionKey]);

  const addEmployee = useCallback(
    async (data: Omit<Employee, "id" | "createdAt" | "companyId">): Promise<Employee> => {
      const now = new Date().toISOString();
      const payload = { ...data, companyId, createdAt: now };
      const ref = await addDoc(employeesCollection(), payload);
      return { id: ref.id, ...payload };
    },
    [companyId, employeesCollection]
  );

  const removeEmployee = useCallback(
    async (id: string) => {
      await deleteDoc(employeeDoc(id));
      if (currentEmployee?.id === id) setCurrentEmployee(null);
    },
    [currentEmployee, employeeDoc, setCurrentEmployee]
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
