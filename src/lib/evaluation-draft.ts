import {
  validateChoiceAnswer,
} from "./choice-utils";
import {
  parseStoredChoiceAnswer,
  parseStoredRankingAnswer,
  parseStoredScoreAnswer,
  questionIncludesReason,
  serializeStoredChoiceAnswer,
  serializeStoredRankingAnswer,
  serializeStoredScoreAnswer,
  validateCombinedReasonText,
} from "./combined-reason-utils";
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
  validateRankingAnswer,
  type RankingAnswer,
} from "./ranking-utils";
import {
  serializeScoreReasonAnswer,
  validateAttributeEvalQuestion,
  validateScoreCompareQuestion,
} from "./score-reason-utils";
import type {
  AgeGroup,
  ChoiceQuestionConfig,
  Gender,
  Question,
  RankingQuestionConfig,
  ScoreCompareQuestionConfig,
  Section,
  SurveyDetail,
  TextQuestionConfig,
} from "./types";

export interface ScoreCompareDraftEntry {
  scores: Record<string, string>;
  reason: string;
}

/** @deprecated use ScoreCompareDraftEntry */
export type ScoreReasonDraftEntry = ScoreCompareDraftEntry;

export interface EvaluationDraft {
  surveyId: string;
  participantName: string;
  gender: Gender | "";
  ageGroup: AgeGroup | "";
  demographicValues: Record<string, string>;
  completedSectionIds: string[];
  scores: Record<string, string>;
  scoreCompares: Record<string, ScoreCompareDraftEntry>;
  /** @deprecated use scoreCompares */
  scoreReasons?: Record<string, ScoreCompareDraftEntry>;
  rankings: Record<string, RankingAnswer>;
  texts: Record<string, string>;
  choices: Record<string, string[]>;
  reasons: Record<string, string>;
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
    scoreCompares: {},
    rankings: {},
    texts: {},
    choices: {},
    reasons: {},
  };
}

