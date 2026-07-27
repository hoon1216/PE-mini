import { parseChoiceAnswer } from "./choice-utils";
import {
  extractReasonFromAnswer,
  parseStoredScoreAnswer,
} from "./combined-reason-utils";
import { parseRankingAnswer } from "./demographic-utils";
import { parseScoreReasonAnswer } from "./score-reason-utils";
import type {
  AttributeEvalQuestionConfig,
  ChoiceQuestionConfig,
  Question,
  ScoreCompareQuestionConfig,
  ScoreQuestionConfig,
} from "./types";

function appendReason(base: string, reason: string): string {
  const trimmed = reason.trim();
  return trimmed ? `${base} / ${trimmed}` : base;
}

export function formatAnswerValue(question: Question, value: string): string {
  if (!value) return "-";

  if (question.type === "score") {
    const parsed = parseStoredScoreAnswer(value);
    return appendReason(`${parsed.score}점`, parsed.reason);
  }

  if (question.type === "score-compare") {
    const config = question.config as ScoreCompareQuestionConfig;
    const parsed = parseScoreReasonAnswer(value, config.combinations);
    if (!parsed) return value;
    const scoreParts = config.combinations
      .map((combination) => {
        const score = parsed.scores[combination];
        return typeof score === "number" ? `${combination}: ${score}점` : null;
      })
      .filter((part): part is string => part !== null);
    return appendReason(scoreParts.join(" / "), parsed.reason);
  }

  if (question.type === "attribute-eval") {
    const config = question.config as AttributeEvalQuestionConfig;
    const parsed = parseScoreReasonAnswer(value, config.attributes);
    if (!parsed) return value;
    const scoreParts = config.attributes
      .map((attribute) => {
        const score = parsed.scores[attribute];
        return typeof score === "number" ? `${attribute}: ${score}점` : null;
      })
      .filter((part): part is string => part !== null);
    return appendReason(
      `${config.designConcept} (${scoreParts.join(" / ")})`,
      parsed.reason
    );
  }

  if (question.type === "ranking") {
    const parsed = parseRankingAnswer(value);
    if (!parsed) return value;
    const parts = [`1순위: ${parsed.rank1}`, `2순위: ${parsed.rank2}`];
    if (parsed.rank3) parts.push(`3순위: ${parsed.rank3}`);
    return appendReason(parts.join(" / "), extractReasonFromAnswer(value));
  }

  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    const selected = parseChoiceAnswer(value, config);
    return appendReason(selected.join(", ") || value, extractReasonFromAnswer(value));
  }

  return value;
}

export function questionDisplayLabel(question: Question): string {
  if (question.type === "score") {
    const config = question.config as ScoreQuestionConfig;
    return config.combination || question.title;
  }
  if (question.type === "score-compare") {
    const config = question.config as ScoreCompareQuestionConfig;
    return config.combinations.join(", ") || question.title;
  }
  if (question.type === "attribute-eval") {
    const config = question.config as AttributeEvalQuestionConfig;
    return config.designConcept || question.title;
  }
  if (question.type === "ranking") {
    return question.title !== "순위 문항" ? question.title : "순위 선정";
  }
  if (question.type === "choice") {
    return question.title !== "안 선택 문항" ? question.title : "안 선택";
  }
  if (question.type === "text") {
    return question.title !== "이유 기술 문항" ? question.title : "이유 기술";
  }
  return question.title;
}
