import { NextResponse, type NextRequest } from "next/server";
import {
  isAdminAuthorized,
  isAdminProtectedPath,
  isPublicApiRoute,
} from "@/lib/admin-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAdminProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && isPublicApiRoute(pathname, request.method)) {
    return NextResponse.next();
  }

  if (isAdminAuthorized(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 }
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/surveys/:path*", "/api/admin/:path*"],
};
