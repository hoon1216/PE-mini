import { NextResponse } from "next/server";
import { getStorageStatus, parseStoreJson, replaceStore } from "@/lib/store";

export const runtime = "nodejs";

const BLOB_SETUP_MESSAGE =
  "Vercel Blob이 연결되지 않았습니다. Vercel 대시보드 → Storage → Blob → Create → 프로젝트(PE-mini)에 Connect → Redeploy 후 다시 시도해주세요.";

export async function GET() {
  const status = getStorageStatus();
  return NextResponse.json({
    status,
    blobReady: status === "blob" || status === "kv",
    kvReady: status === "kv",
    hasImportKey: Boolean(process.env.DATA_IMPORT_KEY?.trim()),
  });
}

export async function POST(request: Request) {
  try {
    const storageStatus = getStorageStatus();
    if (storageStatus === "vercel-missing-blob") {
      return NextResponse.json({ error: BLOB_SETUP_MESSAGE }, { status: 503 });
    }
    if (storageStatus === "file") {
      return NextResponse.json(
        {
          error:
            "클라우드 저장소(KV 또는 Blob) 환경에서만 사용할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const importKey = process.env.DATA_IMPORT_KEY?.trim();
    if (!importKey) {
      return NextResponse.json(
        {
          error:
            "DATA_IMPORT_KEY 환경 변수가 설정되지 않았습니다. Vercel에서 키를 추가한 뒤 다시 시도해주세요.",
        },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const key = String(form.get("key") ?? "");
    const file = form.get("file");

    if (key !== importKey) {
      return NextResponse.json({ error: "가져오기 키가 올바르지 않습니다." }, { status: 401 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "store.json 파일을 선택해주세요." }, { status: 400 });
    }

    const raw = await file.text();
    const store = parseStoreJson(raw);
    await replaceStore(store);

    return NextResponse.json({
      success: true,
      surveyCount: store.surveys.length,
      responseCount: store.responses.length,
    });
  } catch (error) {
    console.error("POST /api/admin/import-store failed:", error);
    return NextResponse.json(
      { error: "데이터 가져오기에 실패했습니다." },
      { status: 500 }
    );
  }
}
