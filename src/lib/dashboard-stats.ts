import type {
  AgeGroup,
  Answer,
  DashboardStats,
  DemographicCell,
  DemographicFieldConfig,
  DemographicStats,
  Gender,
  Question,
  RankingCombinationStats,
  RankingQuestionConfig,
  RankingSectionStats,
  Response,
  ScoreQuestionConfig,
  ScoreSectionStats,
  Section,
  SurveyDetail,
  TextSectionStats,
  ChoiceSectionStats,
  ChoiceGroupStats,
  ChoiceOptionStats,
  ChoiceQuestionConfig,
} from "./types";
import {
  parseChoiceAnswer,
} from "./choice-utils";
import {
  demographicKey,
  getPresentAgeGroups,
  parseRankingAnswer,
  scoreCustomFieldKey,
} from "./demographic-utils";
import {
  buildChoiceComparisonSectionStats,
} from "./choice-comparison-stats";
import { buildTextDemographicItems } from "./text-demographic-stats";
import {
  findPrecedingRankingQuestion,
  isRankGroupedTextSection,
  type GroupingQuestion,
} from "./text-grouping-utils";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function computeRanks(
  items: { id: string; scores: number[] }[]
): Map<string, number | null> {
  const avgs = items.map((item) => ({
    id: item.id,
    avg: average(item.scores),
  }));
  const valid = avgs
    .filter((item) => item.avg !== null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  const ranks = new Map<string, number | null>();
  let rank = 1;
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i].avg !== valid[i - 1].avg) rank = i + 1;
    ranks.set(valid[i].id, rank);
  }
  for (const item of avgs) {
    if (!ranks.has(item.id)) ranks.set(item.id, null);
  }
  return ranks;
}

function buildDemographics(
  responses: Response[],
  fields: DemographicFieldConfig[]
): DemographicStats {
  const byAgeGroup: Partial<Record<AgeGroup, number>> = {};
  let male = 0;
  let female = 0;

  for (const response of responses) {
    if (response.gender === "male") male += 1;
    if (response.gender === "female") female += 1;
    if (response.ageGroup) {
      byAgeGroup[response.ageGroup] = (byAgeGroup[response.ageGroup] ?? 0) + 1;
    }
  }

  const customFields = fields.map((field) => {
    const byOption: Record<string, number> = {};
    for (const option of field.options) {
      byOption[option] = 0;
    }

    for (const response of responses) {
      const selected = response.demographicValues[field.id];
      if (selected && field.options.includes(selected)) {
        byOption[selected] = (byOption[selected] ?? 0) + 1;
      }
    }

    return {
      fieldId: field.id,
      label: field.label,
      options: field.options,
      byOption,
    };
  });

  return {
    total: responses.length,
    male,
    female,
    ageGroups: getPresentAgeGroups(responses),
    byAgeGroup,
    customFields,
  };
}

function scoreForItem(
  answers: Answer[],
  responseId: string,
  itemId: string
): number | null {
  const answer = answers.find(
    (a) => a.responseId === responseId && a.questionId === itemId
  );
  if (!answer) return null;
  const score = Number(answer.value);
  return Number.isFinite(score) ? score : null;
}

function buildScoreCellsForResponses(
  itemId: string,
  items: { id: string; category: string }[],
  filtered: Response[],
  answers: Answer[]
): DemographicCell {
  const category = items.find((item) => item.id === itemId)?.category ?? "";
  const categoryItems = items.filter((item) => item.category === category);

  const scores = filtered
    .map((response) => scoreForItem(answers, response.id, itemId))
    .filter((score): score is number => score !== null);

  const demoItems = categoryItems.map((entry) => ({
    id: entry.id,
    scores: filtered
      .map((response) => scoreForItem(answers, response.id, entry.id))
      .filter((score): score is number => score !== null),
  }));
  const demoRanks = computeRanks(demoItems);

  return {
    score: average(scores),
    rank: demoRanks.get(itemId) ?? null,
  };
}

