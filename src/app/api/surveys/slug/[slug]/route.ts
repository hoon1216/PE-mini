import { NextResponse } from "next/server";
import { getSurveyBySlug } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const survey = await getSurveyBySlug(slug);

  if (!survey) {
    return NextResponse.json({ error: "조사를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(survey);
}
