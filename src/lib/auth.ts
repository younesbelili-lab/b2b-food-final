import crypto from "crypto";

const SESSION_COOKIE = "sfs_session";

type SessionPayload = {
  role: "ADMIN" | "CLIENT";
  exp: number;
  email: string;
};

function getSecret() {
  return process.env.APP_SESSION_SECRET ?? "dev-app-session-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function getCredentialsByRole(role: "ADMIN" | "CLIENT") {
  if (role === "ADMIN") {
    return {
      email: process.env.ADMIN_EMAIL ?? "admin@sofoodservice.local",
      password: process.env.ADMIN_PASSWORD ?? "admin123",
    };
  }

  return {
    email: process.env.CLIENT_EMAIL ?? "client@sofoodservice.local",
    password: process.env.CLIENT_PASSWORD ?? "client123",
  };
}

export function createSessionToken(role: "ADMIN" | "CLIENT", email: string) {
  const payload: SessionPayload = {
    role,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return null;
  }
  if (sign(payloadEncoded) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as SessionPayload;
    if (payload.exp < Date.now()) {
      return null;
    }
    if (payload.role !== "ADMIN" && payload.role !== "CLIENT") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function shouldUseSecureCookie(hostname: string) {
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";
  return process.env.NODE_ENV === "production" && !isLocalHost;
}
