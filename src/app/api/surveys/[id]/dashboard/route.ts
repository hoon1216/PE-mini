import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const stats = await getDashboardStats(id);

  if (!stats) {
    return NextResponse.json({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(stats);
}
