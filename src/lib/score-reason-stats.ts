import {
  buildComparisonSegments,
  segmentMatchesResponse,
} from "./choice-comparison-stats";
import {
  getReasonForQuestionResponse,
  getWinningCombinationForQuestionResponse,
} from "./score-reason-utils";
import { questionIncludesReason } from "./combined-reason-utils";
import type {
  Answer,
  ComparisonSegment,
  DemographicFieldConfig,
  Question,
  Response,
  ScoreReasonCategoryStats,
  ScoreCompareQuestionConfig,
  Section,
} from "./types";

function buildReasonBlocksForQuestion(
  question: Question,
  responses: Response[],
  answers: Answer[],
  segments: ComparisonSegment[]
): ScoreReasonCategoryStats["blocks"] {
  const config = question.config as ScoreCompareQuestionConfig;
  const blocks: ScoreReasonCategoryStats["blocks"] = [];

  for (const winningCombination of config.combinations) {
    const bySegment: Record<string, string[]> = {};
    for (const segment of segments) {
      bySegment[segment.key] = [];
    }

    for (const response of responses) {
      const winner = getWinningCombinationForQuestionResponse(
        question,
        response.id,
        answers
      );
      if (winner !== winningCombination) continue;

      const reason = getReasonForQuestionResponse(question, response.id, answers);
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

  return scoreReasonQuestions
    .filter(questionIncludesReason)
    .map((question) => {
    const config = question.config as ScoreCompareQuestionConfig;
    return {
      category: config.category,
      blocks: buildReasonBlocksForQuestion(
        question,
        responses,
        answers,
        segments
      ),
    };
  });
}
