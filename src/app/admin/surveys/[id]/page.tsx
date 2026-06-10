import Link from "next/link";
import { Dashboard } from "@/components/admin/dashboard";
import { SurveyPageLoader } from "@/components/admin/survey-page-loader";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyDashboardPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <SurveyPageLoader surveyId={id}>
      {(survey) => (
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
      )}
    </SurveyPageLoader>
  );
}
