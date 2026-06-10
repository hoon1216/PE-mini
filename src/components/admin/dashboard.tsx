"use client";

import { useEffect, useState } from "react";
import { DashboardSectionTables } from "@/components/admin/dashboard-tables";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import type { DashboardStats, SurveyDetail } from "@/lib/types";

interface DashboardProps {
  surveyId: string;
  initialSurvey?: SurveyDetail;
}

export function Dashboard({ surveyId, initialSurvey }: DashboardProps) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(
    initialSurvey ?? null
  );
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const statsData = await fetchJson<DashboardStats>(
          `/api/surveys/${surveyId}/dashboard`
        );

        if (!active) return;

        if (!initialSurvey) {
          const surveyData = await fetchJson<SurveyDetail>(
            `/api/surveys/${surveyId}`
          );
          if (!active) return;
          setSurvey(surveyData);
        }

        setStats(statsData);
        setError("");
      } catch (err) {
        if (active) {
          setStats(null);
          if (!initialSurvey) {
            setSurvey(null);
          }
          setError(
            err instanceof Error
              ? err.message
              : "대시보드 데이터를 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [surveyId, initialSurvey]);

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("링크 복사에 실패했습니다.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted">
        대시보드를 불러오는 중...
      </div>
    );
  }

  if (!survey || !stats) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-sm text-red-600">
        {error || "대시보드 데이터를 불러오지 못했습니다."}
      </div>
    );
  }

  const participantUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${survey.slug}`
      : `/s/${survey.slug}`;

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-amber-700" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-semibold">참가자 링크</h3>
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5"
            onClick={() => handleCopyUrl(participantUrl)}
          >
            {copied ? "복사됨" : "링크 복사"}
          </Button>
        </div>
        <p className="mt-2 break-all rounded-lg bg-slate-50 px-4 py-3 text-sm">
          {participantUrl}
        </p>
        <p className="mt-2 text-sm text-muted">
          총 {stats.totalResponses}명 제출 · 섹션 {survey.sections.length}개
        </p>
      </div>

      <DashboardSectionTables stats={stats} />

      {stats.totalResponses === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted">
          아직 제출된 평가가 없습니다. 참가자 링크를 공유해 평가를
          수집해주세요.
        </div>
      )}

      {survey.sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted">
          등록된 평가 섹션이 없습니다. 평가 내용 편집에서 섹션을
          추가해주세요.
        </div>
      )}
    </div>
  );
}
