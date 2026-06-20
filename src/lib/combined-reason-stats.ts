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
  CombinedReasonSectionStats,
  DemographicFieldConfig,
  Question,
  Response,
  ScoreQuestionConfig,
  Section,
  TextReasonEntry,
  AgeGroup,
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

function combinedReasonDisplayTitles(question: Question): {
  tableLabel: string;
  viewerTitle: string;
} {
  if (question.type === "choice") {
    const title = question.title.trim();
    const genericTitles = ["객관식 문항", "안 선택 문항"];
    if (title && !genericTitles.includes(title)) {
      const label = title.includes("이유")
        ? title
        : `${title} — ${defaultReasonLabel(question)}`;
      return { tableLabel: label, viewerTitle: label };
    }
    return { tableLabel: "이유 기술 문항", viewerTitle: "이유 기술 문항" };
  }

  const label = defaultReasonLabel(question);

  if (question.type === "score") {
    const config = question.config as ScoreQuestionConfig;
    const viewerTitle = `${config.category} · ${config.combination} — ${label}`;
    return { tableLabel: viewerTitle, viewerTitle };
  }

  const title = question.title.trim();
  const genericTitles = ["순위 문항", "주관식 문항"];
  const displayTitle =
    title && !genericTitles.includes(title) ? title : label.replace(" 이유", "");

  const viewerTitle = `${displayTitle} — ${label}`;
  return { tableLabel: viewerTitle, viewerTitle };
}

function combinedReasonBlockTitle(question: Question): string {
  return combinedReasonDisplayTitles(question).viewerTitle;
}

export function questionsForChoiceComparisonCombinedReasons(
  questions: Question[]
): Question[] {
  return questions.filter(
    (question) =>
      question.type === "choice" && questionIncludesReason(question)
  );
}

export function buildCombinedReasonSectionStats(
  section: Section,
  question: Question,
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  demographicFields: DemographicFieldConfig[]
): CombinedReasonSectionStats | null {
  const entries = buildCombinedReasonEntries(question, responses, answers);
  if (entries.length === 0) return null;

  const { tableLabel, viewerTitle } = combinedReasonDisplayTitles(question);

  return {
    sectionId: section.id,
    questionId: question.id,
    tableLabel,
    viewerTitle,
    entries,
    demographicFields,
    ageGroups,
  };
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

export function buildCombinedReasonSections(
  section: Section,
  questions: Question[],
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  demographicFields: DemographicFieldConfig[]
): CombinedReasonSectionStats[] {
  return questions
    .map((question) =>
      buildCombinedReasonSectionStats(
        section,
        question,
        responses,
        answers,
        ageGroups,
        demographicFields
      )
    )
    .filter(
      (entry): entry is CombinedReasonSectionStats => entry !== null
    );
}
