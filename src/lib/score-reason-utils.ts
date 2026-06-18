import type { Question, ScoreReasonQuestionConfig } from "./types";
import { isValidScoreValue } from "./types";

export interface ScoreReasonAnswer {
  score: number;
  reason: string;
}

export function parseScoreReasonAnswer(value: string): ScoreReasonAnswer | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ScoreReasonAnswer>;
    if (
      typeof parsed.score === "number" &&
      Number.isInteger(parsed.score) &&
      typeof parsed.reason === "string"
    ) {
      return { score: parsed.score, reason: parsed.reason };
    }
  } catch {
    // fall through for legacy plain score strings
  }

  if (isValidScoreValue(value)) {
    return { score: Number(value), reason: "" };
  }

  return null;
}

export function serializeScoreReasonAnswer(
  score: string,
  reason: string
): string {
  return JSON.stringify({
    score: Number(score),
    reason: reason.trim(),
  });
}

export function scoreFromAnswerValue(value: string): number | null {
  const parsed = parseScoreReasonAnswer(value);
  if (parsed) return parsed.score;

  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function validateScoreReasonValue(
  value: string,
  maxLength = 500
): string | null {
  const parsed = parseScoreReasonAnswer(value);
  if (!parsed) {
    return "점수 및 이유 답변 형식이 올바르지 않습니다.";
  }

  if (!isValidScoreValue(String(parsed.score))) {
    return "점수는 1~7 사이여야 합니다.";
  }

  const trimmedReason = parsed.reason.trim();
  if (!trimmedReason) {
    return "고득점 디자인 안에 대한 이유를 입력해주세요.";
  }

  if (trimmedReason.length > maxLength) {
    return `이유는 ${maxLength}자 이하여야 합니다.`;
  }

  return null;
}

export function groupScoreReasonQuestionsByCategory(
  questions: Question[]
): Map<string, Question[]> {
  const grouped = new Map<string, Question[]>();

  for (const question of questions) {
    if (question.type !== "score-reason") continue;
    const config = question.config as ScoreReasonQuestionConfig;
    const category = config.category;
    const existing = grouped.get(category) ?? [];
    existing.push(question);
    grouped.set(category, existing);
  }

  for (const [category, categoryQuestions] of grouped) {
    grouped.set(
      category,
      [...categoryQuestions].sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }

  return grouped;
}

export function getWinningQuestionIdsInCategory(
  questions: Question[],
  scoreReasons: Record<string, { score: string; reason: string }>
): string[] {
  let bestScore = Number.NEGATIVE_INFINITY;
  let winners: string[] = [];

  for (const question of questions) {
    const entry = scoreReasons[question.id];
    if (!entry?.score || !isValidScoreValue(entry.score)) continue;

    const score = Number(entry.score);
    if (score > bestScore) {
      bestScore = score;
      winners = [question.id];
    } else if (score === bestScore) {
      winners.push(question.id);
    }
  }

  return winners;
}

export function validateScoreReasonCategory(
  questions: Question[],
  scoreReasons: Record<string, { score: string; reason: string }>
): string | null {
  for (const question of questions) {
    if (!scoreReasons[question.id]?.score) {
      return "모든 항목의 점수를 선택해주세요.";
    }
  }

  const winners = getWinningQuestionIdsInCategory(questions, scoreReasons);
  if (winners.length === 0) {
    return "모든 항목의 점수를 선택해주세요.";
  }

  for (const questionId of winners) {
    const question = questions.find((entry) => entry.id === questionId);
    const config = question?.config as ScoreReasonQuestionConfig | undefined;
    const maxLength = config?.maxLength ?? 500;
    const reason = scoreReasons[questionId]?.reason?.trim() ?? "";

    if (!reason) {
      return "가장 높은 점수를 준 디자인 안에 대한 이유를 입력해주세요.";
    }

    if (reason.length > maxLength) {
      return `이유는 ${maxLength}자 이하여야 합니다.`;
    }
  }

  return null;
}

export function getWinningCombinationForResponse(
  questions: Question[],
  responseId: string,
  answers: { responseId: string; questionId: string; value: string }[]
): string | null {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestCombination: string | null = null;

  for (const question of questions) {
    const answer = answers.find(
      (entry) =>
        entry.responseId === responseId && entry.questionId === question.id
    );
    const parsed = parseScoreReasonAnswer(answer?.value ?? "");
    if (!parsed) continue;

    const config = question.config as ScoreReasonQuestionConfig;
    if (parsed.score > bestScore) {
      bestScore = parsed.score;
      bestCombination = config.combination;
    }
  }

  return bestCombination;
}

export function getReasonForWinningCombination(
  questions: Question[],
  responseId: string,
  winningCombination: string,
  answers: { responseId: string; questionId: string; value: string }[]
): string | null {
  let bestScore = Number.NEGATIVE_INFINITY;
  let reason: string | null = null;

  for (const question of questions) {
    const config = question.config as ScoreReasonQuestionConfig;
    if (config.combination !== winningCombination) continue;

    const answer = answers.find(
      (entry) =>
        entry.responseId === responseId && entry.questionId === question.id
    );
    const parsed = parseScoreReasonAnswer(answer?.value ?? "");
    if (!parsed) continue;

    if (parsed.score > bestScore) {
      bestScore = parsed.score;
      reason = parsed.reason.trim() || null;
    }
  }

  return reason;
}
