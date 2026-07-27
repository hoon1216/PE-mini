import { normalizeCombinedReasonFields } from "./combined-reason-utils";
import type {
  Question,
  QuestionConfig,
  QuestionType,
  RankingQuestionConfig,
  ScoreQuestionConfig,
  ScoreCompareQuestionConfig,
  AttributeEvalQuestionConfig,
  TextQuestionConfig,
  ChoiceQuestionConfig,
} from "./types";
import {
  configForQuestionType,
  createDefaultQuestion,
  defaultQuestionTitle,
  defaultChoiceQuestionConfig,
  defaultRankingQuestionConfig,
  defaultScoreQuestionConfig,
  defaultScoreCompareQuestionConfig,
  defaultAttributeEvalQuestionConfig,
  defaultTextQuestionConfig,
} from "./types";

type LegacyScoreSectionConfig = { items?: { id: string; category: string; combination: string }[] };
type LegacyRankingSectionConfig = { combinations?: string[] };
type LegacySection = {
  id: string;
  sectionType?: string;
  config?: LegacyScoreSectionConfig | LegacyRankingSectionConfig;
};

const LEGACY_QUESTION_TYPES = new Set(["score-reason"]);

export function normalizeQuestionType(type: string): QuestionType {
  if (LEGACY_QUESTION_TYPES.has(type)) return "score-compare";
  if (
    type === "choice" ||
    type === "score" ||
    type === "ranking" ||
    type === "score-compare" ||
    type === "attribute-eval" ||
    type === "text"
  ) {
    return type;
  }
  return "score";
}

export function isLegacyQuestionType(type: string): boolean {
  return LEGACY_QUESTION_TYPES.has(type);
}

export function normalizeQuestionConfig(
  type: QuestionType,
  config: unknown
): QuestionConfig {
  if (type === "text") {
    const raw = (config ?? {}) as Partial<TextQuestionConfig>;
    const defaults = defaultTextQuestionConfig();
    return {
      placeholder: raw.placeholder ?? defaults.placeholder,
      maxLength: raw.maxLength ?? defaults.maxLength,
      rankGroup: raw.rankGroup,
    };
  }

  if (type === "choice") {
    const raw = (config ?? {}) as Partial<ChoiceQuestionConfig>;
    const defaults = defaultChoiceQuestionConfig();
    const options = raw.options?.length ? raw.options : defaults.options;
    const selectionMode =
      raw.selectionMode ??
      ((raw.selectCount ?? 1) > 1 ? "multiple" : defaults.selectionMode ?? "single");
    return {
      options,
      selectionMode,
      category: raw.category,
      ...normalizeCombinedReasonFields(raw),
    };
  }

  if (type === "score") {
    const raw = (config ?? {}) as Partial<ScoreQuestionConfig> & LegacyScoreSectionConfig;
    if (raw.items?.length) {
      const first = raw.items[0];
      return {
        category: first.category,
        combination: first.combination,
        ...normalizeCombinedReasonFields(raw),
      };
    }
    return {
      category: raw.category ?? defaultScoreQuestionConfig().category,
      combination: raw.combination ?? defaultScoreQuestionConfig().combination,
      ...normalizeCombinedReasonFields(raw),
    };
  }

  if (type === "score-compare") {
    const raw = (config ?? {}) as Partial<ScoreCompareQuestionConfig> & {
      combination?: string;
      placeholder?: string;
      maxLength?: number;
    };
    const defaults = defaultScoreCompareQuestionConfig();
    const combinations = raw.combinations?.length
      ? raw.combinations
      : raw.combination
        ? [raw.combination]
        : defaults.combinations;

    const reasonFields = normalizeCombinedReasonFields({
      includeReason:
        raw.includeReason ??
        (raw.placeholder !== undefined || raw.maxLength !== undefined
          ? true
          : defaults.includeReason),
      reasonPlaceholder: raw.reasonPlaceholder ?? raw.placeholder,
      reasonMaxLength: raw.reasonMaxLength ?? raw.maxLength,
    });

    return {
      category: raw.category ?? defaults.category,
      combinations,
      ...reasonFields,
    };
  }

  if (type === "attribute-eval") {
    const raw = (config ?? {}) as Partial<AttributeEvalQuestionConfig>;
    const defaults = defaultAttributeEvalQuestionConfig();
    return {
      designConcept: raw.designConcept?.trim() || defaults.designConcept,
      attributes: raw.attributes?.length
        ? raw.attributes
        : defaults.attributes,
      ...normalizeCombinedReasonFields(raw),
    };
  }

  const raw = (config ?? {}) as Partial<RankingQuestionConfig>;
  return {
    combinations:
      raw.combinations?.length
        ? raw.combinations
        : defaultRankingQuestionConfig().combinations,
    ...normalizeCombinedReasonFields(raw),
  };
}

export function normalizeQuestion(question: Question): Question {
  const type = normalizeQuestionType(question.type as string);
  return {
    ...question,
    title: question.title || defaultQuestionTitle(type),
    description: question.description ?? null,
    type,
    config: normalizeQuestionConfig(type, question.config),
  };
}

export function migrateLegacyQuestions(
  section: LegacySection,
  questions: Question[]
): Question[] {
  if (questions.length > 0) {
    return questions.map(normalizeQuestion);
  }

  if (section.sectionType === "ranking" && section.config) {
    const config = section.config as LegacyRankingSectionConfig;
    return [
      normalizeQuestion({
        id: `ranking-${section.id}`,
        sectionId: section.id,
        title: "순위 문항",
        description: null,
        type: "ranking",
        config: {
          combinations: config.combinations ?? defaultRankingQuestionConfig().combinations,
        },
        sortOrder: 0,
      }),
    ];
  }

  if (section.sectionType === "score" && section.config) {
    const config = section.config as LegacyScoreSectionConfig;
    const items = config.items ?? [];
    if (items.length > 0) {
      return items.map((item, index) =>
        normalizeQuestion({
          id: item.id,
          sectionId: section.id,
          title: item.combination,
          description: null,
          type: "score",
          config: {
            category: item.category,
            combination: item.combination,
          },
          sortOrder: index,
        })
      );
    }
  }

  const defaults = createDefaultQuestion(0);
  return [
    normalizeQuestion({
      id: `question-${section.id}-0`,
      sectionId: section.id,
      ...defaults,
    }),
  ];
}

export function configForType(type: QuestionType): QuestionConfig {
  return configForQuestionType(type);
}

export function supportsCombinedReason(type: QuestionType): boolean {
  return type !== "text";
}
