import { apiErrorMessage } from "@/lib/api-error";
import { buildDashboardExcelBuffer } from "@/lib/dashboard-export-excel";
import { getDashboardStats, getSurveyById } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function safeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "dashboard";
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [survey, stats] = await Promise.all([
      getSurveyById(id),
      getDashboardStats(id),
    ]);

    if (!survey || !stats) {
      return new Response(JSON.stringify({ error: "조사를 찾을 수 없습니다." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await buildDashboardExcelBuffer(survey.title, stats);
    const filename = `${safeFilename(survey.title)}-dashboard.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/surveys/[id]/export/excel failed:", error);
    return new Response(JSON.stringify({ error: apiErrorMessage(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
