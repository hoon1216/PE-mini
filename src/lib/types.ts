export type QuestionType =
  | "choice"
  | "score"
  | "ranking"
  | "score-compare"
  | "attribute-eval"
  | "text";

export interface CombinedReasonFields {
  /** 결합된 이유 기술형(6번) 입력 여부 */
  includeReason?: boolean;
  reasonPlaceholder?: string;
  reasonMaxLength?: number;
}
export type Gender = "male" | "female";
export type AgeGroup = "10s" | "20s" | "30s" | "40s" | "50s" | "60s";

export interface DemographicFieldConfig {
  id: string;
  label: string;
  options: string[];
}

export interface ScoreQuestionConfig extends CombinedReasonFields {
  category: string;
  combination: string;
}

export interface ScoreCompareQuestionConfig extends CombinedReasonFields {
  category: string;
  combinations: string[];
}

export interface AttributeEvalQuestionConfig extends CombinedReasonFields {
  /** 디자인 안 / 디자인 컨셉명 */
  designConcept: string;
  /** 7점 척도로 평가할 속성 목록 */
  attributes: string[];
}

export interface RankingQuestionConfig extends CombinedReasonFields {
  combinations: string[];
}

export interface TextQuestionConfig {
  placeholder?: string;
  maxLength?: number;
  /** Matches a combination from the preceding ranking question (블랙·그레이·순위 섹션). */
  rankGroup?: string;
}

export type ChoiceSelectionMode = "single" | "multiple";

export interface ChoiceQuestionConfig extends CombinedReasonFields {
  options: string[];
  /** Dashboard row grouping (e.g. 요소). Empty or "없음" merges item column only. */
  category?: string;
  /** single = 1개 선택, multiple = 복수 선택 */
  selectionMode?: ChoiceSelectionMode;
  /** @deprecated use selectionMode — kept for legacy data */
  selectCount?: number;
}

export type QuestionConfig =
  | ScoreQuestionConfig
  | ScoreCompareQuestionConfig
  | AttributeEvalQuestionConfig
  | RankingQuestionConfig
  | TextQuestionConfig
  | ChoiceQuestionConfig;

export const QUESTION_TYPE_ORDER: QuestionType[] = [
  "choice",
  "score",
  "ranking",
  "score-compare",
  "attribute-eval",
  "text",
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: "1. 안 선택형",
  score: "2. 안별 점수부과형",
  ranking: "3. 순위 선정형",
  "score-compare": "4. 안 점수 비교형",
  "attribute-eval": "5. 속성 평가형",
  text: "6. 이유 기술형",
};

export const SCORE_MIN = 1;
export const SCORE_MAX = 7;
export const SCORE_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export const DEFAULT_SCORE_VALUE = 4;

export const SCORE_LABELS: Record<(typeof SCORE_VALUES)[number], string> = {
  7: "매우 선호",
  6: "선호",
  5: "약간 선호",
  4: "보통",
  3: "약간 비선호",
  2: "비선호",
  1: "매우 비선호",
};

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
  byCustomField: Record<string, DemographicCell>;
}

export interface ScoreCustomFieldStats {
  fieldId: string;
  label: string;
  options: string[];
}

