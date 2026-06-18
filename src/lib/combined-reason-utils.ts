import { parseChoiceAnswer, serializeChoiceAnswer } from "./choice-utils";
import {
  normalizeRankingAnswer,
  serializeRankingAnswer,
  type RankingAnswer,
} from "./ranking-utils";
import type {
  ChoiceQuestionConfig,
  Question,
} from "./types";

export interface CombinedReasonConfig {
  includeReason?: boolean;
  reasonPlaceholder?: string;
  reasonMaxLength?: number;
}

export const DEFAULT_REASON_PLACEHOLDER = "이유를 입력해주세요";
export const DEFAULT_REASON_MAX_LENGTH = 500;

export function normalizeCombinedReasonFields(
  raw: Partial<CombinedReasonConfig> & {
    placeholder?: string;
    maxLength?: number;
  } = {}
): CombinedReasonConfig {
  return {
    includeReason: !!raw.includeReason,
    reasonPlaceholder:
      raw.reasonPlaceholder ??
      raw.placeholder ??
      DEFAULT_REASON_PLACEHOLDER,
    reasonMaxLength:
      raw.reasonMaxLength ?? raw.maxLength ?? DEFAULT_REASON_MAX_LENGTH,
  };
}

export function questionIncludesReason(question: Question): boolean {
  return !!(question.config as CombinedReasonConfig).includeReason;
}

export function getReasonFieldConfig(question: Question): {
  placeholder: string;
  maxLength: number;
} {
  const config = question.config as CombinedReasonConfig;
  return {
    placeholder: config.reasonPlaceholder ?? DEFAULT_REASON_PLACEHOLDER,
    maxLength: config.reasonMaxLength ?? DEFAULT_REASON_MAX_LENGTH,
  };
}

export function validateCombinedReasonText(
  reason: string | undefined,
  config: CombinedReasonConfig
): string | null {
  if (!config.includeReason) return null;

  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    return "이유를 입력해주세요.";
  }

  const maxLength = config.reasonMaxLength ?? DEFAULT_REASON_MAX_LENGTH;
  if (trimmed.length > maxLength) {
    return `이유는 ${maxLength}자 이하여야 합니다.`;
  }

  return null;
}

export function extractReasonFromAnswer(value: string): string {
  if (!value) return "";

  try {
    const parsed = JSON.parse(value) as { reason?: string };
    return typeof parsed.reason === "string" ? parsed.reason : "";
  } catch {
    return "";
  }
}

export function parseStoredScoreAnswer(value: string): {
  score: string;
  reason: string;
} {
  if (!value) return { score: "", reason: "" };

  try {
    const parsed = JSON.parse(value) as {
      score?: number | string;
      reason?: string;
    };
    if (parsed.score !== undefined && parsed.score !== null) {
      return {
        score: String(parsed.score),
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }
  } catch {
    // plain score string
  }

  return { score: value, reason: "" };
}

export function serializeStoredScoreAnswer(
  score: string,
  reason: string,
  includeReason: boolean
): string {
  if (!includeReason) return score;
  return JSON.stringify({ score: Number(score), reason: reason.trim() });
}

export function parseStoredChoiceAnswer(
  value: string,
  config: ChoiceQuestionConfig
): { selected: string[]; reason: string } {
  if (!value) return { selected: [], reason: "" };

  try {
    const parsed = JSON.parse(value) as {
      selected?: string[];
      reason?: string;
    };
    if (Array.isArray(parsed.selected)) {
      return {
        selected: parsed.selected.filter((item) => typeof item === "string"),
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }
  } catch {
    // fall through to legacy parser
  }

  return {
    selected: parseChoiceAnswer(value, config),
    reason: "",
  };
}

export function serializeStoredChoiceAnswer(
  selected: string[],
  reason: string,
  config: ChoiceQuestionConfig,
  includeReason: boolean
): string {
  const base = serializeChoiceAnswer(selected, config);
  if (!includeReason) return base;

  return JSON.stringify({
    selected: parseChoiceAnswer(base, config),
    reason: reason.trim(),
  });
}

export function parseStoredRankingAnswer(value: string): {
  ranking: RankingAnswer;
  reason: string;
} {
  if (!value) {
    return { ranking: normalizeRankingAnswer(), reason: "" };
  }

  try {
    const parsed = JSON.parse(value) as RankingAnswer & { reason?: string };
    if (parsed.rank1 && parsed.rank2) {
      return {
        ranking: normalizeRankingAnswer(parsed),
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }
  } catch {
    // fall through
  }

  return { ranking: normalizeRankingAnswer(), reason: "" };
}

export function serializeStoredRankingAnswer(
  ranking: RankingAnswer,
  combinationCount: number,
  reason: string,
  includeReason: boolean
): string {
  const base = serializeRankingAnswer(ranking, combinationCount);
  if (!includeReason) return base;

  const parsed = JSON.parse(base) as RankingAnswer;
  return JSON.stringify({
    ...parsed,
    reason: reason.trim(),
  });
}

export function defaultReasonLabel(question: Question): string {
  switch (question.type) {
    case "choice":
      return "선택 이유";
    case "score":
      return "점수 부여 이유";
    case "ranking":
      return "순위 선정 이유";
    case "score-compare":
      return "가장 높은 점수를 준 안에 대한 이유";
    default:
      return "이유";
  }
}
