import { jsonNoStore } from "@/lib/api-json";
import { getStorageStatus, restoreStoreFromSeed } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const storageStatus = getStorageStatus();
    if (storageStatus === "vercel-missing-blob") {
      return jsonNoStore(
        {
          error:
            "클라우드 저장소가 연결되지 않았습니다. Storage → Neon, Redis 또는 Blob 연결 후 Redeploy 해주세요.",
        },
        { status: 503 }
      );
    }

    const importKey = process.env.DATA_IMPORT_KEY?.trim();
    if (!importKey) {
      return jsonNoStore(
        {
          error:
            "DATA_IMPORT_KEY 환경 변수가 설정되지 않았습니다.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { key?: string };
    if (body.key !== importKey) {
      return jsonNoStore(
        { error: "복구 키가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const store = await restoreStoreFromSeed();

    return jsonNoStore({
      success: true,
      surveyCount: store.surveys.length,
      responseCount: store.responses.length,
    });
  } catch (error) {
    console.error("POST /api/admin/restore-seed failed:", error);
    return jsonNoStore(
      { error: "시드 데이터 복구에 실패했습니다." },
      { status: 500 }
    );
  }
}
