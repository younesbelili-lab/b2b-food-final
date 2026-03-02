import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, shouldUseSecureCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request.nextUrl.hostname),
    path: "/",
    maxAge: 0,
  });
  return response;
}
