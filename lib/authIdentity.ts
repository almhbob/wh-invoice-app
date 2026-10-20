import { signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface AuthIdentityState {
  uid?: string;
  isSignedIn: boolean;
  isAnonymous: boolean;
  email?: string | null;
}
export function mapFirebaseUser(user: User | null): AuthIdentityState {
  return { uid: user?.uid, isSignedIn: Boolean(user && !user.isAnonymous), isAnonymous: Boolean(user?.isAnonymous), email: user?.email };
}
export async function clearFirebaseSession() { await signOut(auth); }
export async function readIdTokenClaims() {
  return auth.currentUser ? (await auth.currentUser.getIdTokenResult()).claims : null;
}
export function claimsMatchCompany(claims: Record<string, unknown> | null | undefined, companyId: string) {
  // No client-side platform-role bypass.
  return Boolean(claims && claims.companyId === companyId && typeof claims.employeeDocId === "string");
}
