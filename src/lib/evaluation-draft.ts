import {
  serializeChoiceAnswer,
  validateChoiceAnswer,
} from "./choice-utils";
import {
  getRank1ForSection,
  isTextQuestionRequired,
} from "./text-grouping-utils";
import {
  isDemographicProfileComplete,
  normalizeDemographicValues,
  validateDemographicValues,
} from "./demographic-field-utils";
import {
  normalizeRankingAnswer,
  serializeRankingAnswer,
  validateRankingAnswer,
  type RankingAnswer,
} from "./ranking-utils";
import {
  groupScoreReasonQuestionsByCategory,
  serializeScoreReasonAnswer,
  validateScoreReasonCategory,
} from "./score-reason-utils";
import type {
  AgeGroup,
  Gender,
  Question,
  RankingQuestionConfig,
  Section,
  SurveyDetail,
  TextQuestionConfig,
  ChoiceQuestionConfig,
} from "./types";

export interface ScoreReasonDraftEntry {
  score: string;
  reason: string;
}

export interface EvaluationDraft {
  surveyId: string;
  participantName: string;
  gender: Gender | "";
  ageGroup: AgeGroup | "";
  demographicValues: Record<string, string>;
  completedSectionIds: string[];
  scores: Record<string, string>;
  scoreReasons: Record<string, ScoreReasonDraftEntry>;
  rankings: Record<string, RankingAnswer>;
  texts: Record<string, string>;
  choices: Record<string, string[]>;
}

function normalizeDraftChoices(
  choices: Record<string, string | string[]> | undefined
): Record<string, string[]> {
  if (!choices) return {};

  const result: Record<string, string[]> = {};
  for (const [questionId, value] of Object.entries(choices)) {
    if (Array.isArray(value)) {
      result[questionId] = value;
    } else if (typeof value === "string" && value) {
      result[questionId] = [value];
    } else {
      result[questionId] = [];
    }
  }
  return result;
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
    demographicValues: {},
    completedSectionIds: [],
    scores: {},
    scoreReasons: {},
    rankings: {},
    texts: {},
    choices: {},
  };
}

export function loadDraft(surveyId: string): EvaluationDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(draftKey(surveyId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EvaluationDraft>;
    return {
      ...createEmptyDraft(surveyId),
      ...parsed,
      texts: parsed.texts ?? {},
      scoreReasons: parsed.scoreReasons ?? {},
      choices: normalizeDraftChoices(parsed.choices),
      demographicValues: normalizeDemographicValues(parsed.demographicValues),
    };
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
    (q) =>
      q.type === "score" ||
      q.type === "score-reason" ||
      q.type === "ranking" ||
      q.type === "text" ||
      q.type === "choice"
  );
}

export function validateSectionAnswers(
  section: Section & { questions: Question[] },
  scores: Record<string, string>,
  scoreReasons: Record<string, ScoreReasonDraftEntry>,
  rankings: Record<string, RankingAnswer>,
  texts: Record<string, string>,
  choices: Record<string, string[]>
): string | null {
  const rank1 = getRank1ForSection(section, rankings);
  const scoreReasonByCategory = groupScoreReasonQuestionsByCategory(
    section.questions
  );

  for (const [, categoryQuestions] of scoreReasonByCategory) {
    const categoryError = validateScoreReasonCategory(
      categoryQuestions,
      scoreReasons
    );
    if (categoryError) return categoryError;
  }

  for (const question of section.questions) {
    if (question.type === "score") {
      if (!scores[question.id]) {
        return "모든 항목의 점수를 선택해주세요.";
      }
    } else if (question.type === "score-reason") {
      continue;
    } else if (question.type === "ranking") {
      const config = question.config as RankingQuestionConfig;
      const rankingError = validateRankingAnswer(
        rankings[question.id],
        config.combinations.length
      );
      if (rankingError) return rankingError;
    } else if (question.type === "text") {
      if (
        isTextQuestionRequired(question, section, rank1) &&
        !texts[question.id]?.trim()
      ) {
        return "주관식 문항에 답변을 입력해주세요.";
      }
    } else if (question.type === "choice") {
      const config = question.config as ChoiceQuestionConfig;
      const choiceError = validateChoiceAnswer(
        choices[question.id] ?? [],
        config
      );
      if (choiceError) return choiceError;
    }
  }

  if (!sectionHasQuestions(section)) {
    return "평가할 문항이 없습니다.";
  }

  return null;
}