export function loadDraft(surveyId: string): EvaluationDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(draftKey(surveyId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EvaluationDraft>;
    const scoreCompares = parsed.scoreCompares ?? parsed.scoreReasons ?? {};
    return {
      ...createEmptyDraft(surveyId),
      ...parsed,
      texts: parsed.texts ?? {},
      scoreCompares,
      choices: normalizeDraftChoices(parsed.choices),
      reasons: parsed.reasons ?? {},
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

export function getScoreCompareEntry(
  draft: Pick<EvaluationDraft, "scoreCompares">,
  questionId: string
): ScoreCompareDraftEntry {
  return draft.scoreCompares[questionId] ?? { scores: {}, reason: "" };
}

export function sectionHasQuestions(
  section: Section & { questions: Question[] }
): boolean {
  return section.questions.some(
    (q) =>
      q.type === "score" ||
      q.type === "score-compare" ||
      q.type === "attribute-eval" ||
      q.type === "ranking" ||
      q.type === "text" ||
      q.type === "choice"
  );
}

function validateQuestionAnswer(
  question: Question,
  section: Section & { questions: Question[] },
  draft: Pick<
    EvaluationDraft,
    "scores" | "scoreCompares" | "rankings" | "texts" | "choices" | "reasons"
  >,
  rank1: string
): string | null {
  if (question.type === "score-compare") {
    return validateScoreCompareQuestion(
      question,
      getScoreCompareEntry(draft, question.id)
    );
  }

  if (question.type === "attribute-eval") {
    return validateAttributeEvalQuestion(
      question,
      getScoreCompareEntry(draft, question.id)
    );
  }

  if (question.type === "score") {
    if (!draft.scores[question.id]) {
      return "모든 항목의 점수를 선택해주세요.";
    }
    return validateCombinedReasonText(
      draft.reasons[question.id],
      question.config as ScoreCompareQuestionConfig
    );
  }

  if (question.type === "ranking") {
    const config = question.config as RankingQuestionConfig;
    const rankingError = validateRankingAnswer(
      draft.rankings[question.id],
      config.combinations.length
    );
    if (rankingError) return rankingError;
    return validateCombinedReasonText(
      draft.reasons[question.id],
      config
    );
  }

  if (question.type === "text") {
    if (
      isTextQuestionRequired(question, section, rank1) &&
      !draft.texts[question.id]?.trim()
    ) {
      return "이유 기술 문항에 답변을 입력해주세요.";
    }
    return null;
  }

  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    const choiceError = validateChoiceAnswer(
      draft.choices[question.id] ?? [],
      config
    );
    if (choiceError) return choiceError;
    return validateCombinedReasonText(
      draft.reasons[question.id],
      config
    );
  }

  return null;
}

export function validateSectionAnswers(
  section: Section & { questions: Question[] },
  scores: Record<string, string>,
  scoreCompares: Record<string, ScoreCompareDraftEntry>,
  rankings: Record<string, RankingAnswer>,
  texts: Record<string, string>,
  choices: Record<string, string[]>,
  reasons: Record<string, string> = {}
): string | null {
  const rank1 = getRank1ForSection(section, rankings);
  const draft = { scores, scoreCompares, rankings, texts, choices, reasons };

  for (const question of section.questions) {
    const error = validateQuestionAnswer(question, section, draft, rank1);
    if (error) return error;
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
      draft.scoreCompares,
      draft.rankings,
      draft.texts,
      draft.choices,
      draft.reasons
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
      draft.scoreCompares,
      draft.rankings,
      draft.texts,
      draft.choices,
      draft.reasons
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
          value: serializeStoredScoreAnswer(
            score,
            draft.reasons[question.id] ?? "",
            questionIncludesReason(question)
          ),
        });
      } else if (question.type === "score-compare") {
        const entry = getScoreCompareEntry(draft, question.id);
        const validationError = validateScoreCompareQuestion(question, entry);
        if (validationError) {
          throw new Error(validationError);
        }
        answers.push({
          questionId: question.id,
          value: serializeScoreReasonAnswer(
            entry.scores,
            questionIncludesReason(question) ? entry.reason : ""
          ),
        });
      } else if (question.type === "attribute-eval") {
        const entry = getScoreCompareEntry(draft, question.id);
        const validationError = validateAttributeEvalQuestion(question, entry);
        if (validationError) {
          throw new Error(validationError);
        }
        answers.push({
          questionId: question.id,
          value: serializeScoreReasonAnswer(
            entry.scores,
            questionIncludesReason(question) ? entry.reason : ""
          ),
        });
      } else if (question.type === "ranking") {
        const config = question.config as RankingQuestionConfig;
        const ranking = normalizeRankingAnswer(draft.rankings[question.id]);
        answers.push({
          questionId: question.id,
          value: serializeStoredRankingAnswer(
            ranking,
            config.combinations.length,
            draft.reasons[question.id] ?? "",
            questionIncludesReason(question)
          ),
        });
      } else if (question.type === "text") {
        if (!isTextQuestionRequired(question, section, rank1)) {
          continue;
        }
        const text = draft.texts[question.id]?.trim();
        if (!text) {
          throw new Error("이유 기술 문항에 답변을 입력해주세요.");
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
          value: serializeStoredChoiceAnswer(
            selected,
            draft.reasons[question.id] ?? "",
            config,
            questionIncludesReason(question)
          ),
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

/** Restore combined reason fields from stored answers when loading draft from answers. */
export function hydrateDraftFromAnswers(
  draft: EvaluationDraft,
  questions: Question[],
  answersByQuestionId: Map<string, string>
): EvaluationDraft {
  const next = { ...draft, reasons: { ...draft.reasons } };

  for (const question of questions) {
    const value = answersByQuestionId.get(question.id);
    if (!value) continue;

    if (question.type === "score") {
      const parsed = parseStoredScoreAnswer(value);
      next.scores[question.id] = parsed.score;
      if (parsed.reason) next.reasons[question.id] = parsed.reason;
    } else if (question.type === "score-compare") {
      // handled via scoreCompares elsewhere if needed
    } else if (question.type === "choice") {
      const config = question.config as ChoiceQuestionConfig;
      const parsed = parseStoredChoiceAnswer(value, config);
      next.choices[question.id] = parsed.selected;
      if (parsed.reason) next.reasons[question.id] = parsed.reason;
    } else if (question.type === "ranking") {
      const parsed = parseStoredRankingAnswer(value);
      next.rankings[question.id] = parsed.ranking;
      if (parsed.reason) next.reasons[question.id] = parsed.reason;
    }
  }

  return next;
}
