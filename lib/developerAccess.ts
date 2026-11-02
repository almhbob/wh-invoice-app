export interface DeveloperAccessClaims {
  platformRole?: string;
}

const PLATFORM_ROLES = new Set(["owner", "developer", "super_admin"]);

/**
 * Developer access is based only on server-issued Firebase custom claims.
 * Employee fields such as role, username, employeeId, or permissions are not
 * trusted here because tenant administrators can edit employee documents.
 */
export function canAccessDeveloperDashboard(claims: DeveloperAccessClaims | null | undefined) {
  return PLATFORM_ROLES.has(String(claims?.platformRole ?? ""));
}
