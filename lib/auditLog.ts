import { addDoc, collection } from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AuditAction =
  | "employee_created"
  | "employee_deleted"
  | "developer_panel_opened"
  | "contract_uploaded"
  | "subscription_changed"
  | "company_login"
  | "user_login";

export async function writeAuditLog(params: {
  companyId: string;
  action: AuditAction;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, unknown>;
}) {
  try {
    if (!params.companyId) return;
    await addDoc(collection(db, "companies", params.companyId, "auditLogs"), {
      action: params.action,
      actorId: params.actorId ?? "system",
      actorName: params.actorName ?? "system",
      targetId: params.targetId ?? null,
      targetType: params.targetType ?? null,
      details: params.details ?? {},
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Audit log skipped", error);
  }
}
