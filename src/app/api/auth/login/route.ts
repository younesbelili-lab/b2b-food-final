import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getCredentialsByRole,
  getSessionCookieName,
  shouldUseSecureCookie,
} from "@/lib/auth";
import { verifyClientCredentials } from "@/lib/store";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let role: "ADMIN" | "CLIENT" = "CLIENT";
  let email = "";
  let password = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    role = body.role === "ADMIN" ? "ADMIN" : "CLIENT";
    email = String(body.email ?? "").trim().toLowerCase();
    password = String(body.password ?? "");
  } else {
    const formData = await request.formData();
    role = formData.get("role") === "ADMIN" ? "ADMIN" : "CLIENT";
    email = String(formData.get("email") ?? "").trim().toLowerCase();
    password = String(formData.get("password") ?? "");
  }

  const credentials = getCredentialsByRole(role);
  const clientAccount = role === "CLIENT" ? verifyClientCredentials(email, password) : null;
  const loginEmail = clientAccount?.email ?? credentials.email;
  const isFormSubmit = !contentType.includes("application/json");

  const isValidClient =
    role === "CLIENT" &&
    (clientAccount !== null ||
      (email === credentials.email.toLowerCase() && password === credentials.password));
  const isValidAdmin =
    role === "ADMIN" &&
    email === credentials.email.toLowerCase() &&
    password === credentials.password;

  if (!isValidClient && !isValidAdmin) {
    if (isFormSubmit) {
      const errorPath = role === "ADMIN" ? "/login/admin?error=login" : "/login/client?error=login";
      return NextResponse.redirect(new URL(errorPath, request.url), 303);
    }
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  const token = createSessionToken(role, loginEmail);
  const redirectPath = "/catalogue";
  const response = isFormSubmit
    ? NextResponse.redirect(new URL(redirectPath, request.url), 303)
    : NextResponse.json({ ok: true, role, email: loginEmail });
  response.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request.nextUrl.hostname),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
