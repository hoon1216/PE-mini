"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionQuestions } from "@/components/participant/section-questions";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import {
  getOrCreateDraft,
  saveDraft,
  sectionHasQuestions,
  validateSectionAnswers,
} from "@/lib/evaluation-draft";
import type { SurveyDetail } from "@/lib/types";

interface SectionEvaluationProps {
  slug: string;
  sectionId: string;
}

export function SectionEvaluation({ slug, sectionId }: SectionEvaluationProps) {
  const router = useRouter();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [rankings, setRankings] = useState<
    Record<string, { rank1: string; rank2: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson<SurveyDetail>(`/api/surveys/slug/${slug}`)
      .then((data) => {
        setSurvey(data);
        const draft = getOrCreateDraft(data.id);
        setScores({ ...draft.scores });
        setRankings({ ...draft.rankings });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "조사 로딩 실패")
      )
      .finally(() => setLoading(false));
  }, [slug]);

  const section = survey?.sections.find((s) => s.id === sectionId);

  function setRanking(
    questionId: string,
    field: "rank1" | "rank2",
    value: string
  ) {
    setRankings((prev) => ({
      ...prev,
      [questionId]: {
        rank1: prev[questionId]?.rank1 ?? "",
        rank2: prev[questionId]?.rank2 ?? "",
        [field]: value,
      },
    }));
  }

  function handleSave() {
    if (!survey || !section) return;

    const validationError = validateSectionAnswers(section, scores, rankings);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const draft = getOrCreateDraft(survey.id);
    draft.scores = { ...draft.scores, ...scores };
    draft.rankings = { ...draft.rankings, ...rankings };

    if (!draft.completedSectionIds.includes(sectionId)) {
      draft.completedSectionIds = [...draft.completedSectionIds, sectionId];
    }

    saveDraft(draft);
    setSaving(false);
    router.push(`/s/${slug}`);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted">
        섹션을 불러오는 중...
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!survey || !section) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-red-600">섹션을 찾을 수 없습니다.</p>
        <Link
          href={`/s/${slug}`}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          평가 홈으로
        </Link>
      </div>
    );
  }

  if (!sectionHasQuestions(section)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted">이 섹션에 평가할 문항이 없습니다.</p>
        <Link href={`/s/${slug}`}>
          <Button type="button" className="mt-4">
            평가 홈으로
          </Button>
        </Link>
      </div>
    );
  }

  const draft = getOrCreateDraft(survey.id);
  if (!draft.gender || !draft.ageGroup) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted">
          성별과 연령대를 선택한 후 평가를 시작해주세요.
        </p>
        <Link href={`/s/${slug}`}>
          <Button type="button" className="mt-4">
            평가 홈으로
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <Link
          href={`/s/${slug}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← 평가 홈
        </Link>
        <h1 className="mt-2 text-xl font-bold">{section.title}</h1>
        {section.description && (
          <p className="mt-2 text-sm text-muted">{section.description}</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <SectionQuestions
          section={section}
          scores={scores}
          rankings={rankings}
          onScoreChange={(questionId, score) =>
            setScores((prev) => ({ ...prev, [questionId]: String(score) }))
          }
          onRankingChange={setRanking}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Link href={`/s/${slug}`} className="flex-1">
          <Button type="button" variant="secondary" className="w-full py-3">
            취소
          </Button>
        </Link>
        <Button
          type="button"
          className="flex-1 py-3"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