function buildScoreSectionStats(
  section: Section,
  scoreQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  customField: DemographicFieldConfig | null
): ScoreSectionStats {
  const items = scoreQuestions.map((question) => {
    const config = question.config as ScoreQuestionConfig;
    return {
      id: question.id,
      category: config.category,
      combination: config.combination,
    };
  });

  const overallRanks = new Map<string, number | null>();
  for (const category of [...new Set(items.map((item) => item.category))]) {
    const categoryItems = items.filter((item) => item.category === category);
    const categoryScores = categoryItems.map((item) => ({
      id: item.id,
      scores: responses
        .map((response) => scoreForItem(answers, response.id, item.id))
        .filter((score): score is number => score !== null),
    }));
    const categoryRanks = computeRanks(categoryScores);
    for (const [itemId, rank] of categoryRanks) {
      overallRanks.set(itemId, rank);
    }
  }

  const itemStats = items.map((item) => {
    const byDemographic: Record<string, DemographicCell> = {};
    const byCustomField: Record<string, DemographicCell> = {};

    for (const age of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        const key = demographicKey(age, gender);
        const filtered = responses.filter(
          (response) =>
            response.ageGroup === age && response.gender === gender
        );
        byDemographic[key] = buildScoreCellsForResponses(
          item.id,
          items,
          filtered,
          answers
        );
      }
    }

    if (customField) {
      for (const option of customField.options) {
        const filtered = responses.filter(
          (response) =>
            response.demographicValues[customField.id] === option
        );
        byCustomField[scoreCustomFieldKey(customField.id, option)] =
          buildScoreCellsForResponses(item.id, items, filtered, answers);
      }
    }

    return {
      itemId: item.id,
      category: item.category,
      combination: item.combination,
      averageScore: average(
        responses
          .map((response) => scoreForItem(answers, response.id, item.id))
          .filter((score): score is number => score !== null)
      ),
      averageRank: overallRanks.get(item.id) ?? null,
      byDemographic,
      byCustomField,
    };
  });

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    ageGroups,
    customField: customField
      ? {
          fieldId: customField.id,
          label: customField.label,
          options: customField.options,
        }
      : null,
    items: itemStats,
  };
}

function buildRankingSectionStats(
  section: Section,
  question: Question,
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[]
): RankingSectionStats {
  const config = question.config as RankingQuestionConfig;
  const total = responses.length;

  const combinations = config.combinations.map((combination) => {
    let rank1Count = 0;
    let rank2Count = 0;
    let rank3Count = 0;
    const byDemographic: Record<string, { count: number; percent: number }> =
      {};

    for (const age of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        byDemographic[demographicKey(age, gender)] = { count: 0, percent: 0 };
      }
    }

    for (const response of responses) {
      const answer = answers.find(
        (a) => a.responseId === response.id && a.questionId === question.id
      );
      if (!answer) continue;

      const parsed = parseRankingAnswer(answer.value);
      if (!parsed) continue;

      if (parsed.rank1 === combination) rank1Count += 1;
      if (parsed.rank2 === combination) rank2Count += 1;
      if (parsed.rank3 === combination) rank3Count += 1;

      if (
        response.ageGroup &&
        response.gender &&
        parsed.rank1 === combination
      ) {
        const key = demographicKey(response.ageGroup, response.gender);
        if (byDemographic[key]) {
          byDemographic[key].count += 1;
        }
      }
    }

    const rank12Count = rank1Count + rank2Count;
    const rank123Count = rank1Count + rank2Count + rank3Count;

    for (const age of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        const key = demographicKey(age, gender);
        const groupTotal = responses.filter(
          (r) => r.ageGroup === age && r.gender === gender
        ).length;
        const cell = byDemographic[key];
        cell.percent =
          groupTotal > 0
            ? Math.round((cell.count / groupTotal) * 1000) / 10
            : 0;
      }
    }

    return {
      combination,
      rank1Count,
      rank1Percent: total > 0 ? Math.round((rank1Count / total) * 1000) / 10 : 0,
      rank2Count,
      rank3Count,
      rank12Count,
      rank12Percent:
        total > 0 ? Math.round((rank12Count / total) * 1000) / 10 : 0,
      rank123Count,
      rank123Percent:
        total > 0 ? Math.round((rank123Count / total) * 1000) / 10 : 0,
      byDemographic,
    } satisfies RankingCombinationStats;
  });

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    questionTitle: question.title,
    questionId: question.id,
    ageGroups,
    combinations,
  };
}

