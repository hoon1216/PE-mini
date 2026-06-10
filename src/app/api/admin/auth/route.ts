import { apiErrorMessage } from "@/lib/api-error";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminAuthEnabled,
  isValidAdminCredentials,
} from "@/lib/admin-auth";
import { jsonNoStore } from "@/lib/api-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET() {
  return jsonNoStore({ enabled: isAdminAuthEnabled() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      token?: string;
    };

    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!isValidAdminCredentials(username, password)) {
      return jsonNoStore(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const response = jsonNoStore({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("POST /api/admin/auth failed:", error);
    return jsonNoStore({ error: apiErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE() {
  const response = jsonNoStore({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
