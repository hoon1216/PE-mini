import { jsonNoStore } from "@/lib/api-json";
import { deleteResponse } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string; responseId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, responseId } = await params;
    const deleted = await deleteResponse(id, responseId);

    if (!deleted) {
      return jsonNoStore(
        { error: "평가 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return jsonNoStore({ success: true });
  } catch (error) {
    console.error("DELETE /api/surveys/[id]/responses/[responseId] failed:", error);
    const { formatStoreError } = await import("@/lib/store-errors");
    return jsonNoStore({ error: formatStoreError(error) }, { status: 500 });
  }
}
