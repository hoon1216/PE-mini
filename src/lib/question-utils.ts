import type {
  Question,
  QuestionConfig,
  QuestionType,
  RankingQuestionConfig,
  ScoreQuestionConfig,
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
  defaultTextQuestionConfig,
} from "./types";

type LegacyScoreSectionConfig = { items?: { id: string; category: string; combination: string }[] };
type LegacyRankingSectionConfig = { combinations?: string[] };
type LegacySection = {
  id: string;
  sectionType?: QuestionType;
  config?: LegacyScoreSectionConfig | LegacyRankingSectionConfig;
};

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
    const selectCount = Math.min(
      Math.max(1, Math.floor(raw.selectCount ?? defaults.selectCount ?? 1)),
      options.length
    );
    return { options, selectCount };
  }

  if (type === "score") {
    const raw = (config ?? {}) as Partial<ScoreQuestionConfig> & LegacyScoreSectionConfig;
    if (raw.items?.length) {
      const first = raw.items[0];
      return {
        category: first.category,
        combination: first.combination,
      };
    }
    return {
      category: raw.category ?? defaultScoreQuestionConfig().category,
      combination: raw.combination ?? defaultScoreQuestionConfig().combination,
    };
  }

  const raw = (config ?? {}) as Partial<RankingQuestionConfig>;
  return {
    combinations:
      raw.combinations?.length
        ? raw.combinations
        : defaultRankingQuestionConfig().combinations,
  };
}

export function normalizeQuestion(question: Question): Question {
  const type = (question.type as QuestionType) || "score";
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