function textQuestionTitle(question: Question): string {
  return question.title && question.title !== "주관식 문항"
    ? question.title
    : "주관식 답변";
}

function buildTextSectionStats(
  survey: SurveyDetail,
  section: Section & { questions: Question[] },
  textQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[]
): TextSectionStats {
  const demographic = buildTextDemographicItems(
    survey,
    textQuestions,
    responses,
    answers,
    ageGroups
  );

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    rankingQuestionTitle: null,
    groupedByRank1: false,
    groupedByFinalDesignRank1: demographic.groupedByFinalDesignRank1,
    ageGroups,
    rank1Names: demographic.rank1Names,
    demographicItems: demographic.items.map((item) => {
      const question = textQuestions.find(
        (entry) => entry.id === item.questionId
      );
      return {
        ...item,
        questionTitle: question
          ? textQuestionTitle(question)
          : item.questionTitle,
      };
    }),
    groups: [],
  };
}

function choiceQuestionTitle(question: Question): string {
  return question.title && question.title !== "객관식 문항"
    ? question.title
    : "객관식";
}

function buildFlatChoiceOptions(
  config: ChoiceQuestionConfig,
  responses: Response[],
  answers: Answer[],
  questionId: string
): ChoiceOptionStats[] {
  const counts = new Map<string, number>();

  for (const response of responses) {
    const answer = answers.find(
      (a) => a.responseId === response.id && a.questionId === questionId
    );
    if (!answer) continue;

    const selected = parseChoiceAnswer(answer.value, config);
    for (const option of selected) {
      if (!config.options.includes(option)) continue;
      counts.set(option, (counts.get(option) ?? 0) + 1);
    }
  }

  const total = responses.length;
  return config.options
    .filter((option) => (counts.get(option) ?? 0) > 0)
    .map((option) => {
      const count = counts.get(option) ?? 0;
      return {
        option,
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    });
}

function isLastChoiceQuestionInSection(
  section: Section & { questions: Question[] },
  question: Question
): boolean {
  const choiceQuestions = section.questions.filter((q) => q.type === "choice");
  if (choiceQuestions.length === 0) return false;
  const lastChoice = choiceQuestions.sort((a, b) => b.sortOrder - a.sortOrder)[0];
  return lastChoice.id === question.id;
}

function buildChoiceSectionStats(
  section: Section & { questions: Question[] },
  question: Question,
  precedingRanking: (GroupingQuestion & { id: string; title: string }) | null,
  responses: Response[],
  answers: Answer[]
): ChoiceSectionStats {
  const config = question.config as ChoiceQuestionConfig;
  const groupedByRank1 =
    isRankGroupedTextSection(section) &&
    precedingRanking !== null &&
    isLastChoiceQuestionInSection(section, question);

  if (!groupedByRank1 || !precedingRanking) {
    return {
      sectionId: section.id,
      sectionTitle: section.title,
      questionId: question.id,
      questionTitle: choiceQuestionTitle(question),
      groupedByRank1: false,
      rankingQuestionTitle: null,
      groups: [
        {
          groupName: "전체",
          options: buildFlatChoiceOptions(
            config,
            responses,
            answers,
            question.id
          ),
        },
      ],
    };
  }

  const rankingConfig = precedingRanking.config as RankingQuestionConfig;
  const optionCountsByRank1 = new Map<string, Map<string, number>>();

  for (const response of responses) {
    const rankAnswer = answers.find(
      (a) =>
        a.responseId === response.id && a.questionId === precedingRanking.id
    );
    const parsed = parseRankingAnswer(rankAnswer?.value ?? "");
    if (!parsed?.rank1) continue;

    const choiceAnswer = answers.find(
      (a) => a.responseId === response.id && a.questionId === question.id
    );
    if (!choiceAnswer) continue;

    const selected = parseChoiceAnswer(choiceAnswer.value, config);
    if (selected.length === 0) continue;

    if (!optionCountsByRank1.has(parsed.rank1)) {
      optionCountsByRank1.set(parsed.rank1, new Map());
    }
    const optionCounts = optionCountsByRank1.get(parsed.rank1)!;

    for (const option of selected) {
      if (!config.options.includes(option)) continue;
      optionCounts.set(option, (optionCounts.get(option) ?? 0) + 1);
    }
  }

  const rank1Order = [
    ...rankingConfig.combinations.filter((rank1) => optionCountsByRank1.has(rank1)),
    ...[...optionCountsByRank1.keys()].filter(
      (rank1) => !rankingConfig.combinations.includes(rank1)
    ),
  ];

  const groups: ChoiceGroupStats[] = rank1Order
    .map((groupName) => {
      const optionCounts = optionCountsByRank1.get(groupName);
      if (!optionCounts) return null;

      const groupTotal = [...optionCounts.values()].reduce(
        (sum, count) => sum + count,
        0
      );

      const options = config.options
        .filter((option) => (optionCounts.get(option) ?? 0) > 0)
        .map((option) => {
          const count = optionCounts.get(option) ?? 0;
          return {
            option,
            count,
            percent:
              groupTotal > 0
                ? Math.round((count / groupTotal) * 1000) / 10
                : 0,
          };
        });

      if (options.length === 0) return null;
      return { groupName, options };
    })
    .filter((group): group is ChoiceGroupStats => group !== null);

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    questionId: question.id,
    questionTitle: choiceQuestionTitle(question),
    groupedByRank1: true,
    rankingQuestionTitle:
      precedingRanking.title !== "순위 문항"
        ? precedingRanking.title
        : "순위 선정",
    groups,
  };
}

