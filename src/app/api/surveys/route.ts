import { apiErrorMessage } from "@/lib/api-error";
import { jsonNoStore } from "@/lib/api-json";
import { createSurvey, listSurveys } from "@/lib/db";
import type { CreateSurveyInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const surveys = await listSurveys();
    return jsonNoStore(surveys);
  } catch (error) {
    console.error("GET /api/surveys failed:", error);
    return jsonNoStore(
      { error: "조사 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSurveyInput;

    if (!body.title?.trim()) {
      return jsonNoStore(
        { error: "조사 제목을 입력해주세요." },
        { status: 400 }
      );
    }

    const survey = await createSurvey({
      title: body.title.trim(),
      description: body.description?.trim(),
    });

    return jsonNoStore(survey, { status: 201 });
  } catch (error) {
    console.error("POST /api/surveys failed:", error);
    return jsonNoStore({ error: apiErrorMessage(error) }, { status: 500 });
  }
}
