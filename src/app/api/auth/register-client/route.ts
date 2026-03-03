import { NextRequest, NextResponse } from "next/server";
import {
  createClientSignupToken,
  getClientSignupCookieName,
  shouldUseSecureCookie,
} from "@/lib/auth";
import { createClientUser } from "@/lib/store";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormSubmit = !contentType.includes("application/json");

  let companyName = "";
  let email = "";
  let phone = "";
  let address = "";
  let password = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    companyName = String(body.companyName ?? "");
    email = String(body.email ?? "");
    phone = String(body.phone ?? "");
    address = String(body.address ?? "");
    password = String(body.password ?? "");
  } else {
    const formData = await request.formData();
    companyName = String(formData.get("companyName") ?? "");
    email = String(formData.get("email") ?? "");
    phone = String(formData.get("phone") ?? "");
    address = String(formData.get("address") ?? "");
    password = String(formData.get("password") ?? "");
  }

  try {
    const user = createClientUser({ companyName, email, phone, address, password });
    const signupToken = createClientSignupToken({
      email: user.email,
      password,
      companyName,
      phone,
      address,
    });
    if (isFormSubmit) {
      const redirectUrl = new URL(
        "/login/client?registered=1",
        request.url,
      );
      const response = NextResponse.redirect(redirectUrl, 303);
      response.cookies.set(getClientSignupCookieName(), signupToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: shouldUseSecureCookie(request.nextUrl.hostname),
        path: "/",
        maxAge: 60 * 60,
      });
      return response;
    }
    const response = NextResponse.json(
      { item: { email: user.email, companyName: user.companyName } },
      { status: 201 },
    );
    response.cookies.set(getClientSignupCookieName(), signupToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request.nextUrl.hostname),
      path: "/",
      maxAge: 60 * 60,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur creation compte client.";
    if (isFormSubmit) {
      const redirectUrl = new URL(
        `/login/client?error=register&message=${encodeURIComponent(message)}`,
        request.url,
      );
      return NextResponse.redirect(redirectUrl, 303);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
