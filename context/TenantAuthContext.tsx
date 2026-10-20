import AsyncStorage from "@react-native-async-storage/async-storage";
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { identityFromClaims, offlineIdentity, OFFLINE_SESSION_MAX_AGE_MS, TenantIdentity } from "@/lib/tenantIdentity";

const IDENTITY_KEY = "@fawtara_verified_identity_v1";
interface TenantAuthState {
  identity: TenantIdentity | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const TenantAuthContext = createContext<TenantAuthState | undefined>(undefined);

export function TenantAuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<TenantIdentity | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const isOnline = useNetworkStatus();

  const acceptUser = useCallback(async (user: User | null, forceRefresh = false) => {
    const attempt = ++revision.current;
    if (!user || user.isAnonymous) {
      setIdentity(null);
      setLoading(false);
      await AsyncStorage.removeItem(IDENTITY_KEY);
      if (user?.isAnonymous) await signOut(auth);
      return;
    }
    try {
      const token = await user.getIdTokenResult(forceRefresh);
      const verified = identityFromClaims(user.uid, token.claims, user.isAnonymous, Date.parse(token.issuedAtTime));
      if (attempt !== revision.current) return;
      await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(verified));
      if (attempt !== revision.current) return;
      setIdentity(verified);
      setError(null);
    } catch (failure) {
      const code = (failure as { code?: string }).code;
      const cached = code === "auth/network-request-failed"
        ? offlineIdentity(await AsyncStorage.getItem(IDENTITY_KEY), user.uid)
        : null;
      if (attempt !== revision.current) return;
      setIdentity(cached);
      if (!cached) {
        setError(code || (failure as Error).message || "AUTH_VERIFICATION_FAILED");
      }
      // Retain orders/outbox on every auth failure; never erase business data.
    } finally {
      if (attempt === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsubscribe = onIdTokenChanged(auth, (user) => { void acceptUser(user); });
    return () => { revision.current++; unsubscribe(); };
  }, [acceptUser]);

  useEffect(() => {
    if (isOnline && auth.currentUser && !auth.currentUser.isAnonymous) {
      void acceptUser(auth.currentUser, true);
    }
  }, [isOnline, acceptUser]);

  useEffect(() => {
    if (!identity) return;
    const remaining = Math.max(0, identity.verifiedAt + OFFLINE_SESSION_MAX_AGE_MS - Date.now());
    const timer = setTimeout(() => {
      setIdentity(null);
      setError("AUTH_OFFLINE_SESSION_EXPIRED");
    }, remaining);
    return () => clearTimeout(timer);
  }, [identity]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    await acceptUser(credential.user);
  }, [acceptUser]);

  const logout = useCallback(async () => {
    revision.current++;
    setIdentity(null);
    setError(null);
    await AsyncStorage.removeItem(IDENTITY_KEY);
    await signOut(auth);
  }, []);

  return (
    <TenantAuthContext.Provider value={{ identity, isLoading, error, login, logout }}>
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth() {
  const value = useContext(TenantAuthContext);
  if (!value) throw new Error("useTenantAuth must be used inside TenantAuthProvider");
  return value;
}
