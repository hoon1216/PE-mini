import Link from "next/link";
import { SurveyEditor } from "@/components/admin/survey-editor";
import { getSurveyById } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyEditPage({ params }: PageProps) {
  const { id } = await params;
  const survey = await getSurveyById(id);

  if (!survey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold">조사를 찾을 수 없습니다</h1>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            조사 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link
              href={`/admin/surveys/${survey.id}`}
              className="text-sm text-muted hover:text-foreground"
            >
              ← 대시보드로
            </Link>
            <h1 className="mt-1 text-2xl font-bold">평가 내용 편집</h1>
            <p className="mt-1 text-sm text-muted">{survey.title}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <SurveyEditor surveyId={survey.id} />
      </main>
    </div>
  );
}
