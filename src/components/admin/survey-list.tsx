"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SurveyCreateDialog } from "@/components/admin/survey-create-dialog";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import type { Survey } from "@/lib/types";

export function SurveyList() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadSurveys = useCallback(async () => {
    const data = await fetchJson<Survey[]>("/api/surveys");
    setSurveys(data);
    return data;
  }, []);

  useEffect(() => {
    loadSurveys()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "목록 로딩 실패")
      )
      .finally(() => setLoading(false));
  }, [loadSurveys]);

  async function handleDelete(survey: Survey) {
    const confirmed = window.confirm(
      `"${survey.title}" 조사를 삭제할까요?\n제출된 평가 결과도 함께 삭제됩니다.`
    );
    if (!confirmed) return;

    setDeletingId(survey.id);
    setError("");

    try {
      await fetchJson(`/api/surveys/${survey.id}`, { method: "DELETE" });
      const refreshed = await loadSurveys();
      if (refreshed.some((item) => item.id === survey.id)) {
        throw new Error(
          "삭제는 완료됐지만 목록이 아직 갱신되지 않았습니다. 잠시 후 새로고침해 주세요."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted">
        조사 목록을 불러오는 중...
      </div>
    );
  }

  return (
    <>
      {surveys.length === 0 && !error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">배포 후 조사가 보이지 않나요?</p>
          <p className="mt-1">
            로컬 데이터는 Git에 포함되지 않습니다.{" "}
            <Link href="/admin/import" className="font-semibold underline">
              로컬 데이터 가져오기
            </Link>
            에서 <code>data/store.json</code>을 업로드해주세요.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">조사 목록</h2>
          <Button
            type="button"
            className="px-3 py-1.5"
            onClick={() => setCreateOpen(true)}
          >
            새 조사 +
          </Button>
        </div>

        {error && (
          <div className="border-b border-border px-6 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {surveys.length === 0 ? (
          <div className="px-6 py-8 text-sm text-muted">
            아직 생성된 조사가 없습니다. 우상단 &apos;새 조사 +&apos; 버튼으로
            첫 조사를 만들어보세요.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {surveys.map((survey) => (
              <li
                key={survey.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50"
              >
                <Link
                  href={`/admin/surveys/${survey.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-medium hover:text-primary">{survey.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    참가 링크: /s/{survey.slug}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(survey.updatedAt).toLocaleString("ko-KR")}
                  </p>
                </Link>

                <div
                  className="flex shrink-0 items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/admin/surveys/${survey.id}/edit`}>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5"
                    >
                      편집
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-3 py-1.5"
                    disabled={deletingId === survey.id}
                    onClick={() => handleDelete(survey)}
                  >
                    {deletingId === survey.id ? "삭제 중..." : "삭제"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SurveyCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          loadSurveys().catch((err) =>
            setError(err instanceof Error ? err.message : "목록 갱신 실패")
          );
        }}
      />
    </>
  );
}
