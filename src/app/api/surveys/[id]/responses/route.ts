import { NextResponse } from "next/server";
import {
  deleteAllResponses,
  listResponses,
  submitResponse,
} from "@/lib/db";
import type { SubmitResponseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const responses = await listResponses(id);
  return NextResponse.json(responses);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as SubmitResponseInput;

  if (!body.participantName?.trim()) {
    return NextResponse.json(
      { error: "이름을 입력해주세요." },
      { status: 400 }
    );
  }

  if (!body.gender || !body.ageGroup) {
    return NextResponse.json(
      { error: "성별과 연령대를 선택해주세요." },
      { status: 400 }
    );
  }

  if (!body.answers || body.answers.length === 0) {
    return NextResponse.json(
      { error: "답변을 입력해주세요." },
      { status: 400 }
    );
  }

  const response = await submitResponse(id, body);

  if (!response) {
    return NextResponse.json({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(response, { status: 201 });
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const deletedCount = await deleteAllResponses(id);

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("DELETE /api/surveys/[id]/responses failed:", error);
    return NextResponse.json(
      { error: "전체 평가 데이터 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
