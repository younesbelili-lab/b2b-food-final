import { NextRequest, NextResponse } from "next/server";
import {
  getClientSignupCookieName,
  createSessionToken,
  getCredentialsByRole,
  getSessionCookieName,
  shouldUseSecureCookie,
  verifyClientSignupToken,
} from "@/lib/auth";
import { ensureClientUserByEmail, verifyClientCredentials } from "@/lib/store";

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
  let clientAccount = role === "CLIENT" ? await verifyClientCredentials(email, password) : null;
  if (!clientAccount && role === "CLIENT") {
    const signupToken = request.cookies.get(getClientSignupCookieName())?.value;
    const pendingClient = verifyClientSignupToken(signupToken);
    if (
      pendingClient &&
      pendingClient.email === email &&
      pendingClient.password === password
    ) {
      await ensureClientUserByEmail(pendingClient.email, {
        companyName: pendingClient.companyName,
        phone: pendingClient.phone,
        address: pendingClient.address,
        password: pendingClient.password,
      });
      clientAccount = await verifyClientCredentials(email, password);
    }
  }
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
  const redirectPath = role === "ADMIN" ? "/admin" : "/catalogue";
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
  if (role === "CLIENT") {
    response.cookies.delete(getClientSignupCookieName());
  }
  return response;
}
