import { jsonNoStore } from "@/lib/api-json";
import { getDashboardStats } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const stats = await getDashboardStats(id);

  if (!stats) {
    return jsonNoStore({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
  }

  return jsonNoStore(stats);
}
