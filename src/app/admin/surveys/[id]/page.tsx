import Link from "next/link";
import { Dashboard } from "@/components/admin/dashboard";
import { getSurveyById } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyDashboardPage({ params }: PageProps) {
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link
              href="/"
              className="text-sm text-muted hover:text-foreground"
            >
              ← 조사 목록
            </Link>
            <h1 className="mt-1 text-2xl font-bold">{survey.title}</h1>
            <p className="mt-1 text-sm text-muted">대시보드</p>
          </div>
          <Link
            href={`/admin/surveys/${survey.id}/edit`}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            평가 내용 편집
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Dashboard surveyId={survey.id} />
      </main>
    </div>
  );
}
