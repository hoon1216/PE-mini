import { jsonNoStore } from "@/lib/api-json";
import {
  deleteAllResponses,
  listResponses,
  submitResponse,
} from "@/lib/db";
import type { SubmitResponseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const responses = await listResponses(id);
  return jsonNoStore(responses);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as SubmitResponseInput;

  if (!body.participantName?.trim()) {
    return jsonNoStore({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  if (!body.gender || !body.ageGroup) {
    return jsonNoStore(
      { error: "성별과 연령대를 선택해주세요." },
      { status: 400 }
    );
  }

  if (!body.answers || body.answers.length === 0) {
    return jsonNoStore({ error: "답변을 입력해주세요." }, { status: 400 });
  }

  try {
    const response = await submitResponse(id, body);

    if (!response) {
      return jsonNoStore({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
    }

    return jsonNoStore(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/surveys/[id]/responses failed:", error);
    const { formatStoreError } = await import("@/lib/store-errors");
    return jsonNoStore({ error: formatStoreError(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const deletedCount = await deleteAllResponses(id);

    return jsonNoStore({ success: true, deletedCount });
  } catch (error) {
    console.error("DELETE /api/surveys/[id]/responses failed:", error);
    const { formatStoreError } = await import("@/lib/store-errors");
    return jsonNoStore({ error: formatStoreError(error) }, { status: 500 });
  }
}
