import { NextResponse } from "next/server";
import { deleteSurvey, getSurveyById, updateSurveyContent } from "@/lib/db";
import type { UpdateSurveyContentInput } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const survey = await getSurveyById(id);

  if (!survey) {
    return NextResponse.json({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(survey);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as UpdateSurveyContentInput;

  if (!body.sections || body.sections.length === 0) {
    return NextResponse.json(
      { error: "최소 1개의 섹션이 필요합니다." },
      { status: 400 }
    );
  }

  const hasEmptySection = body.sections.some(
    (section) => !section.questions || section.questions.length === 0
  );
  if (hasEmptySection) {
    return NextResponse.json(
      { error: "각 섹션에 최소 1개의 문항이 필요합니다." },
      { status: 400 }
    );
  }

  const survey = await updateSurveyContent(id, body);

  if (!survey) {
    return NextResponse.json({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(survey);
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const deleted = await deleteSurvey(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "조사를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/surveys/[id] failed:", error);
    return NextResponse.json(
      { error: "조사 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
