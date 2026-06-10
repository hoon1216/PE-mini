"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { SurveyDetail } from "@/lib/types";

interface SurveyNotFoundProps {
  surveyId: string;
}

export function SurveyNotFound({ surveyId }: SurveyNotFoundProps) {
  const [retrying, setRetrying] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function retryLoad() {
      try {
        await fetchJson<SurveyDetail>(`/api/surveys/${surveyId}`);
        if (active) {
          window.location.reload();
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "조사를 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) setRetrying(false);
      }
    }

    retryLoad();
    return () => {
      active = false;
    };
  }, [surveyId]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">조사를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm text-muted">
          {retrying
            ? "저장소에서 조사를 다시 확인하는 중..."
            : "요청한 조사가 저장소에 없습니다. 새 조사 생성이 반영되지 않았거나, 잘못된 링크일 수 있습니다."}
        </p>
        {!retrying && (
          <p className="mt-2 break-all text-xs text-muted">ID: {surveyId}</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-primary hover:underline"
        >
          조사 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
