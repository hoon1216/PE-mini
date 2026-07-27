import {
  validateChoiceAnswer,
} from "./choice-utils";
import {
  extractReasonFromAnswer,
  parseStoredChoiceAnswer,
  parseStoredScoreAnswer,
  questionIncludesReason,
  validateCombinedReasonText,
} from "./combined-reason-utils";
import { validateDemographicValues } from "./demographic-field-utils";
import { parseRankingAnswer } from "./demographic-utils";
import {
  parseScoreReasonAnswer,
  validateAttributeEvalQuestion,
  validateScoreCompareQuestion,
  validateUniqueScoreCompareScores,
} from "./score-reason-utils";
import type {
  AgeGroup,
  AttributeEvalQuestionConfig,
  ChoiceQuestionConfig,
  Gender,
  Question,
  RankingQuestionConfig,
  ScoreCompareQuestionConfig,
  SubmitResponseInput,
  SurveyDetail,
  TextQuestionConfig,
} from "./types";
import { isValidScoreValue, SCORE_MAX, SCORE_MIN } from "./types";
import { getRequiredQuestionsForSurvey } from "./text-grouping-utils";
import { validateRankingAnswer } from "./ranking-utils";
import type { RankingAnswer } from "./ranking-utils";

const GENDERS: Gender[] = ["male", "female"];
const AGE_GROUPS: AgeGroup[] = ["10s", "20s", "30s", "40s", "50s", "60s"];

export class SubmitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmitValidationError";
  }
}

function isGender(value: string): value is Gender {
  return (GENDERS as string[]).includes(value);
}

function isAgeGroup(value: string): value is AgeGroup {
  return (AGE_GROUPS as string[]).includes(value);
}

function validateScoreValue(value: string): string | null {
  if (!isValidScoreValue(value)) {
    return `점수는 ${SCORE_MIN}~${SCORE_MAX} 사이여야 합니다.`;
  }
  return null;
}

function validateRankingValue(
  value: string,
  combinationCount: number
): string | null {
  const parsed = parseRankingAnswer(value);
  if (!parsed) {
    return "순위 답변 형식이 올바르지 않습니다.";
  }

  const ranking: RankingAnswer = {
    rank1: parsed.rank1,
    rank2: parsed.rank2,
    rank3: parsed.rank3,
  };

  return validateRankingAnswer(ranking, combinationCount);
}

function validateAnswerForQuestion(
  question: Question,
  value: string
): string | null {
  if (question.type === "score") {
    const parsed = parseStoredScoreAnswer(value);
    const scoreError = validateScoreValue(parsed.score);
    if (scoreError) return scoreError;
    return validateCombinedReasonText(
      parsed.reason,
      question.config as ScoreCompareQuestionConfig
    );
  }

  if (question.type === "score-compare") {
    const config = question.config as ScoreCompareQuestionConfig;
    const parsed = parseScoreReasonAnswer(value, config.combinations);
    if (!parsed) {
      return "안 점수 비교 답변 형식이 올바르지 않습니다.";
    }

    for (const combination of config.combinations) {
      const score = parsed.scores[combination];
      if (typeof score !== "number" || !isValidScoreValue(String(score))) {
        return `점수는 ${SCORE_MIN}~${SCORE_MAX} 사이여야 합니다.`;
      }
    }

    const duplicateError = validateUniqueScoreCompareScores(config, {
      scores: Object.fromEntries(
        Object.entries(parsed.scores).map(([combination, score]) => [
          combination,
          String(score),
        ])
      ),
      reason: parsed.reason,
    });
    if (duplicateError) return duplicateError;

    if (questionIncludesReason(question)) {
      return validateCombinedReasonText(parsed.reason, config);
    }

    return null;
  }

  if (question.type === "attribute-eval") {
    const config = question.config as AttributeEvalQuestionConfig;
    const parsed = parseScoreReasonAnswer(value, config.attributes);
    if (!parsed) {
      return "속성 평가 답변 형식이 올바르지 않습니다.";
    }

    const draftEntry = {
      scores: Object.fromEntries(
        Object.entries(parsed.scores).map(([attribute, score]) => [
          attribute,
          String(score),
        ])
      ),
      reason: parsed.reason,
    };

    return validateAttributeEvalQuestion(question, draftEntry);
  }

  if (question.type === "ranking") {
    const config = question.config as RankingQuestionConfig;
    const rankingError = validateRankingValue(value, config.combinations.length);
    if (rankingError) return rankingError;
    return validateCombinedReasonText(extractReasonFromAnswer(value), config);
  }

  if (question.type === "text") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "이유 기술 문항에 답변을 입력해주세요.";
    }
    const config = question.config as TextQuestionConfig;
    const maxLength = config.maxLength ?? 500;
    if (trimmed.length > maxLength) {
      return `답변은 ${maxLength}자 이하여야 합니다.`;
    }
    return null;
  }

  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    const parsed = parseStoredChoiceAnswer(value, config);
    const choiceError = validateChoiceAnswer(parsed.selected, config);
    if (choiceError) return choiceError;
    return validateCombinedReasonText(parsed.reason, config);
  }

  return "지원하지 않는 문항 유형입니다.";
}

