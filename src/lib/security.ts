import { NextRequest } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export function isAdminRequest(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(cookieToken);
  return session?.role === "ADMIN";
}