export function isSectionCompleted(
  section: Section & { questions: Question[] },
  draft: EvaluationDraft
): boolean {
  if (!draft.completedSectionIds.includes(section.id)) {
    return false;
  }

  return (
    validateSectionAnswers(
      section,
      draft.scores,
      draft.scoreReasons,
      draft.rankings,
      draft.texts,
      draft.choices
    ) === null
  );
}

export function allSectionsCompleted(
  survey: SurveyDetail,
  draft: EvaluationDraft
): boolean {
  const evaluable = survey.sections.filter(sectionHasQuestions);
  if (evaluable.length === 0) return false;
  return evaluable.every((section) => isSectionCompleted(section, draft));
}

export function validateDraftForSubmit(
  survey: SurveyDetail,
  draft: EvaluationDraft
): string | null {
  if (!draft.participantName?.trim()) {
    return "이름을 입력해주세요.";
  }

  if (!draft.gender || !draft.ageGroup) {
    return "성별과 연령대를 선택해주세요.";
  }

  const demographicError = validateDemographicValues(
    survey.demographicFields,
    draft.demographicValues
  );
  if (demographicError) return demographicError;

  const evaluable = survey.sections.filter(sectionHasQuestions);
  for (const section of evaluable) {
    const error = validateSectionAnswers(
      section,
      draft.scores,
      draft.scoreReasons,
      draft.rankings,
      draft.texts,
      draft.choices
    );
    if (error) return error;
  }

  return null;
}

export function buildSubmitPayload(
  survey: SurveyDetail,
  draft: EvaluationDraft
) {
  const validationError = validateDraftForSubmit(survey, draft);
  if (validationError) {
    throw new Error(validationError);
  }

  const answers: { questionId: string; value: string }[] = [];

  for (const section of survey.sections) {
    const rank1 = getRank1ForSection(section, draft.rankings);

    for (const question of section.questions) {
      if (question.type === "score") {
        const score = draft.scores[question.id];
        if (!score) {
          throw new Error("모든 항목의 점수를 선택해주세요.");
        }
        answers.push({
          questionId: question.id,
          value: score,
        });
      } else if (question.type === "score-reason") {
        const entry = draft.scoreReasons[question.id];
        if (!entry?.score) {
          throw new Error("모든 항목의 점수를 선택해주세요.");
        }
        answers.push({
          questionId: question.id,
          value: serializeScoreReasonAnswer(entry.score, entry.reason ?? ""),
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
      } else if (question.type === "text") {
        if (!isTextQuestionRequired(question, section, rank1)) {
          continue;
        }
        const text = draft.texts[question.id]?.trim();
        if (!text) {
          throw new Error("주관식 문항에 답변을 입력해주세요.");
        }
        const config = question.config as TextQuestionConfig;
        const maxLength = config.maxLength ?? 500;
        answers.push({
          questionId: question.id,
          value: text.slice(0, maxLength),
        });
      } else if (question.type === "choice") {
        const config = question.config as ChoiceQuestionConfig;
        const selected = draft.choices[question.id] ?? [];
        const choiceError = validateChoiceAnswer(selected, config);
        if (choiceError) {
          throw new Error(choiceError);
        }
        answers.push({
          questionId: question.id,
          value: serializeChoiceAnswer(selected, config),
        });
      }
    }
  }

  return {
    participantName: draft.participantName.trim(),
    gender: draft.gender as Gender,
    ageGroup: draft.ageGroup as AgeGroup,
    demographicValues: draft.demographicValues,
    answers,
  };
}

export function isParticipantProfileComplete(
  survey: SurveyDetail,
  draft: EvaluationDraft
): boolean {
  return (
    !!draft.participantName?.trim() &&
    !!draft.gender &&
    !!draft.ageGroup &&
    isDemographicProfileComplete(survey.demographicFields, draft.demographicValues)
  );
}
