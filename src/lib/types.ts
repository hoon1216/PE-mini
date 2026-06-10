export type QuestionType = "score" | "ranking";
export type Gender = "male" | "female";
export type AgeGroup = "10s" | "20s" | "30s" | "40s" | "50s" | "60s";

export interface ScoreQuestionConfig {
  category: string;
  combination: string;
}

export interface RankingQuestionConfig {
  combinations: string[];
}

export type QuestionConfig = ScoreQuestionConfig | RankingQuestionConfig;

export interface Survey {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  surveyId: string;
  title: string;
  description: string | null;
  sortOrder: number;
}

export interface Question {
  id: string;
  sectionId: string;
  title: string;
  description: string | null;
  type: QuestionType;
  config: QuestionConfig;
  sortOrder: number;
}

export interface SurveyDetail extends Survey {
  sections: (Section & { questions: Question[] })[];
}

export interface Response {
  id: string;
  surveyId: string;
  submittedAt: string;
  participantName: string | null;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
}

export interface Answer {
  id: string;
  responseId: string;
  questionId: string;
  value: string;
}

export interface DemographicStats {
  total: number;
  male: number;
  female: number;
  ageGroups: AgeGroup[];
  byAgeGroup: Partial<Record<AgeGroup, number>>;
}

export interface DemographicCell {
  score: number | null;
  rank: number | null;
}

export interface ScoreItemStats {
  itemId: string;
  category: string;
  combination: string;
  averageScore: number | null;
  averageRank: number | null;
  byDemographic: Record<string, DemographicCell>;
}

export interface ScoreSectionStats {
  sectionId: string;
  sectionTitle: string;
  ageGroups: AgeGroup[];
  items: ScoreItemStats[];
}

export interface RankingCombinationStats {
  combination: string;
  rank1Count: number;
  rank1Percent: number;
  rank2Count: number;
  rank3Count: number;
  rank12Count: number;
  rank12Percent: number;
  rank123Count: number;
  rank123Percent: number;
  byDemographic: Record<string, { count: number; percent: number }>;
}

export interface RankingSectionStats {
  sectionId: string;
  sectionTitle: string;
  questionTitle: string;
  questionId: string;
  ageGroups: AgeGroup[];
  combinations: RankingCombinationStats[];
}

export type DashboardSectionTable =
  | { type: "score"; data: ScoreSectionStats }
  | { type: "ranking"; data: RankingSectionStats };

export interface DashboardSectionGroup {
  sectionId: string;
  sectionTitle: string;
  sortOrder: number;
  tables: DashboardSectionTable[];
}

export interface DashboardStats {
  totalResponses: number;
  demographics: DemographicStats;
  sectionGroups: DashboardSectionGroup[];
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
}

export interface UpdateSurveyContentInput {
  title?: string;
  description?: string;
  sections: {
    id?: string;
    title: string;
    description?: string;
    sortOrder: number;
    questions: {
      id?: string;
      title?: string;
      description?: string;
      type: QuestionType;
      config: QuestionConfig;
      sortOrder: number;
    }[];
  }[];
}

export interface SubmitResponseInput {
  participantName: string;
  gender: Gender;
  ageGroup: AgeGroup;
  answers: { questionId: string; value: string }[];
}

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60s": "60대",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "남",
  female: "여",
};

export function defaultScoreQuestionConfig(): ScoreQuestionConfig {
  return { category: "구분", combination: "조합 A" };
}

export function defaultRankingQuestionConfig(): RankingQuestionConfig {
  return { combinations: ["조합 A", "조합 B", "조합 C"] };
}

export function configForQuestionType(type: QuestionType): QuestionConfig {
  return type === "ranking"
    ? defaultRankingQuestionConfig()
    : defaultScoreQuestionConfig();
}

export function createDefaultQuestion(
  sortOrder: number,
  type: QuestionType = "score"
): Omit<Question, "id" | "sectionId"> {
  return {
    title: type === "score" ? "점수 문항" : "순위 문항",
    description: null,
    type,
    config: configForQuestionType(type),
    sortOrder,
  };
}