export interface ScoreSectionStats {
  sectionId: string;
  sectionTitle: string;
  ageGroups: AgeGroup[];
  customField: ScoreCustomFieldStats | null;
  items: ScoreItemStats[];
  demographicFields: DemographicFieldConfig[];
  combinedReasonBlocks: CombinedReasonBlockStats[];
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
  demographicFields: DemographicFieldConfig[];
  combinedReasonBlocks: CombinedReasonBlockStats[];
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

export interface TextReasonEntry {
  reason: string;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
  demographicValues: Record<string, string>;
}

export interface CombinedReasonBlockStats {
  title: string;
  entries: TextReasonEntry[];
}

export interface CombinedReasonSectionStats {
  sectionId: string;
  questionId: string;
  tableLabel: string;
  viewerTitle: string;
  entries: TextReasonEntry[];
  answerGroups?: Array<{ label: string; entries: TextReasonEntry[] }>;
  optionLabel?: string;
  demographicFields: DemographicFieldConfig[];
  ageGroups: AgeGroup[];
}

export interface TextDemographicItemStats {
  questionId: string;
  questionTitle: string;
  byRank1Demographic: Record<string, Record<string, string[]>>;
  entriesByRank1: Record<string, TextReasonEntry[]>;
}

export interface TextSectionStats {
  sectionId: string;
  sectionTitle: string;
  rankingQuestionTitle: string | null;
  groupedByRank1: boolean;
  groupedByFinalDesignRank1: boolean;
  ageGroups: AgeGroup[];
  rank1Names: string[];
  demographicFields: DemographicFieldConfig[];
  demographicItems: TextDemographicItemStats[];
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
  dashboardStats: ChoiceDashboardStats | null;
  ageGroups: AgeGroup[];
  demographicFields: DemographicFieldConfig[];
}

export interface ChoiceSegmentCell {
  count: number;
  percent: number;
}

export interface ChoiceDashboardItemStats {
  itemId: string;
  category: string | null;
  itemLabel: string;
  option: string;
  bySegment: Record<string, ChoiceSegmentCell | null>;
}

export interface ChoiceDashboardStats {
  segments: ComparisonSegment[];
  items: ChoiceDashboardItemStats[];
  showCategoryColumn: boolean;
}

export type ComparisonSegment =
  | { type: "total"; key: string; groupLabel: string; label: string }
  | {
      type: "custom";
      key: string;
      groupLabel: string;
      label: string;
      fieldId: string;
      option: string;
    }
  | {
      type: "gender";
      key: string;
      groupLabel: string;
      label: string;
      gender: Gender;
    }
  | {
      type: "age";
      key: string;
      groupLabel: string;
      label: string;
      ageGroup: AgeGroup;
    };

export interface ChoiceComparisonCell {
  count: number;
  answered: number;
  percent: number;
}

export interface ChoiceComparisonRowStats {
  questionId: string;
  itemLabel: string;
  category: string | null;
  cells: Record<string, ChoiceComparisonCell>;
}

export interface ChoiceComparisonRankBlock {
  rank1Name: string;
  segments: ComparisonSegment[];
  rows: ChoiceComparisonRowStats[];
}

export interface ChoiceComparisonReasonGroup {
  rank1Name: string;
  responses: string[];
}

export interface ChoiceComparisonReasonDemographic {
  ageGroups: AgeGroup[];
  rank1Names: string[];
  byRank1Demographic: Record<string, Record<string, string[]>>;
  entriesByRank1: Record<string, TextReasonEntry[]>;
}

export interface ChoiceComparisonSectionStats {
  sectionId: string;
  sectionTitle: string;
  comparisonMode: "rank1" | "option";
  rankingQuestionTitle: string;
  rankBlocks: ChoiceComparisonRankBlock[];
  reasonTitle: string;
  reasonDemographic: ChoiceComparisonReasonDemographic;
  reasonGroups: ChoiceComparisonReasonGroup[];
  demographicFields: DemographicFieldConfig[];
  ageGroups: AgeGroup[];
  combinedReasonSections: CombinedReasonSectionStats[];
}

export interface ScoreCompareItemStats {
  itemId: string;
  category: string;
  combination: string;
  bySegment: Record<string, number | null>;
}

export interface ScoreCompareScoreStats {
  segments: ComparisonSegment[];
  items: ScoreCompareItemStats[];
}

export interface ScoreCompareReasonEntry {
  reason: string;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
  demographicValues: Record<string, string>;
}

export interface ScoreReasonBlockStats {
  winningCombination: string;
  entries: ScoreCompareReasonEntry[];
}

export interface ScoreReasonCategoryStats {
  category: string;
  blocks: ScoreReasonBlockStats[];
}

export interface ScoreCompareSectionStats {
  sectionId: string;
  sectionTitle: string;
  scoreStats: ScoreCompareScoreStats;
  reasonCategories: ScoreReasonCategoryStats[];
  demographicFields: DemographicFieldConfig[];
  ageGroups: AgeGroup[];
}

export type DashboardSectionTable =
  | { type: "score"; data: ScoreSectionStats }
  | { type: "score-compare"; data: ScoreCompareSectionStats }
  | { type: "attribute-eval"; data: ScoreSectionStats }
  | { type: "ranking"; data: RankingSectionStats }
  | { type: "text"; data: TextSectionStats }
  | { type: "choice"; data: ChoiceSectionStats }
  | { type: "combined-reason"; data: CombinedReasonSectionStats }
  | { type: "choice-comparison"; data: ChoiceComparisonSectionStats };

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

export function defaultScoreCompareQuestionConfig(): ScoreCompareQuestionConfig {
  return {
    category: "구분",
    combinations: ["디자인안 A", "디자인안 B"],
    includeReason: false,
    reasonPlaceholder: "가장 높은 점수를 준 안에 대한 이유를 입력해주세요",
    reasonMaxLength: 500,
  };
}

export function defaultAttributeEvalQuestionConfig(): AttributeEvalQuestionConfig {
  return {
    designConcept: "디자인 컨셉",
    attributes: ["속성 1", "속성 2", "속성 3"],
    includeReason: false,
    reasonPlaceholder: "속성 평가 이유를 입력해주세요",
    reasonMaxLength: 500,
  };
}

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
  if (type === "score-compare") return defaultScoreCompareQuestionConfig();
  if (type === "attribute-eval") return defaultAttributeEvalQuestionConfig();
  return defaultScoreQuestionConfig();
}

export function defaultQuestionTitle(type: QuestionType): string {
  if (type === "ranking") return "순위 문항";
  if (type === "text") return "이유 기술 문항";
  if (type === "choice") return "안 선택 문항";
  if (type === "score-compare") return "안 점수 비교 문항";
  if (type === "attribute-eval") return "디자인 속성 평가 문항";
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
