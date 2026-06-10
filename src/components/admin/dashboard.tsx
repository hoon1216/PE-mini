"use client";

import { useEffect, useState } from "react";
import { DashboardSectionTables } from "@/components/admin/dashboard-tables";
import { fetchJson } from "@/lib/fetch-json";
import type { DashboardStats, SurveyDetail } from "@/lib/types";

interface DashboardProps {
  surveyId: string;
}

export function Dashboard({ surveyId }: DashboardProps) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [surveyData, statsData] = await Promise.all([
          fetchJson<SurveyDetail>(`/api/surveys/${surveyId}`),
          fetchJson<DashboardStats>(`/api/surveys/${surveyId}/dashboard`),
        ]);

        if (!active) return;

        setSurvey(surveyData);
        setStats(statsData);
      } catch {
        if (active) {
          setSurvey(null);
          setStats(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [surveyId]);

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
        대시보드 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  const participantUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${survey.slug}`
      : `/s/${survey.slug}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="font-semibold">참가자 링크</h3>
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
