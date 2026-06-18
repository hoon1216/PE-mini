"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import type { DemographicFieldConfig, Response } from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";

interface ParticipantResponseManagerProps {
  surveyId: string;
  demographicFields?: DemographicFieldConfig[];
}

function formatSubmittedAt(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ParticipantResponseManager({
  surveyId,
  demographicFields = [],
}: ParticipantResponseManagerProps) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadResponses = useCallback(async () => {
    const data = await fetchJson<Response[]>(
      `/api/surveys/${surveyId}/responses`
    );
    setResponses(data);
    return data;
  }, [surveyId]);

  useEffect(() => {
    loadResponses()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "응답 목록 로딩 실패")
      )
      .finally(() => setLoading(false));
  }, [loadResponses]);

  async function handleDelete(response: Response) {
    const label = response.participantName?.trim() || "이름 없음";
    const confirmed = window.confirm(
      `"${label}"님의 평가 데이터를 삭제할까요?\n대시보드 집계에서도 제외됩니다.`
    );
    if (!confirmed) return;

    setDeletingId(response.id);
    setError("");
    setMessage("");

    try {
      await fetchJson(`/api/surveys/${surveyId}/responses/${response.id}`, {
        method: "DELETE",
      });

      const refreshed = await loadResponses();
      if (refreshed.some((item) => item.id === response.id)) {
        throw new Error(
          "삭제는 완료됐지만 목록이 아직 갱신되지 않았습니다. 잠시 후 새로고침해 주세요."
        );
      }
      setMessage(`"${label}"님의 평가 데이터를 삭제했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    if (responses.length === 0) return;

    const confirmed = window.confirm(
      `제출된 평가 데이터 ${responses.length}건을 모두 삭제할까요?\n이 작업은 되돌릴 수 없으며, 대시보드 집계도 초기화됩니다.`
    );
    if (!confirmed) return;

    setDeletingAll(true);
    setError("");
    setMessage("");

    try {
      const result = await fetchJson<{ deletedCount: number }>(
        `/api/surveys/${surveyId}/responses`,
        { method: "DELETE" }
      );

      setResponses([]);
      const refreshed = await loadResponses();
      if (refreshed.length > 0) {
        throw new Error(
          "삭제는 완료됐지만 목록이 아직 갱신되지 않았습니다. 잠시 후 새로고침해 주세요."
        );
      }
      setMessage(`${result.deletedCount}건의 평가 데이터를 삭제했습니다.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "전체 삭제에 실패했습니다."
      );
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">참가자 평가 데이터</h2>
          <p className="mt-1 text-sm text-muted">
            개별 삭제 또는 전체 일괄 삭제가 가능합니다. 삭제 시 대시보드에서도
            제외됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{responses.length}건</span>
          <Button
            type="button"
            variant="secondary"
            className="text-xs text-red-600"
            disabled={
              loading || deletingAll || deletingId !== null || responses.length === 0
            }
            onClick={handleDeleteAll}
          >
            {deletingAll ? "삭제 중..." : "전체 삭제"}
          </Button>
        </div>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-muted">응답 목록을 불러오는 중...</p>
      )}

      {!loading && responses.length === 0 && (
        <p className="mt-4 text-sm text-muted">제출된 평가 데이터가 없습니다.</p>
      )}

      {!loading && responses.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">이름</th>
                <th className="px-3 py-2 font-medium">성별</th>
                <th className="px-3 py-2 font-medium">연령대</th>
                {demographicFields.map((field) => (
                  <th key={field.id} className="px-3 py-2 font-medium">
                    {field.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">제출일시</th>
                <th className="px-3 py-2 font-medium text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => (
                <tr key={response.id} className="border-b border-border/70">
                  <td className="px-3 py-3 font-medium">
                    {response.participantName?.trim() || (
                      <span className="text-muted">이름 없음</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {response.gender ? GENDER_LABELS[response.gender] : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {response.ageGroup ? AGE_GROUP_LABELS[response.ageGroup] : "—"}
                  </td>
                  {demographicFields.map((field) => (
                    <td key={field.id} className="px-3 py-3">
                      {response.demographicValues[field.id] ?? "—"}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-muted">
                    {formatSubmittedAt(response.submittedAt)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs text-red-600"
                      disabled={deletingId === response.id || deletingAll}
                      onClick={() => handleDelete(response)}
                    >
                      {deletingId === response.id ? "삭제 중..." : "삭제"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
    </section>
  );
}
