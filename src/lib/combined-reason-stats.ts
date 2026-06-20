import {
  defaultReasonLabel,
  extractReasonFromAnswer,
  parseStoredChoiceAnswer,
  parseStoredRankingAnswer,
  parseStoredScoreAnswer,
  questionIncludesReason,
} from "./combined-reason-utils";
import type {
  Answer,
  ChoiceQuestionConfig,
  CombinedReasonBlockStats,
  Question,
  Response,
  ScoreQuestionConfig,
  TextReasonEntry,
} from "./types";

function extractReasonFromQuestionAnswer(
  question: Question,
  value: string
): string {
  switch (question.type) {
    case "score":
      return parseStoredScoreAnswer(value).reason.trim();
    case "choice":
      return parseStoredChoiceAnswer(
        value,
        question.config as ChoiceQuestionConfig
      ).reason.trim();
    case "ranking":
      return parseStoredRankingAnswer(value).reason.trim();
    default:
      return extractReasonFromAnswer(value).trim();
  }
}

export function buildCombinedReasonEntries(
  question: Question,
  responses: Response[],
  answers: Answer[]
): TextReasonEntry[] {
  if (!questionIncludesReason(question)) return [];

  const entries: TextReasonEntry[] = [];

  for (const response of responses) {
    const answer = answers.find(
      (entry) =>
        entry.responseId === response.id && entry.questionId === question.id
    );
    if (!answer) continue;

    const reason = extractReasonFromQuestionAnswer(question, answer.value);
    if (!reason) continue;

    entries.push({
      reason,
      gender: response.gender,
      ageGroup: response.ageGroup,
      demographicValues: response.demographicValues,
    });
  }

  return entries;
}

function combinedReasonBlockTitle(question: Question): string {
  const label = defaultReasonLabel(question);

  if (question.type === "score") {
    const config = question.config as ScoreQuestionConfig;
    return `${config.category} · ${config.combination} — ${label}`;
  }

  const title = question.title.trim();
  const genericTitles = ["객관식 문항", "순위 문항", "주관식 문항"];
  const displayTitle =
    title && !genericTitles.includes(title) ? title : label.replace(" 이유", "");

  return `${displayTitle} — ${label}`;
}

export function buildCombinedReasonBlock(
  question: Question,
  responses: Response[],
  answers: Answer[]
): CombinedReasonBlockStats | null {
  const entries = buildCombinedReasonEntries(question, responses, answers);
  if (entries.length === 0) return null;

  return {
    title: combinedReasonBlockTitle(question),
    entries,
  };
}

export function buildCombinedReasonBlocks(
  questions: Question[],
  responses: Response[],
  answers: Answer[]
): CombinedReasonBlockStats[] {
  return questions
    .map((question) => buildCombinedReasonBlock(question, responses, answers))
    .filter((block): block is CombinedReasonBlockStats => block !== null);
}
