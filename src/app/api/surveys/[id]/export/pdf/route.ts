import { apiErrorMessage } from "@/lib/api-error";
import { buildIndividualEvaluationsPdfBuffer } from "@/lib/dashboard-export-pdf";
import { getSurveyById, listResponsesWithAnswers } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function safeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "evaluations";
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [survey, responses] = await Promise.all([
      getSurveyById(id),
      listResponsesWithAnswers(id),
    ]);

    if (!survey) {
      return new Response(JSON.stringify({ error: "조사를 찾을 수 없습니다." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await buildIndividualEvaluationsPdfBuffer(survey, responses);
    const filename = `${safeFilename(survey.title)}-개별평가지.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/surveys/[id]/export/pdf failed:", error);
    return new Response(JSON.stringify({ error: apiErrorMessage(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
