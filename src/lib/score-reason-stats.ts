import {
  buildComparisonSegments,
  segmentMatchesResponse,
} from "./choice-comparison-stats";
import {
  getReasonForWinningCombination,
  getWinningCombinationForResponse,
  groupScoreReasonQuestionsByCategory,
} from "./score-reason-utils";
import type {
  Answer,
  ComparisonSegment,
  DemographicFieldConfig,
  Question,
  Response,
  ScoreReasonCategoryStats,
  Section,
} from "./types";

function buildReasonBlocksForCategory(
  categoryQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  segments: ComparisonSegment[]
): ScoreReasonCategoryStats["blocks"] {
  const combinations = [
    ...new Set(
      categoryQuestions.map(
        (question) =>
          (question.config as { combination: string }).combination
      )
    ),
  ];

  const blocks: ScoreReasonCategoryStats["blocks"] = [];

  for (const winningCombination of combinations) {
    const bySegment: Record<string, string[]> = {};
    for (const segment of segments) {
      bySegment[segment.key] = [];
    }

    for (const response of responses) {
      const winner = getWinningCombinationForResponse(
        categoryQuestions,
        response.id,
        answers
      );
      if (winner !== winningCombination) continue;

      const reason = getReasonForWinningCombination(
        categoryQuestions,
        response.id,
        winningCombination,
        answers
      );
      if (!reason) continue;

      for (const segment of segments) {
        if (!segmentMatchesResponse(response, segment)) continue;
        bySegment[segment.key].push(reason);
      }
    }

    const hasResponses = Object.values(bySegment).some(
      (values) => values.length > 0
    );
    if (!hasResponses) continue;

    blocks.push({
      winningCombination,
      segments,
      bySegment,
    });
  }

  return blocks;
}

export function buildScoreReasonCategories(
  section: Section,
  scoreReasonQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  demographicFields: DemographicFieldConfig[]
): ScoreReasonCategoryStats[] {
  const segments = buildComparisonSegments(demographicFields, responses);
  const grouped = groupScoreReasonQuestionsByCategory(scoreReasonQuestions);

  return [...grouped.entries()].map(([category, questions]) => ({
    category,
    blocks: buildReasonBlocksForCategory(
      questions,
      responses,
      answers,
      segments
    ),
  }));
}