export function validateSubmitResponse(
  survey: SurveyDetail,
  input: SubmitResponseInput
): void {
  if (!input.participantName?.trim()) {
    throw new SubmitValidationError("이름을 입력해주세요.");
  }

  if (!input.gender || !isGender(input.gender)) {
    throw new SubmitValidationError("유효한 성별을 선택해주세요.");
  }

  if (!input.ageGroup || !isAgeGroup(input.ageGroup)) {
    throw new SubmitValidationError("유효한 연령대를 선택해주세요.");
  }

  const demographicError = validateDemographicValues(
    survey.demographicFields,
    input.demographicValues
  );
  if (demographicError) {
    throw new SubmitValidationError(demographicError);
  }

  const allQuestions = survey.sections.flatMap((section) => section.questions);
  const questionById = new Map(allQuestions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();

  if (!input.answers?.length) {
    throw new SubmitValidationError("답변을 입력해주세요.");
  }

  const answerMap = new Map(
    input.answers.map((answer) => [answer.questionId, answer.value])
  );
  const requiredQuestions = getRequiredQuestionsForSurvey(survey, answerMap);

  if (requiredQuestions.length === 0) {
    throw new SubmitValidationError("평가할 문항이 없습니다.");
  }

  for (const answer of input.answers) {
    if (!answer.questionId || seenQuestionIds.has(answer.questionId)) {
      throw new SubmitValidationError("중복되거나 잘못된 문항 답변이 있습니다.");
    }

    const question = questionById.get(answer.questionId);
    if (!question) {
      throw new SubmitValidationError("조사에 없는 문항에 답변했습니다.");
    }

    const validationError = validateAnswerForQuestion(question, answer.value);
    if (validationError) {
      throw new SubmitValidationError(validationError);
    }

    seenQuestionIds.add(answer.questionId);
  }

  for (const question of requiredQuestions) {
    if (!seenQuestionIds.has(question.id)) {
      throw new SubmitValidationError("모든 문항에 답변해주세요.");
    }
  }

  for (const question of allQuestions) {
    if (question.type !== "score-compare" || !questionIncludesReason(question)) {
      continue;
    }

    const value = answerMap.get(question.id);
    if (!value) continue;

    const config = question.config as ScoreCompareQuestionConfig;
    const parsed = parseScoreReasonAnswer(value, config.combinations);
    const entry = parsed
      ? {
          scores: Object.fromEntries(
            Object.entries(parsed.scores).map(([combination, score]) => [
              combination,
              String(score),
            ])
          ),
          reason: parsed.reason,
        }
      : undefined;
    const questionError = validateScoreCompareQuestion(question, entry);
    if (questionError) {
      throw new SubmitValidationError(questionError);
    }
  }
}
