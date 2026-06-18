"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchJson } from "@/lib/fetch-json";
import {
  allSectionsCompleted,
  buildSubmitPayload,
  clearDraft,
  getOrCreateDraft,
  isParticipantProfileComplete,
  isSectionCompleted,
  saveDraft,
  sectionHasQuestions,
  type ScoreCompareDraftEntry,
} from "@/lib/evaluation-draft";
import type { RankingAnswer } from "@/lib/ranking-utils";
import type { AgeGroup, Gender, SurveyDetail } from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";

interface EvaluationHomeProps {
  slug: string;
}

export function EvaluationHome({ slug }: EvaluationHomeProps) {
  const pathname = usePathname();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");
  const [demographicValues, setDemographicValues] = useState<
    Record<string, string>
  >({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [draftScoreCompares, setDraftScoreCompares] = useState<
    Record<string, ScoreCompareDraftEntry>
  >({});
  const [draftRankings, setDraftRankings] = useState<
    Record<string, RankingAnswer>
  >({});
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [draftChoices, setDraftChoices] = useState<Record<string, string[]>>({});
  const [draftReasons, setDraftReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function syncDraftState(surveyId: string) {
    const draft = getOrCreateDraft(surveyId);
    setParticipantName(draft.participantName ?? "");
    setGender(draft.gender);
    setAgeGroup(draft.ageGroup);
    setDemographicValues({ ...draft.demographicValues });
    setCompletedIds([...draft.completedSectionIds]);
    setDraftScores({ ...draft.scores });
    setDraftScoreCompares({ ...draft.scoreCompares });
    setDraftRankings({ ...draft.rankings });
    setDraftTexts({ ...draft.texts });
    setDraftChoices({ ...draft.choices });
    setDraftReasons({ ...draft.reasons });
  }

  useEffect(() => {
    fetchJson<SurveyDetail>(`/api/surveys/slug/${slug}`)
      .then((data) => {
        setSurvey(data);
        syncDraftState(data.id);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "조사 로딩 실패")
      )
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!survey) return;
    syncDraftState(survey.id);
  }, [survey, pathname]);

  function persistProfile(
    nextName: string,
    nextGender: Gender | "",
    nextAge: AgeGroup | "",
    nextDemographicValues: Record<string, string> = demographicValues
  ) {
    if (!survey) return;
    const draft = getOrCreateDraft(survey.id);
    draft.participantName = nextName;
    draft.gender = nextGender;
    draft.ageGroup = nextAge;
    draft.demographicValues = nextDemographicValues;
    saveDraft(draft);
  }

  function handleNameChange(value: string) {
    setParticipantName(value);
    persistProfile(value, gender, ageGroup);
  }

  function handleGenderChange(value: Gender) {
    setGender(value);
    persistProfile(participantName, value, ageGroup);
  }

  function handleAgeChange(value: AgeGroup) {
    setAgeGroup(value);
    persistProfile(participantName, gender, value);
  }

  function handleDemographicChange(fieldId: string, value: string) {
    const nextValues = { ...demographicValues, [fieldId]: value };
    setDemographicValues(nextValues);
    persistProfile(participantName, gender, ageGroup, nextValues);
  }

  const evaluableSections =
    survey?.sections.filter(sectionHasQuestions) ?? [];

  const currentDraft = survey
    ? {
        surveyId: survey.id,
        participantName,
        gender,
        ageGroup,
        demographicValues,
        completedSectionIds: completedIds,
        scores: draftScores,
        scoreCompares: draftScoreCompares,
        rankings: draftRankings,
        texts: draftTexts,
        choices: draftChoices,
        reasons: draftReasons,
      }
    : null;

  const completedCount = currentDraft
    ? evaluableSections.filter((section) =>
        isSectionCompleted(section, currentDraft)
      ).length
    : 0;

  const canSubmit =
    !!survey &&
    !!currentDraft &&
    allSectionsCompleted(survey, currentDraft);

  async function handleFinalSubmit() {
    if (!survey || !currentDraft || !canSubmit) return;

    setSubmitting(true);
    setError("");

    const draft = getOrCreateDraft(survey.id);
    draft.participantName = participantName.trim();
    draft.gender = gender;
    draft.ageGroup = ageGroup;
    draft.demographicValues = demographicValues;
    draft.completedSectionIds = completedIds;
    draft.scores = draftScores;
    draft.scoreCompares = draftScoreCompares;
    draft.rankings = draftRankings;
    draft.texts = draftTexts;
    draft.choices = draftChoices;
    draft.reasons = draftReasons;

    try {
      await fetchJson(`/api/surveys/${survey.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmitPayload(survey, draft)),
      });
      clearDraft(survey.id);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted">
        평가 내용을 불러오는 중...
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

  if (!survey) return null;

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold">제출 완료</h2>
        <p className="mt-3 text-sm text-muted">
          평가가 정상적으로 제출되었습니다. 참여해 주셔서 감사합니다.
        </p>
      </div>
    );
  }

  const profileReady =
    !!survey &&
    !!currentDraft &&
    isParticipantProfileComplete(survey, currentDraft);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-primary">평가 홈</p>
        <h1 className="mt-1 text-2xl font-bold">{survey.title}</h1>
        {survey.description && (
          <p className="mt-3 text-sm text-muted">{survey.description}</p>
        )}
        <p className="mt-4 text-sm text-muted">
          섹션별로 평가를 저장한 뒤, 모든 섹션을 완료하면 제출할 수 있습니다.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">조사 대상 정보</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor="participant-name" className="mb-1 block text-sm font-medium">
              이름
            </label>
            <input
              id="participant-name"
              type="text"
              value={participantName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="이름을 입력해주세요"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              maxLength={50}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="participant-gender" className="mb-1 block text-sm font-medium">
                성별
              </label>
              <select
                id="participant-gender"
                value={gender}
                onChange={(e) => handleGenderChange(e.target.value as Gender)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="participant-age" className="mb-1 block text-sm font-medium">
                연령대
              </label>
              <select
                id="participant-age"
                value={ageGroup}
                onChange={(e) => handleAgeChange(e.target.value as AgeGroup)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map((age) => (
                  <option key={age} value={age}>
                    {AGE_GROUP_LABELS[age]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {survey.demographicFields.map((field) => (
            <div key={field.id}>
              <label
                htmlFor={`demographic-${field.id}`}
                className="mb-1 block text-sm font-medium"
              >
                {field.label}
              </label>
              <select
                id={`demographic-${field.id}`}
                value={demographicValues[field.id] ?? ""}
                onChange={(e) =>
                  handleDemographicChange(field.id, e.target.value)
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">평가 섹션</h2>
          <span className="text-sm text-muted">
            {completedCount}/{evaluableSections.length} 완료
          </span>
        </div>

        {!profileReady && (
          <p className="mt-3 text-sm text-amber-700">
            섹션 평가를 시작하려면 이름, 성별, 연령대
            {survey.demographicFields.length > 0 ? " 및 구분 항목" : ""}을 먼저
            입력해주세요.
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {evaluableSections.map((section) => {
            const completed =
              !!currentDraft && isSectionCompleted(section, currentDraft);

            return (
              <li
                key={section.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{section.title}</p>
                  {section.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {section.description}
                    </p>
                  )}
                  {completed && (
                    <p className="mt-1 text-xs text-green-700">저장 완료</p>
                  )}
                </div>
                {profileReady ? (
                  <ButtonLink
                    href={`/s/${slug}/section/${section.id}`}
                    className="shrink-0 px-4 py-2"
                  >
                    {completed ? "수정" : "시작"}
                  </ButtonLink>
                ) : (
                  <Button type="button" className="shrink-0 px-4 py-2" disabled>
                    시작
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        className="w-full py-3"
        disabled={!canSubmit || submitting}
        onClick={handleFinalSubmit}
      >
        {submitting
          ? "제출 중..."
          : canSubmit
            ? "제출"
            : `제출 (${completedCount}/${evaluableSections.length} 섹션 완료)`}
      </Button>
    </div>
  );
}
