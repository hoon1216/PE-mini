export type QuestionType = "score" | "ranking" | "text" | "choice";
export type Gender = "male" | "female";
export type AgeGroup = "10s" | "20s" | "30s" | "40s" | "50s" | "60s";

export interface DemographicFieldConfig {
  id: string;
  label: string;
  options: string[];
}

export interface ScoreQuestionConfig {
  category: string;
  combination: string;
}

export interface RankingQuestionConfig {
  combinations: string[];
}

export interface TextQuestionConfig {
  placeholder?: string;
  maxLength?: number;
  /** Matches a combination from the preceding ranking question (블랙·그레이·순위 섹션). */
  rankGroup?: string;
}

export type ChoiceSelectionMode = "single" | "multiple";

export interface ChoiceQuestionConfig {
  options: string[];
  /** single = 1개 선택, multiple = 복수 선택 */
  selectionMode?: ChoiceSelectionMode;
  /** @deprecated use selectionMode — kept for legacy data */
  selectCount?: number;
}

export type QuestionConfig =
  | ScoreQuestionConfig
  | RankingQuestionConfig
  | TextQuestionConfig
  | ChoiceQuestionConfig;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  score: "점수 부과형",
  ranking: "순위 선정형",
  text: "주관식",
  choice: "객관식",
};

export const SCORE_MIN = 1;
export const SCORE_MAX = 7;
export const SCORE_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export const DEFAULT_SCORE_VALUE = 4;

export function isValidScoreValue(value: string): boolean {
  const score = Number(value);
  return (
    Number.isInteger(score) && score >= SCORE_MIN && score <= SCORE_MAX
  );
}

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
  demographicFields: DemographicFieldConfig[];
  sections: (Section & { questions: Question[] })[];
}

export interface Response {
  id: string;
  surveyId: string;
  submittedAt: string;
  participantName: string | null;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
  demographicValues: Record<string, string>;
}

export interface Answer {
  id: string;
  responseId: string;
  questionId: string;
  value: string;
}

export interface DemographicFieldStats {
  fieldId: string;
  label: string;
  options: string[];
  byOption: Record<string, number>;
}

export interface DemographicStats {
  total: number;
  male: number;
  female: number;
  ageGroups: AgeGroup[];
  byAgeGroup: Partial<Record<AgeGroup, number>>;
  customFields: DemographicFieldStats[];
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

export interface TextResponseEntry {
  responseId: string;
  participantName: string | null;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
  submittedAt: string;
  value: string;
}

export interface TextGroupItemStats {
  questionId: string;
  questionTitle: string;
  responses: TextResponseEntry[];
}

export interface TextGroupStats {
  groupName: string;
  items: TextGroupItemStats[];
}

export interface TextSectionStats {
  sectionId: string;
  sectionTitle: string;
  rankingQuestionTitle: string | null;
  groupedByRank1: boolean;
  groups: TextGroupStats[];
}

export interface ChoiceOptionStats {
  option: string;
  count: number;
  percent: number;
}

export interface ChoiceGroupStats {
  groupName: string;
  options: ChoiceOptionStats[];
}

export interface ChoiceSectionStats {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  questionTitle: string;
  groupedByRank1: boolean;
  rankingQuestionTitle: string | null;
  groups: ChoiceGroupStats[];
}

export type DashboardSectionTable =
  | { type: "score"; data: ScoreSectionStats }
  | { type: "ranking"; data: RankingSectionStats }
  | { type: "text"; data: TextSectionStats }
  | { type: "choice"; data: ChoiceSectionStats };

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
  demographicFields?: DemographicFieldConfig[];
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
  demographicValues?: Record<string, string>;
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

export function defaultTextQuestionConfig(): TextQuestionConfig {
  return { placeholder: "답변을 입력해주세요", maxLength: 500 };
}

export function defaultChoiceQuestionConfig(): ChoiceQuestionConfig {
  return {
    options: ["선택지 A", "선택지 B", "선택지 C"],
    selectionMode: "single",
  };
}

export function configForQuestionType(type: QuestionType): QuestionConfig {
  if (type === "ranking") return defaultRankingQuestionConfig();
  if (type === "text") return defaultTextQuestionConfig();
  if (type === "choice") return defaultChoiceQuestionConfig();
  return defaultScoreQuestionConfig();
}

export function defaultQuestionTitle(type: QuestionType): string {
  if (type === "ranking") return "순위 문항";
  if (type === "text") return "주관식 문항";
  if (type === "choice") return "객관식 문항";
  return "점수 문항";
}

export function createDefaultQuestion(
  sortOrder: number,
  type: QuestionType = "score"
): Omit<Question, "id" | "sectionId"> {
  return {
    title: defaultQuestionTitle(type),
    description: null,
    type,
    config: configForQuestionType(type),
    sortOrder,
  };
}
