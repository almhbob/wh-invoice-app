import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

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
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;

    const claims = (await user.getIdTokenResult()).claims;
    const actorId = claims.eid;
    if (claims.companyId !== params.companyId || typeof actorId !== "string") return;
    if (params.actorId && params.actorId !== actorId) return;

    await addDoc(collection(db, "companies", params.companyId, "auditLogs"), {
      action: params.action,
      actorId,
      actorName: params.actorName ?? user.displayName ?? "employee",
      targetId: params.targetId ?? null,
      targetType: params.targetType ?? null,
      details: params.details ?? {},
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Audit log skipped", error);
  }
}
