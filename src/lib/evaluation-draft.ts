import {
  normalizeRankingAnswer,
  serializeRankingAnswer,
  validateRankingAnswer,
  type RankingAnswer,
} from "./ranking-utils";
import type {
  AgeGroup,
  Gender,
  Question,
  RankingQuestionConfig,
  Section,
  SurveyDetail,
} from "./types";

export interface EvaluationDraft {
  surveyId: string;
  participantName: string;
  gender: Gender | "";
  ageGroup: AgeGroup | "";
  completedSectionIds: string[];
  scores: Record<string, string>;
  rankings: Record<string, RankingAnswer>;
}

function draftKey(surveyId: string): string {
  return `pe-mini-draft-${surveyId}`;
}

export function createEmptyDraft(surveyId: string): EvaluationDraft {
  return {
    surveyId,
    participantName: "",
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
  rankings: Record<string, RankingAnswer>
): string | null {
  for (const question of section.questions) {
    if (question.type === "score") {
      if (!scores[question.id]) {
        return "모든 항목의 점수를 선택해주세요.";
      }
    } else if (question.type === "ranking") {
      const config = question.config as RankingQuestionConfig;
      const rankingError = validateRankingAnswer(
        rankings[question.id],
        config.combinations.length
      );
      if (rankingError) return rankingError;
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
        const config = question.config as RankingQuestionConfig;
        const ranking = normalizeRankingAnswer(draft.rankings[question.id]);
        answers.push({
          questionId: question.id,
          value: serializeRankingAnswer(
            ranking,
            config.combinations.length
          ),
        });
      }
    }
  }

  return {
    participantName: draft.participantName.trim(),
    gender: draft.gender as Gender,
    ageGroup: draft.ageGroup as AgeGroup,
    answers,
  };
}
