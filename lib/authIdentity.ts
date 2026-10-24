import { signInAnonymously, signOut, User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { getSecureAuthMode } from "@/lib/secureAuth";

export interface PlatformClaimsExpectation {
  companyId: string;
  role: string;
  platformRole?: "owner" | "developer" | "super_admin" | "tenant";
}

export interface AuthIdentityState {
  uid?: string;
  isSignedIn: boolean;
  isAnonymous: boolean;
  email?: string | null;
}

export function mapFirebaseUser(user: User | null): AuthIdentityState {
  return {
    uid: user?.uid,
    isSignedIn: Boolean(user),
    isAnonymous: Boolean(user?.isAnonymous),
    email: user?.email,
  };
}

export async function ensureTemporaryFirebaseSession() {
  // Wait for the persisted session to load first, otherwise an anonymous sign-in
  // would silently replace a real (server-issued) employee session.
  await auth.authStateReady();
  if (auth.currentUser) return mapFirebaseUser(auth.currentUser);
  // Anonymous access is allowed only in explicitly opted-in legacy development mode.
  if ((await getSecureAuthMode()) !== "legacy") return mapFirebaseUser(null);
  const credential = await signInAnonymously(auth);
  return mapFirebaseUser(credential.user);
}

export async function clearFirebaseSession() {
  await signOut(auth);
}

export async function readIdTokenClaims() {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult(true);
  return token.claims;
}

export function claimsMatchCompany(claims: Record<string, unknown> | null | undefined, companyId: string) {
  if (!claims) return false;
  return claims.companyId === companyId || ["owner", "developer", "super_admin"].includes(String(claims.platformRole ?? ""));
}
