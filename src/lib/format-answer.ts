import { choiceSelectCount, parseChoiceAnswer } from "./choice-utils";
import { parseRankingAnswer } from "./demographic-utils";
import type {
  ChoiceQuestionConfig,
  Question,
  ScoreQuestionConfig,
} from "./types";

export function formatAnswerValue(question: Question, value: string): string {
  if (!value) return "-";

  if (question.type === "score") {
    return `${value}점`;
  }

  if (question.type === "ranking") {
    const parsed = parseRankingAnswer(value);
    if (!parsed) return value;
    const parts = [`1순위: ${parsed.rank1}`, `2순위: ${parsed.rank2}`];
    if (parsed.rank3) parts.push(`3순위: ${parsed.rank3}`);
    return parts.join(" / ");
  }

  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    const selected = parseChoiceAnswer(value, choiceSelectCount(config));
    return selected.join(", ") || value;
  }

  return value;
}

export function questionDisplayLabel(question: Question): string {
  if (question.type === "score") {
    const config = question.config as ScoreQuestionConfig;
    return config.combination || question.title;
  }
  if (question.type === "ranking") {
    return question.title !== "순위 문항" ? question.title : "순위 선정";
  }
  if (question.type === "choice") {
    return question.title !== "객관식 문항" ? question.title : "객관식";
  }
  if (question.type === "text") {
    return question.title !== "주관식 문항" ? question.title : "주관식";
  }
  return question.title;
}
