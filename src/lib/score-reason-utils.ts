import type { Question, ScoreCompareQuestionConfig } from "./types";
import {
  questionIncludesReason,
  validateCombinedReasonText,
} from "./combined-reason-utils";
import { isValidScoreValue } from "./types";

export interface ScoreReasonAnswer {
  scores: Record<string, number>;
  reason: string;
}

export interface ScoreReasonDraftLike {
  scores: Record<string, string>;
  reason: string;
}

export function scoreReasonItemKey(
  questionId: string,
  combination: string
): string {
  return `${questionId}::${combination}`;
}

export function parseScoreReasonItemKey(
  itemKey: string
): { questionId: string; combination: string } | null {
  const separatorIndex = itemKey.indexOf("::");
  if (separatorIndex <= 0) return null;

  return {
    questionId: itemKey.slice(0, separatorIndex),
    combination: itemKey.slice(separatorIndex + 2),
  };
}

export function parseScoreReasonAnswer(
  value: string,
  combinations: string[] = []
): ScoreReasonAnswer | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<
      ScoreReasonAnswer & { score?: number }
    >;

    if (parsed.scores && typeof parsed.scores === "object") {
      const scores: Record<string, number> = {};
      for (const [combination, score] of Object.entries(parsed.scores)) {
        if (typeof score === "number" && Number.isInteger(score)) {
          scores[combination] = score;
        }
      }
      return {
        scores,
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }

    if (
      typeof parsed.score === "number" &&
      Number.isInteger(parsed.score) &&
      combinations[0]
    ) {
      return {
        scores: { [combinations[0]]: parsed.score },
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }
  } catch {
    // fall through for legacy plain score strings
  }

  if (isValidScoreValue(value) && combinations[0]) {
    return { scores: { [combinations[0]]: Number(value) }, reason: "" };
  }

  return null;
}

export function serializeScoreReasonAnswer(
  scores: Record<string, string>,
  reason: string
): string {
  const normalizedScores: Record<string, number> = {};

  for (const [combination, score] of Object.entries(scores)) {
    if (!isValidScoreValue(score)) continue;
    normalizedScores[combination] = Number(score);
  }

  return JSON.stringify({
    scores: normalizedScores,
    reason: reason.trim(),
  });
}

export function getScoreReasonCombinationScore(
  answers: { responseId: string; questionId: string; value: string }[],
  responseId: string,
  questionId: string,
  combination: string,
  combinations: string[]
): number | null {
  const answer = answers.find(
    (entry) => entry.responseId === responseId && entry.questionId === questionId
  );
  const parsed = parseScoreReasonAnswer(answer?.value ?? "", combinations);
  const score = parsed?.scores[combination];
  return typeof score === "number" ? score : null;
}

export function scoreFromAnswerValue(
  value: string,
  combinations: string[] = []
): number | null {
  const parsed = parseScoreReasonAnswer(value, combinations);
  if (parsed) {
    const values = Object.values(parsed.scores);
    return values.length > 0 ? values[0] : null;
  }

  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function getWinningCombinations(
  question: Question,
  entry: ScoreReasonDraftLike | undefined
): string[] {
  const config = question.config as ScoreCompareQuestionConfig;
  let bestScore = Number.NEGATIVE_INFINITY;
  let winners: string[] = [];

  for (const combination of config.combinations) {
    const scoreValue = entry?.scores[combination];
    if (!scoreValue || !isValidScoreValue(scoreValue)) continue;

    const score = Number(scoreValue);
    if (score > bestScore) {
      bestScore = score;
      winners = [combination];
    } else if (score === bestScore) {
      winners.push(combination);
    }
  }

  return winners;
}

export function validateScoreCompareQuestion(
  question: Question,
  entry: ScoreReasonDraftLike | undefined
): string | null {
  const config = question.config as ScoreCompareQuestionConfig;

  for (const combination of config.combinations) {
    if (!entry?.scores[combination] || !isValidScoreValue(entry.scores[combination])) {
      return "모든 안의 점수를 선택해주세요.";
    }
  }

  const winners = getWinningCombinations(question, entry);
  if (winners.length === 0) {
    return "모든 안의 점수를 선택해주세요.";
  }

  if (!questionIncludesReason(question)) {
    return null;
  }

  return validateCombinedReasonText(entry?.reason, config);
}

/** @deprecated use validateScoreCompareQuestion */
export const validateScoreReasonQuestion = validateScoreCompareQuestion;

export function getWinningCombinationForQuestionResponse(
  question: Question,
  responseId: string,
  answers: { responseId: string; questionId: string; value: string }[]
): string | null {
  const config = question.config as ScoreCompareQuestionConfig;
  const answer = answers.find(
    (entry) => entry.responseId === responseId && entry.questionId === question.id
  );
  const parsed = parseScoreReasonAnswer(answer?.value ?? "", config.combinations);
  if (!parsed) return null;

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestCombination: string | null = null;

  for (const combination of config.combinations) {
    const score = parsed.scores[combination];
    if (typeof score !== "number") continue;

    if (score > bestScore) {
      bestScore = score;
      bestCombination = combination;
    }
  }

  return bestCombination;
}

export function getReasonForQuestionResponse(
  question: Question,
  responseId: string,
  answers: { responseId: string; questionId: string; value: string }[]
): string | null {
  const config = question.config as ScoreCompareQuestionConfig;
  const answer = answers.find(
    (entry) => entry.responseId === responseId && entry.questionId === question.id
  );
  const parsed = parseScoreReasonAnswer(answer?.value ?? "", config.combinations);
  if (!parsed) return null;

  const winningCombination = getWinningCombinationForQuestionResponse(
    question,
    responseId,
    answers
  );
  if (!winningCombination) return null;

  const winningScore = parsed.scores[winningCombination];
  if (typeof winningScore !== "number") return null;

  return parsed.reason.trim() || null;
}

export function flattenScoreCompareQuestions(
  questions: Question[]
): Array<{
  id: string;
  questionId: string;
  category: string;
  combination: string;
  combinations: string[];
}> {
  return questions.flatMap((question) => {
    const config = question.config as ScoreCompareQuestionConfig;
    return config.combinations.map((combination) => ({
      id: scoreReasonItemKey(question.id, combination),
      questionId: question.id,
      category: config.category,
      combination,
      combinations: config.combinations,
    }));
  });
}

/** @deprecated use flattenScoreCompareQuestions */
export const flattenScoreReasonQuestions = flattenScoreCompareQuestions;
