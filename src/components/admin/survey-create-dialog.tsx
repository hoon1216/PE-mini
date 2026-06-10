"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import type { SurveyDetail } from "@/lib/types";

interface SurveyCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (survey: SurveyDetail) => void;
}

export function SurveyCreateDialog({
  open,
  onClose,
  onCreated,
}: SurveyCreateDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function handleClose() {
    if (loading) return;
    setTitle("");
    setDescription("");
    setError("");
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const survey = await fetchJson<SurveyDetail>("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const verified = await fetchJson<SurveyDetail>(`/api/surveys/${survey.id}`);
      if (!verified?.id) {
        throw new Error(
          "조사가 생성됐지만 저장소에 반영되지 않았습니다. Vercel Storage(KV/Blob) 연결을 확인한 뒤 다시 시도해 주세요."
        );
      }

      onCreated?.(verified);
      handleClose();
      router.push(`/admin/surveys/${verified.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "조사 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-label="닫기"
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">새 조사 만들기</h2>
        <p className="mt-1 text-sm text-muted">
          조사를 생성하면 기본 섹션이 함께 만들어집니다.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">조사 제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026 신제품 선호도 조사"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">설명 (선택)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="참가자에게 보여줄 간단한 안내"
              rows={3}
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "생성 중..." : "생성"}
          </Button>
        </div>
      </form>
    </div>
  );
}
