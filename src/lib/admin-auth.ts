import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "pe_admin_session";

const DEFAULT_ADMIN_USERNAME = "prmadt";
const DEFAULT_ADMIN_PASSWORD = "123456";

export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
}

export function getAdminSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "pe-mini-admin-session";
}

function encodeSessionToken(raw: string): string {
  // Edge middleware cannot use Node.js "crypto"; btoa works in Edge and Node.
  return btoa(raw);
}

export function createAdminSessionToken(): string {
  return encodeSessionToken(
    `${getAdminUsername()}:${getAdminPassword()}:${getAdminSessionSecret()}`
  );
}

export function isAdminAuthEnabled(): boolean {
  return true;
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null;
}

export function isValidAdminCredentials(
  username: string,
  password: string
): boolean {
  return username === getAdminUsername() && password === getAdminPassword();
}

export function isAdminAuthorized(request: NextRequest): boolean {
  const provided = getTokenFromRequest(request);
  return provided === createAdminSessionToken();
}

export function isPublicApiRoute(pathname: string, method: string): boolean {
  if (/^\/api\/surveys\/slug\/[^/]+$/.test(pathname)) {
    return method === "GET";
  }

  if (/^\/api\/surveys\/[^/]+\/responses$/.test(pathname)) {
    return method === "POST";
  }

  if (pathname === "/api/admin/auth") {
    return true;
  }

  return false;
}

export function isAdminProtectedPath(pathname: string): boolean {
  if (pathname === "/admin/login") return false;
  if (pathname === "/" || pathname.startsWith("/admin")) return true;

  if (pathname === "/api/surveys" || pathname.startsWith("/api/surveys/")) {
    return true;
  }

  if (pathname.startsWith("/api/admin/") && pathname !== "/api/admin/auth") {
    return true;
  }

  return false;
}
