import {
  getWinningCombinationForQuestionResponse,
  parseScoreReasonAnswer,
} from "./score-reason-utils";
import type {
  Answer,
  Question,
  ScoreQuestionConfig,
  ScoreCompareQuestionConfig,
  SurveyDetail,
} from "./types";

export const FINAL_DESIGN_CATEGORY = "최종 디자인";

export function isFinalDesignCategory(category: string): boolean {
  const trimmed = category.trim();
  return trimmed === FINAL_DESIGN_CATEGORY || trimmed.includes("최종 디자인");
}

function isFinalDesignQuestion(question: Question): boolean {
  if (question.type === "score") {
    return isFinalDesignCategory(
      (question.config as ScoreQuestionConfig).category
    );
  }

  if (question.type === "score-compare") {
    return isFinalDesignCategory(
      (question.config as ScoreCompareQuestionConfig).category
    );
  }

  return false;
}

export function findFinalDesignScoreQuestions(survey: SurveyDetail): Question[] {
  return survey.sections
    .flatMap((section) => section.questions)
    .filter(isFinalDesignQuestion)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getFinalDesignRank1Combinations(
  questions: Question[]
): string[] {
  const combinations: string[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    if (question.type === "score-compare") {
      const config = question.config as ScoreCompareQuestionConfig;
      for (const combination of config.combinations) {
        if (seen.has(combination)) continue;
        seen.add(combination);
        combinations.push(combination);
      }
      continue;
    }

    const combination = (question.config as ScoreQuestionConfig).combination;
    if (seen.has(combination)) continue;
    seen.add(combination);
    combinations.push(combination);
  }

  return combinations;
}

function getFinalDesignScoreForQuestionResponse(
  question: Question,
  responseId: string,
  answers: Answer[]
): { combination: string; score: number } | null {
  if (question.type === "score-compare") {
    const config = question.config as ScoreCompareQuestionConfig;
    const winningCombination = getWinningCombinationForQuestionResponse(
      question,
      responseId,
      answers
    );
    if (!winningCombination) return null;

    const answer = answers.find(
      (entry) =>
        entry.responseId === responseId && entry.questionId === question.id
    );
    const parsed = parseScoreReasonAnswer(
      answer?.value ?? "",
      config.combinations
    );
    const score = parsed?.scores[winningCombination];
    if (typeof score !== "number") return null;

    return { combination: winningCombination, score };
  }

  const config = question.config as ScoreQuestionConfig;
  const answer = answers.find(
    (entry) =>
      entry.responseId === responseId && entry.questionId === question.id
  );
  if (!answer) return null;

  const score = Number(answer.value);
  if (!Number.isFinite(score)) return null;

  return { combination: config.combination, score };
}

export function getFinalDesignRank1ForResponse(
  responseId: string,
  questions: Question[],
  answers: Answer[]
): string | null {
  if (questions.length === 0) return null;

  let bestCombination: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const question of questions) {
    const result = getFinalDesignScoreForQuestionResponse(
      question,
      responseId,
      answers
    );
    if (!result) continue;

    if (result.score > bestScore) {
      bestScore = result.score;
      bestCombination = result.combination;
    }
  }

  return bestCombination;
}
