import type { UserRole } from "@/lib/auth";

export const AUTH_SESSION_STORAGE_KEY = "civicmind:authSession";

export type ClientAuthSession = {
  token: string;
  role: UserRole;
  username: string;
};

export function readClientSession(): ClientAuthSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientAuthSession;
    if (!parsed.token || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeClientSession(session: ClientAuthSession) {
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearClientSession() {
  sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
