import type {
  AgeGroup,
  Gender,
  Question,
  Section,
  SurveyDetail,
} from "./types";

export interface EvaluationDraft {
  surveyId: string;
  gender: Gender | "";
  ageGroup: AgeGroup | "";
  completedSectionIds: string[];
  scores: Record<string, string>;
  rankings: Record<string, { rank1: string; rank2: string }>;
}

function draftKey(surveyId: string): string {
  return `pe-mini-draft-${surveyId}`;
}

export function createEmptyDraft(surveyId: string): EvaluationDraft {
  return {
    surveyId,
    gender: "",
    ageGroup: "",
    completedSectionIds: [],
    scores: {},
    rankings: {},
  };
}

export function loadDraft(surveyId: string): EvaluationDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(draftKey(surveyId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EvaluationDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: EvaluationDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(draftKey(draft.surveyId), JSON.stringify(draft));
}

export function clearDraft(surveyId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(surveyId));
}

export function getOrCreateDraft(surveyId: string): EvaluationDraft {
  return loadDraft(surveyId) ?? createEmptyDraft(surveyId);
}

export function sectionHasQuestions(
  section: Section & { questions: Question[] }
): boolean {
  return section.questions.some(
    (q) => q.type === "score" || q.type === "ranking"
  );
}

export function validateSectionAnswers(
  section: Section & { questions: Question[] },
  scores: Record<string, string>,
  rankings: Record<string, { rank1: string; rank2: string }>
): string | null {
  for (const question of section.questions) {
    if (question.type === "score") {
      if (!scores[question.id]) {
        return "모든 항목의 점수를 선택해주세요.";
      }
    } else if (question.type === "ranking") {
      const ranking = rankings[question.id];
      if (!ranking?.rank1 || !ranking?.rank2) {
        return "순위를 모두 선택해주세요.";
      }
      if (ranking.rank1 === ranking.rank2) {
        return "1순위와 2순위는 달라야 합니다.";
      }
    }
  }

  if (!sectionHasQuestions(section)) {
    return "평가할 문항이 없습니다.";
  }

  return null;
}

export function isSectionCompleted(
  sectionId: string,
  draft: EvaluationDraft
): boolean {
  return draft.completedSectionIds.includes(sectionId);
}

export function allSectionsCompleted(
  survey: SurveyDetail,
  draft: EvaluationDraft
): boolean {
  const evaluable = survey.sections.filter(sectionHasQuestions);
  if (evaluable.length === 0) return false;
  return evaluable.every((section) =>
    draft.completedSectionIds.includes(section.id)
  );
}

export function buildSubmitPayload(
  survey: SurveyDetail,
  draft: EvaluationDraft
) {
  const answers: { questionId: string; value: string }[] = [];

  for (const section of survey.sections) {
    for (const question of section.questions) {
      if (question.type === "score") {
        answers.push({
          questionId: question.id,
          value: draft.scores[question.id] ?? "3",
        });
      } else if (question.type === "ranking") {
        const ranking = draft.rankings[question.id];
        answers.push({
          questionId: question.id,
          value: JSON.stringify({
            rank1: ranking?.rank1 ?? "",
            rank2: ranking?.rank2 ?? "",
          }),
        });
      }
    }
  }

  return {
    gender: draft.gender as Gender,
    ageGroup: draft.ageGroup as AgeGroup,
    answers,
  };
}
