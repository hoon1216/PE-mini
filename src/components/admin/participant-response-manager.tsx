"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import type { Response } from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";

interface ParticipantResponseManagerProps {
  surveyId: string;
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
}: ParticipantResponseManagerProps) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadResponses = useCallback(async () => {
    const data = await fetchJson<Response[]>(`/api/surveys/${surveyId}/responses`);
    setResponses(data);
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

    try {
      await fetchJson(`/api/surveys/${surveyId}/responses/${response.id}`, {
        method: "DELETE",
      });
      setResponses((prev) => prev.filter((item) => item.id !== response.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">참가자 평가 데이터</h2>
          <p className="mt-1 text-sm text-muted">
            이름별로 개별 삭제할 수 있습니다. 삭제 시 대시보드에서도 제외됩니다.
          </p>
        </div>
        <span className="text-sm text-muted">{responses.length}건</span>
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
                  <td className="px-3 py-3 text-muted">
                    {formatSubmittedAt(response.submittedAt)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs text-red-600"
                      disabled={deletingId === response.id}
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
    </section>
  );
}
