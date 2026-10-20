export interface TenantIdentity {
  uid: string;
  companyId: string;
  employeeDocId: string;
  verifiedAt: number;
  offline: boolean;
}

// Offline continuation is for an already verified device, not a new login.
export const OFFLINE_SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function identityFromClaims(
  uid: string,
  claims: Record<string, unknown>,
  isAnonymous: boolean,
  verifiedAt = Date.now(),
): TenantIdentity {
  if (
    isAnonymous ||
    !uid ||
    typeof claims.companyId !== "string" ||
    typeof claims.employeeDocId !== "string" ||
    !SAFE_ID.test(claims.companyId) ||
    !SAFE_ID.test(claims.employeeDocId)
  ) {
    throw new Error("AUTH_MEMBERSHIP_NOT_CONFIGURED");
  }
  return {
    uid,
    companyId: claims.companyId,
    employeeDocId: claims.employeeDocId,
    verifiedAt,
    offline: false,
  };
}

export function offlineIdentity(raw: string | null, uid: string, now = Date.now()): TenantIdentity | null {
  try {
    if (!raw) return null;
    const saved = JSON.parse(raw) as TenantIdentity;
    if (
      saved.uid !== uid ||
      !Number.isFinite(saved.verifiedAt) ||
      saved.verifiedAt > now ||
      now - saved.verifiedAt > OFFLINE_SESSION_MAX_AGE_MS
    ) return null;
    return {
      ...identityFromClaims(uid, saved as unknown as Record<string, unknown>, false),
      verifiedAt: saved.verifiedAt,
      offline: true,
    };
  } catch {
    return null;
  }
}
