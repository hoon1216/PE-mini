"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { SurveyDetail } from "@/lib/types";
import { SurveyNotFound } from "@/components/admin/survey-not-found";

interface SurveyPageLoaderProps {
  surveyId: string;
  children: (survey: SurveyDetail) => ReactNode;
}

export function SurveyPageLoader({ surveyId, children }: SurveyPageLoaderProps) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);
    setSurvey(null);

    fetchJson<SurveyDetail>(`/api/surveys/${surveyId}`)
      .then((data) => {
        if (!active) return;
        setSurvey(data);
      })
      .catch(() => {
        if (active) setMissing(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [surveyId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted">
          조사를 불러오는 중...
        </div>
      </div>
    );
  }

  if (missing || !survey) {
    return <SurveyNotFound surveyId={surveyId} />;
  }

  return <>{children(survey)}</>;
}
