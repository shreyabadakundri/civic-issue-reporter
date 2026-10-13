import crypto from "node:crypto";

export type UserRole = "citizen" | "admin";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = {
  exp: number;
  role: UserRole;
  username: string;
  nonce: string;
};

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is not set in env/civicmind.config");
  }
  return "civicmind-dev-session-secret";
}

function credentials(role: UserRole): { username: string; password: string } {
  if (role === "admin") {
    return {
      username: process.env.AUTH_ADMIN_USERNAME?.trim() || "admin",
      password: process.env.AUTH_ADMIN_PASSWORD?.trim() || "admin123",
    };
  }
  return {
    username: process.env.AUTH_CITIZEN_USERNAME?.trim() || "citizen",
    password: process.env.AUTH_CITIZEN_PASSWORD?.trim() || "citizen123",
  };
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function authenticateUser(username: string, password: string): UserRole | null {
  const trimmedUser = username.trim();
  for (const role of ["admin", "citizen"] as const) {
    const cred = credentials(role);
    if (safeEqual(trimmedUser, cred.username) && safeEqual(password, cred.password)) {
      return role;
    }
  }
  return null;
}

export function createSessionToken(role: UserRole, username: string): string {
  const payload: SessionPayload = {
    exp: Date.now() + TOKEN_TTL_MS,
    role,
    username,
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token?.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "citizen") return null;
    if (typeof payload.username !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function assertRole(token: string | undefined | null, allowed: UserRole | UserRole[]) {
  const session = parseSessionToken(token);
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!session || !roles.includes(session.role)) {
    throw new Error("Not authorized");
  }
  return session;
}
