import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { UserRole } from "@/lib/auth";
import {
  AUTH_SESSION_STORAGE_KEY,
  clearClientSession,
  readClientSession,
  type ClientAuthSession,
  writeClientSession,
} from "@/lib/session";
import { verifyAuthSession } from "@/server/reports";

type AuthContextValue = {
  session: ClientAuthSession | null;
  role: UserRole | null;
  isAdmin: boolean;
  isCitizen: boolean;
  loading: boolean;
  setSession: (session: ClientAuthSession) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<ClientAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = readClientSession();
    if (!stored) {
      setSessionState(null);
      setLoading(false);
      return;
    }
    try {
      const result = await verifyAuthSession({ data: { token: stored.token } });
      if (result.ok && result.role && result.username) {
        const next = { token: stored.token, role: result.role, username: result.username };
        writeClientSession(next);
        setSessionState(next);
      } else {
        clearClientSession();
        setSessionState(null);
      }
    } catch {
      clearClientSession();
      setSessionState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback((next: ClientAuthSession) => {
    writeClientSession(next);
    setSessionState(next);
  }, []);

  const logout = useCallback(() => {
    clearClientSession();
    setSessionState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      role: session?.role ?? null,
      isAdmin: session?.role === "admin",
      isCitizen: session?.role === "citizen",
      loading,
      setSession,
      logout,
      refresh,
    }),
    [session, loading, setSession, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
