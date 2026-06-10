import { NextResponse } from "next/server";
import { deleteResponse } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; responseId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, responseId } = await params;
    const deleted = await deleteResponse(id, responseId);

    if (!deleted) {
      return NextResponse.json(
        { error: "평가 데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/surveys/[id]/responses/[responseId] failed:", error);
    return NextResponse.json(
      { error: "평가 데이터 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
