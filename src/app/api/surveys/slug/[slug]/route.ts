import { apiErrorMessage } from "@/lib/api-error";
import { jsonNoStore } from "@/lib/api-json";
import { getSurveyBySlug } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const survey = await getSurveyBySlug(slug);

    if (!survey) {
      return jsonNoStore({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
    }

    return jsonNoStore(survey);
  } catch (error) {
    console.error("GET /api/surveys/slug/[slug] failed:", error);
    return jsonNoStore({ error: apiErrorMessage(error) }, { status: 500 });
  }
}
