import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  const isAuthenticated = session !== null;
  const host = request.headers.get("host") ?? "";

  const isAuthApi = pathname.startsWith("/api/auth/");
  const isPublicApi = pathname === "/api/version";
  const isRootLoginPage = pathname === "/";
  const isRoleLoginPage = pathname.startsWith("/login/");
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isOtherApi = pathname.startsWith("/api/");

  if (!isAuthenticated && !isRootLoginPage && !isRoleLoginPage && !isAuthApi && !isPublicApi) {
    if (isOtherApi) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAuthenticated && isRootLoginPage) {
    const target = session.role === "ADMIN" ? "/admin" : "/catalogue";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Keep login pages accessible even when already connected.
  // This prevents auto-redirections that skip identification screens.

  if (isAuthenticated && session.role !== "ADMIN" && (isAdminPage || isAdminApi)) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login/admin", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
      : "script-src 'self' 'unsafe-inline';";
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; img-src 'self' https: data:; ${scriptSrc} style-src 'self' 'unsafe-inline';`,
  );

  const isLocalHost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");

  if (!isLocalHost && request.nextUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
    return NextResponse.redirect(
      new URL(`https://${request.nextUrl.host}${request.nextUrl.pathname}`, request.url),
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
