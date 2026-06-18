import { segmentMatchesResponse } from "./choice-comparison-stats";
import { getPresentAgeGroups } from "./demographic-utils";
import {
  flattenScoreReasonQuestions,
  getReasonForQuestionResponse,
  getScoreReasonCombinationScore,
  getWinningCombinationForQuestionResponse,
  parseScoreReasonItemKey,
  scoreFromAnswerValue,
} from "./score-reason-utils";
import { questionIncludesReason } from "./combined-reason-utils";
import type {
  Answer,
  AgeGroup,
  ComparisonSegment,
  DemographicFieldConfig,
  Question,
  Response,
  ScoreCompareItemStats,
  ScoreCompareReasonEntry,
  ScoreCompareScoreStats,
  ScoreCompareSectionStats,
  ScoreReasonBlockStats,
  ScoreReasonCategoryStats,
  Section,
} from "./types";
import { AGE_GROUP_LABELS } from "./types";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function scoreForCompareItem(
  answers: Answer[],
  responseId: string,
  itemId: string,
  combinations: string[] = []
): number | null {
  const parsedKey = parseScoreReasonItemKey(itemId);
  if (parsedKey) {
    return getScoreReasonCombinationScore(
      answers,
      responseId,
      parsedKey.questionId,
      parsedKey.combination,
      combinations
    );
  }

  const answer = answers.find(
    (entry) => entry.responseId === responseId && entry.questionId === itemId
  );
  if (!answer) return null;
  return scoreFromAnswerValue(answer.value, combinations);
}

export function buildScoreCompareDashboardSegments(
  demographicFields: DemographicFieldConfig[],
  responses: Response[]
): ComparisonSegment[] {
  const segments: ComparisonSegment[] = [
    { type: "total", key: "total", groupLabel: "전체", label: "평균" },
  ];

  for (const field of demographicFields.slice(0, 2)) {
    for (const option of field.options) {
      segments.push({
        type: "custom",
        key: `custom-${field.id}-${option}`,
        groupLabel: field.label,
        label: option,
        fieldId: field.id,
        option,
      });
    }
  }

  segments.push(
    {
      type: "gender",
      key: "gender-male",
      groupLabel: "성별",
      label: "남",
      gender: "male",
    },
    {
      type: "gender",
      key: "gender-female",
      groupLabel: "성별",
      label: "여",
      gender: "female",
    }
  );

  for (const ageGroup of getPresentAgeGroups(responses)) {
    segments.push({
      type: "age",
      key: `age-${ageGroup}`,
      groupLabel: "연령대",
      label: AGE_GROUP_LABELS[ageGroup],
      ageGroup,
    });
  }

  return segments;
}

function buildScoreCompareItems(
  scoreCompareQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  segments: ComparisonSegment[]
): ScoreCompareItemStats[] {
  const scoreItems = scoreCompareQuestions.flatMap((question) =>
    flattenScoreReasonQuestions([question])
  );

  return scoreItems.map((item) => ({
    itemId: item.id,
    category: item.category,
    combination: item.combination,
    bySegment: Object.fromEntries(
      segments.map((segment) => {
        const filtered = responses.filter((response) =>
          segmentMatchesResponse(response, segment)
        );
        const scores = filtered
          .map((response) =>
            scoreForCompareItem(
              answers,
              response.id,
              item.id,
              item.combinations
            )
          )
          .filter((score): score is number => score !== null);
        return [segment.key, average(scores)];
      })
    ),
  }));
}

export function buildScoreCompareScoreStats(
  scoreCompareQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  demographicFields: DemographicFieldConfig[]
): ScoreCompareScoreStats {
  const segments = buildScoreCompareDashboardSegments(
    demographicFields,
    responses
  );

  return {
    segments,
    items: buildScoreCompareItems(
      scoreCompareQuestions,
      responses,
      answers,
      segments
    ),
  };
}

function buildReasonBlocksForQuestion(
  question: Question,
  responses: Response[],
  answers: Answer[]
): ScoreReasonBlockStats[] {
  const blocks: ScoreReasonBlockStats[] = [];
  const combinations =
    question.type === "score-compare"
      ? (question.config as { combinations: string[] }).combinations
      : [];

  for (const winningCombination of combinations) {
    const entries: ScoreCompareReasonEntry[] = [];

    for (const response of responses) {
      const winner = getWinningCombinationForQuestionResponse(
        question,
        response.id,
        answers
      );
      if (winner !== winningCombination) continue;

      const reason = getReasonForQuestionResponse(question, response.id, answers);
      if (!reason) continue;

      entries.push({
        reason,
        gender: response.gender,
        ageGroup: response.ageGroup,
        demographicValues: response.demographicValues,
      });
    }

    if (entries.length === 0) continue;

    blocks.push({
      winningCombination,
      entries,
    });
  }

  return blocks;
}

export function buildScoreCompareReasonCategories(
  scoreCompareQuestions: Question[],
  responses: Response[],
  answers: Answer[]
): ScoreReasonCategoryStats[] {
  return scoreCompareQuestions
    .filter(questionIncludesReason)
    .map((question) => {
      const config = question.config as { category: string };
      return {
        category: config.category,
        blocks: buildReasonBlocksForQuestion(question, responses, answers),
      };
    });
}

export function buildScoreCompareSectionStats(
  section: Section,
  scoreCompareQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  demographicFields: DemographicFieldConfig[],
  ageGroups: AgeGroup[]
): ScoreCompareSectionStats {
  return {
    sectionId: section.id,
    sectionTitle: section.title,
    scoreStats: buildScoreCompareScoreStats(
      scoreCompareQuestions,
      responses,
      answers,
      demographicFields
    ),
    reasonCategories: buildScoreCompareReasonCategories(
      scoreCompareQuestions,
      responses,
      answers
    ),
    demographicFields: demographicFields.slice(0, 2),
    ageGroups,
  };
}
