import { parseRankingAnswer } from "./demographic-utils";
import { normalizeRankingAnswer, type RankingAnswer } from "./ranking-utils";
import type { Question, QuestionConfig, QuestionType, TextQuestionConfig } from "./types";

export type GroupingQuestion = {
  type: QuestionType;
  sortOrder: number;
  config: QuestionConfig;
  id?: string;
  title?: string;
};

/** Section sort orders (0-based) that group text by preceding ranking rank1. */
export const RANK_GROUPED_TEXT_SECTION_SORT_ORDERS = [0, 1, 2];

export function isRankGroupedTextSection(section: {
  sortOrder: number;
}): boolean {
  return RANK_GROUPED_TEXT_SECTION_SORT_ORDERS.includes(section.sortOrder);
}

export function findPrecedingRankingQuestion(section: {
  questions: GroupingQuestion[];
}): GroupingQuestion | null {
  const sorted = [...section.questions].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const followUpQuestions = sorted.filter(
    (q) => q.type === "text" || q.type === "choice"
  );
  if (followUpQuestions.length === 0) return null;

  const firstFollowUpOrder = Math.min(
    ...followUpQuestions.map((q) => q.sortOrder)
  );
  const rankingBeforeFollowUp = sorted.filter(
    (q) => q.type === "ranking" && q.sortOrder < firstFollowUpOrder
  );

  return rankingBeforeFollowUp.length > 0
    ? rankingBeforeFollowUp[rankingBeforeFollowUp.length - 1]
    : null;
}

type SectionWithQuestions = { sortOrder: number; questions: GroupingQuestion[] };

export function getRank1ForSection(
  section: SectionWithQuestions,
  rankings: Record<string, RankingAnswer>
): string {
  const rankingQuestion = findPrecedingRankingQuestion(section);
  if (!rankingQuestion?.id) return "";

  const ranking = normalizeRankingAnswer(rankings[rankingQuestion.id]);
  return ranking.rank1 ?? "";
}

export function getRank1FromAnswerMap(
  section: SectionWithQuestions,
  answersByQuestionId: Map<string, string>
): string {
  const rankingQuestion = findPrecedingRankingQuestion(section);
  if (!rankingQuestion?.id) return "";

  const parsed = parseRankingAnswer(
    answersByQuestionId.get(rankingQuestion.id) ?? ""
  );
  return parsed?.rank1 ?? "";
}

export function textQuestionAppliesToRankGroup(
  question: GroupingQuestion,
  rankGroup: string
): boolean {
  if (question.type !== "text") return false;
  const config = question.config as TextQuestionConfig;
  if (!config.rankGroup) return true;
  return config.rankGroup === rankGroup;
}

export function shouldShowTextQuestion(
  question: GroupingQuestion,
  section: SectionWithQuestions,
  rank1: string
): boolean {
  if (question.type !== "text") return false;
  if (!isRankGroupedTextSection(section)) return true;

  const precedingRanking = findPrecedingRankingQuestion(section);
  if (!precedingRanking) return true;
  if (!rank1) return false;

  return textQuestionAppliesToRankGroup(question, rank1);
}

export function isTextQuestionRequired(
  question: GroupingQuestion,
  section: SectionWithQuestions,
  rank1: string
): boolean {
  if (question.type !== "text") return false;
  if (!isRankGroupedTextSection(section)) return true;

  const precedingRanking = findPrecedingRankingQuestion(section);
  if (!precedingRanking) return true;

  return shouldShowTextQuestion(question, section, rank1);
}

export function getRequiredQuestionsForSurvey(
  survey: { sections: (SectionWithQuestions & { questions: Question[] })[] },
  answersByQuestionId?: Map<string, string>
): Question[] {
  const required: Question[] = [];

  for (const section of survey.sections) {
    const rank1 = answersByQuestionId
      ? getRank1FromAnswerMap(section, answersByQuestionId)
      : "";

    for (const question of section.questions) {
      if (
        question.type === "score" ||
        question.type === "ranking" ||
        question.type === "choice"
      ) {
        required.push(question);
      } else if (
        question.type === "text" &&
        isTextQuestionRequired(question, section, rank1)
      ) {
        required.push(question);
      }
    }
  }

  return required;
}
