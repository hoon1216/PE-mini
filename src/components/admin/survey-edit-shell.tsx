"use client";

import Link from "next/link";
import { SurveyEditor } from "@/components/admin/survey-editor";
import { SurveyPageLoader } from "@/components/admin/survey-page-loader";

interface SurveyEditShellProps {
  surveyId: string;
}

export function SurveyEditShell({ surveyId }: SurveyEditShellProps) {
  return (
    <SurveyPageLoader surveyId={surveyId}>
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
            <SurveyEditor surveyId={survey.id} initialSurvey={survey} />
          </main>
        </div>
      )}
    </SurveyPageLoader>
  );
}
