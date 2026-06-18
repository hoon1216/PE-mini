"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionQuestions } from "@/components/participant/section-questions";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchJson } from "@/lib/fetch-json";
import {
  getOrCreateDraft,
  isParticipantProfileComplete,
  saveDraft,
  sectionHasQuestions,
  validateSectionAnswers,
} from "@/lib/evaluation-draft";
import type { RankingAnswer } from "@/lib/ranking-utils";
import type { SurveyDetail } from "@/lib/types";

interface SectionEvaluationProps {
  slug: string;
  sectionId: string;
}

export function SectionEvaluation({ slug, sectionId }: SectionEvaluationProps) {
  const router = useRouter();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [rankings, setRankings] = useState<Record<string, RankingAnswer>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string[]>>({});
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
        setTexts({ ...draft.texts });
        setChoices({ ...draft.choices });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "조사 로딩 실패")
      )
      .finally(() => setLoading(false));
  }, [slug]);

  const section = survey?.sections.find((item) => item.id === sectionId);

  function setRanking(
    questionId: string,
    field: "rank1" | "rank2" | "rank3",
    value: string
  ) {
    setRankings((prev) => {
      const current = prev[questionId] ?? {
        rank1: "",
        rank2: "",
        rank3: "",
      };
      const next = { ...current, [field]: value };

      return { ...prev, [questionId]: next };
    });
  }

  function handleSave() {
    if (!survey || !section) return;

    const validationError = validateSectionAnswers(
      section,
      scores,
      rankings,
      texts,
      choices
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const draft = getOrCreateDraft(survey.id);
    draft.scores = { ...draft.scores, ...scores };
    draft.rankings = { ...draft.rankings, ...rankings };
    draft.texts = { ...draft.texts, ...texts };
    draft.choices = { ...draft.choices, ...choices };

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
        <ButtonLink href={`/s/${slug}`} className="mt-4">
          평가 홈으로
        </ButtonLink>
      </div>
    );
  }

  const draft = getOrCreateDraft(survey.id);
  if (!isParticipantProfileComplete(survey, draft)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted">
          이름, 성별, 연령대
          {survey.demographicFields.length > 0 ? " 및 구분 항목" : ""}을 입력한
          후 평가를 시작해주세요.
        </p>
        <ButtonLink href={`/s/${slug}`} className="mt-4">
          평가 홈으로
        </ButtonLink>
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
          texts={texts}
          choices={choices}
          onScoreChange={(questionId, score) =>
            setScores((prev) => ({ ...prev, [questionId]: String(score) }))
          }
          onRankingChange={setRanking}
          onTextChange={(questionId, value) =>
            setTexts((prev) => ({ ...prev, [questionId]: value }))
          }
          onChoiceChange={(questionId, selected) =>
            setChoices((prev) => ({ ...prev, [questionId]: selected }))
          }
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <ButtonLink
          href={`/s/${slug}`}
          variant="secondary"
          className="flex-1 py-3"
        >
          취소
        </ButtonLink>
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
