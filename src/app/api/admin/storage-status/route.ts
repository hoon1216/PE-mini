import { jsonNoStore } from "@/lib/api-json";
import { getStorageStatus, readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = getStorageStatus();
    const store = await readStore();

    return jsonNoStore({
      status,
      writable: status !== "vercel-missing-blob",
      primary: status,
      surveys: store.surveys.length,
      responses: store.responses.length,
      hint:
        status === "neon"
          ? "Neon PostgreSQL 사용 중"
          : status === "blob"
            ? "Blob 사용 중 — Neon 연결을 권장합니다"
            : undefined,
    });
  } catch (error) {
    console.error("GET /api/admin/storage-status failed:", error);
    return jsonNoStore(
      { error: "저장소 상태를 확인하지 못했습니다." },
      { status: 500 }
    );
  }
}
