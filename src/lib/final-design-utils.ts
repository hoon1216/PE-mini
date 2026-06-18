import type { Answer, Question, ScoreQuestionConfig, SurveyDetail } from "./types";

export const FINAL_DESIGN_CATEGORY = "최종 디자인";

export function isFinalDesignCategory(category: string): boolean {
  const trimmed = category.trim();
  return trimmed === FINAL_DESIGN_CATEGORY || trimmed.includes("최종 디자인");
}

export function findFinalDesignScoreQuestions(survey: SurveyDetail): Question[] {
  return survey.sections
    .flatMap((section) => section.questions)
    .filter(
      (question) =>
        question.type === "score" &&
        isFinalDesignCategory(
          (question.config as ScoreQuestionConfig).category
        )
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getFinalDesignRank1Combinations(
  questions: Question[]
): string[] {
  const combinations: string[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const combination = (question.config as ScoreQuestionConfig).combination;
    if (seen.has(combination)) continue;
    seen.add(combination);
    combinations.push(combination);
  }

  return combinations;
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
    const config = question.config as ScoreQuestionConfig;
    const answer = answers.find(
      (entry) =>
        entry.responseId === responseId && entry.questionId === question.id
    );
    if (!answer) continue;

    const score = Number(answer.value);
    if (!Number.isFinite(score)) continue;

    if (score > bestScore) {
      bestScore = score;
      bestCombination = config.combination;
    }
  }

  return bestCombination;
}
