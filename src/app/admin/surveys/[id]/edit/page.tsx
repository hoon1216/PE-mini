import Link from "next/link";
import { SurveyEditor } from "@/components/admin/survey-editor";
import { SurveyPageLoader } from "@/components/admin/survey-page-loader";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyEditPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <SurveyPageLoader surveyId={id}>
      {(survey) => (
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
      )}
    </SurveyPageLoader>
  );
}
