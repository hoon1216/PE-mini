import { NextResponse } from "next/server";
import { createSurvey, listSurveys } from "@/lib/db";
import type { CreateSurveyInput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const surveys = await listSurveys();
    return NextResponse.json(surveys);
  } catch (error) {
    console.error("GET /api/surveys failed:", error);
    return NextResponse.json(
      { error: "조사 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSurveyInput;

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "조사 제목을 입력해주세요." },
        { status: 400 }
      );
    }

    const survey = await createSurvey({
      title: body.title.trim(),
      description: body.description?.trim(),
    });

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    console.error("POST /api/surveys failed:", error);
    return NextResponse.json(
      { error: "조사 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