export function computeDashboardStats(
  survey: SurveyDetail,
  responses: Response[],
  answers: Answer[]
): DashboardStats {
  const demographics = buildDemographics(responses, survey.demographicFields);
  const ageGroups = demographics.ageGroups;

  const sectionGroups = survey.sections.map((section) => {
    const tables: DashboardStats["sectionGroups"][number]["tables"] = [];
    const scoreQuestions = section.questions.filter((q) => q.type === "score");

    if (scoreQuestions.length > 0) {
      tables.push({
        type: "score",
        data: buildScoreSectionStats(
          section,
          scoreQuestions,
          responses,
          answers,
          ageGroups,
          survey.demographicFields[0] ?? null
        ),
      });
    }

    for (const question of section.questions.filter((q) => q.type === "ranking")) {
      tables.push({
        type: "ranking",
        data: buildRankingSectionStats(
          section,
          question,
          responses,
          answers,
          ageGroups
        ),
      });
    }

    const comparisonStats = buildChoiceComparisonSectionStats(
      survey,
      section,
      responses,
      answers
    );

    if (comparisonStats) {
      tables.push({
        type: "choice-comparison",
        data: comparisonStats,
      });
    } else {
      const textQuestions = section.questions.filter((q) => q.type === "text");
      if (textQuestions.length > 0) {
        tables.push({
          type: "text",
          data: buildTextSectionStats(
            survey,
            section,
            textQuestions,
            responses,
            answers,
            ageGroups
          ),
        });
      }

      for (const question of section.questions.filter((q) => q.type === "choice")) {
        const precedingRanking = findPrecedingRankingQuestion(section);
        const rankingQuestion =
          precedingRanking?.id && precedingRanking.title !== undefined
            ? (precedingRanking as GroupingQuestion & {
                id: string;
                title: string;
              })
            : null;

        tables.push({
          type: "choice",
          data: buildChoiceSectionStats(
            section,
            question,
            rankingQuestion,
            responses,
            answers
          ),
        });
      }
    }

    return {
      sectionId: section.id,
      sectionTitle: section.title,
      sortOrder: section.sortOrder,
      tables,
    };
  });

  return {
    totalResponses: responses.length,
    demographics,
    sectionGroups,
  };
}
