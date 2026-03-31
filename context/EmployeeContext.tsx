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

import { db } from "@/lib/firebase";

export type EmployeeRole = "cashier" | "halwa" | "mawali" | "chocolate" | "cake" | "packaging" | "admin";

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  role: EmployeeRole;
  createdAt: string;
}

interface EmployeeContextType {
  employees: Employee[];
  currentEmployee: Employee | null;
  setCurrentEmployee: (emp: Employee | null) => void;
  addEmployee: (data: Omit<Employee, "id" | "createdAt">) => Promise<Employee>;
  removeEmployee: (id: string) => Promise<void>;
  isLoading: boolean;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

// Session is per-device — stays in AsyncStorage
const SESSION_KEY = "@wh_session_v1";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  cashier: "كاشير",
  halwa: "قسم حلا زفة و ضيافة",
  mawali: "قسم معجنات و موالح",
  chocolate: "قسم شوكولاتة",
  cake: "قسم الكيك",
  packaging: "قسم التغليف",
  admin: "مشرف",
};
export { ROLE_LABELS };

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to Firestore employees
  useEffect(() => {
    const q = query(collection(db, "employees"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const loaded: Employee[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Employee, "id">),
        }));
        setEmployees(loaded);
        setIsLoading(false);

        // Restore session from local storage
        try {
          const sessionId = await AsyncStorage.getItem(SESSION_KEY);
          if (sessionId) {
            const found = loaded.find((e) => e.id === sessionId);
            if (found) setCurrentEmployeeState(found);
            else {
              // Employee was deleted — clear session
              await AsyncStorage.removeItem(SESSION_KEY);
              setCurrentEmployeeState(null);
            }
          }
        } catch {}
      },
      (err) => {
        console.error("Firestore employees error:", err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Also update currentEmployee state when employees list changes
  useEffect(() => {
    if (!currentEmployee) return;
    const updated = employees.find((e) => e.id === currentEmployee.id);
    if (updated) setCurrentEmployeeState(updated);
  }, [employees]);

  const setCurrentEmployee = useCallback(async (emp: Employee | null) => {
    setCurrentEmployeeState(emp);
    try {
      if (emp) await AsyncStorage.setItem(SESSION_KEY, emp.id);
      else await AsyncStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);

  const addEmployee = useCallback(
    async (data: Omit<Employee, "id" | "createdAt">): Promise<Employee> => {
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, "employees"), { ...data, createdAt: now });
      return { id: ref.id, ...data, createdAt: now };
    },
    []
  );

  const removeEmployee = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, "employees", id));
      if (currentEmployee?.id === id) {
        setCurrentEmployee(null);
      }
    },
    [currentEmployee, setCurrentEmployee]
  );

  return (
    <EmployeeContext.Provider
      value={{
        employees,
        currentEmployee,
        setCurrentEmployee,
        addEmployee,
        removeEmployee,
        isLoading,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployee must be used inside EmployeeProvider");
  return ctx;
}
