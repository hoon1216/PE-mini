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
  ChoiceQuestionConfig,
} from "./types";
import { buildChoiceSectionStats, isChoiceGroupedByRank1 } from "./choice-dashboard-stats";
import {
  demographicKey,
  getPresentAgeGroups,
  parseRankingAnswer,
  scoreCustomFieldKey,
} from "./demographic-utils";
import { buildTextDemographicItems } from "./text-demographic-stats";
import { scoreFromAnswerValue, getScoreReasonCombinationScore, flattenScoreReasonQuestions, parseScoreReasonItemKey } from "./score-reason-utils";
import { buildScoreCompareSectionStats, buildScoreCompareCombinedReasonSectionStats } from "./score-compare-stats";
import { buildCombinedReasonBlocks, buildCombinedReasonSectionStats, buildCombinedReasonSectionStatsForChoiceOption } from "./combined-reason-stats";
import { questionIncludesReason } from "./combined-reason-utils";

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
  itemId: string,
  combinations: string[] = []
): number | null {
  const parsedKey = parseScoreReasonItemKey(itemId);
  if (parsedKey) {
    return getScoreReasonCombinationScore(
      answers,
      responseId,
      parsedKey.questionId,
      parsedKey.combination,
      combinations
    );
  }

  const answer = answers.find(
    (a) => a.responseId === responseId && a.questionId === itemId
  );
  if (!answer) return null;
  return scoreFromAnswerValue(answer.value, combinations);
}

function buildScoreCellsForResponses(
  itemId: string,
  items: { id: string; category: string; combinations: string[] }[],
  filtered: Response[],
  answers: Answer[]
): DemographicCell {
  const currentItem = items.find((item) => item.id === itemId);
  const category = currentItem?.category ?? "";
  const categoryItems = items.filter((item) => item.category === category);

  const scores = filtered
    .map((response) =>
      scoreForItem(
        answers,
        response.id,
        itemId,
        currentItem?.combinations ?? []
      )
    )
    .filter((score): score is number => score !== null);

  const demoItems = categoryItems.map((entry) => ({
    id: entry.id,
    scores: filtered
      .map((response) =>
        scoreForItem(
          answers,
          response.id,
          entry.id,
          entry.combinations
        )
      )
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
  customField: DemographicFieldConfig | null,
  demographicFields: DemographicFieldConfig[]
): ScoreSectionStats {
  const scoreItems = scoreQuestions.flatMap((question) => {
    if (question.type === "score-compare") {
      return flattenScoreReasonQuestions([question]);
    }

    const config = question.config as ScoreQuestionConfig;
    return [
      {
        id: question.id,
        questionId: question.id,
        category: config.category,
        combination: config.combination,
        combinations: [] as string[],
      },
    ];
  });

  const items = scoreItems.map((item) => ({
    id: item.id,
    category: item.category,
    combination: item.combination,
    combinations: item.combinations,
  }));

  const overallRanks = new Map<string, number | null>();
  for (const category of [...new Set(items.map((item) => item.category))]) {
    const categoryItems = items.filter((item) => item.category === category);
    const categoryScores = categoryItems.map((item) => ({
      id: item.id,
      scores: responses
        .map((response) =>
          scoreForItem(answers, response.id, item.id, item.combinations)
        )
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
          .map((response) =>
            scoreForItem(
              answers,
              response.id,
              item.id,
              item.combinations
            )
          )
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
    demographicFields,
    combinedReasonBlocks: buildCombinedReasonBlocks(
      scoreQuestions,
      responses,
      answers
    ),
  };
}

function buildRankingSectionStats(
  section: Section,
  question: Question,
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  demographicFields: DemographicFieldConfig[]
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
    demographicFields,
    combinedReasonBlocks: buildCombinedReasonBlocks(
      [question],
      responses,
      answers
    ),
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
    demographicFields: survey.demographicFields,
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

function pushCombinedReasonTable(
  tables: DashboardStats["sectionGroups"][number]["tables"],
  section: Section,
  question: Question,
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  demographicFields: DemographicFieldConfig[]
) {
  if (!questionIncludesReason(question)) return;

  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    for (const option of config.options) {
      const reasonStats = buildCombinedReasonSectionStatsForChoiceOption(
        section,
        question,
        option,
        responses,
        answers,
        ageGroups,
        demographicFields
      );
      if (reasonStats) {
        tables.push({
          type: "combined-reason",
          data: reasonStats,
        });
      }
    }
    return;
  }

  const reasonStats =
    question.type === "score-compare"
      ? buildScoreCompareCombinedReasonSectionStats(
          section,
          question,
          responses,
          answers,
          ageGroups,
          demographicFields
        )
      : buildCombinedReasonSectionStats(
          section,
          question,
          responses,
          answers,
          ageGroups,
          demographicFields
        );

  if (reasonStats && reasonStats.entries.length > 0) {
    tables.push({
      type: "combined-reason",
      data: reasonStats,
    });
  }
}

function buildSectionTables(
  survey: SurveyDetail,
  section: Section & { questions: Question[] },
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[]
): DashboardStats["sectionGroups"][number]["tables"] {
  const tables: DashboardStats["sectionGroups"][number]["tables"] = [];
  const questions = [...section.questions].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const textQuestions = questions.filter((question) => question.type === "text");

  let textAdded = false;
  let index = 0;

  while (index < questions.length) {
    const question = questions[index];

    if (question.type === "score-compare") {
      const batch = [question];
      while (
        index + batch.length < questions.length &&
        questions[index + batch.length].type === "score-compare"
      ) {
        batch.push(questions[index + batch.length]);
      }

      tables.push({
        type: "score-compare",
        data: buildScoreCompareSectionStats(
          section,
          batch,
          responses,
          answers,
          survey.demographicFields,
          ageGroups
        ),
      });
      for (const batchQuestion of batch) {
        pushCombinedReasonTable(
          tables,
          section,
          batchQuestion,
          responses,
          answers,
          ageGroups,
          survey.demographicFields
        );
      }
      index += batch.length;
      continue;
    }

    if (question.type === "score") {
      const batch = [question];
      while (
        index + batch.length < questions.length &&
        questions[index + batch.length].type === "score"
      ) {
        batch.push(questions[index + batch.length]);
      }

      tables.push({
        type: "score",
        data: buildScoreSectionStats(
          section,
          batch,
          responses,
          answers,
          ageGroups,
          survey.demographicFields[0] ?? null,
          survey.demographicFields
        ),
      });
      for (const batchQuestion of batch) {
        pushCombinedReasonTable(
          tables,
          section,
          batchQuestion,
          responses,
          answers,
          ageGroups,
          survey.demographicFields
        );
      }
      index += batch.length;
      continue;
    }

    if (question.type === "ranking") {
      tables.push({
        type: "ranking",
        data: buildRankingSectionStats(
          section,
          question,
          responses,
          answers,
          ageGroups,
          survey.demographicFields
        ),
      });
      pushCombinedReasonTable(
        tables,
        section,
        question,
        responses,
        answers,
        ageGroups,
        survey.demographicFields
      );
      index += 1;
      continue;
    }

    if (question.type === "choice") {
      const batch = [question];
      while (
        index + batch.length < questions.length &&
        questions[index + batch.length].type === "choice" &&
        !isChoiceGroupedByRank1(section, questions[index + batch.length])
      ) {
        batch.push(questions[index + batch.length]);
      }

      tables.push({
        type: "choice",
        data: buildChoiceSectionStats(
          section,
          batch,
          responses,
          answers,
          ageGroups,
          survey.demographicFields
        ),
      });
      for (const batchQuestion of batch) {
        pushCombinedReasonTable(
          tables,
          section,
          batchQuestion,
          responses,
          answers,
          ageGroups,
          survey.demographicFields
        );
      }
      index += batch.length;
      continue;
    }

    if (question.type === "text") {
      if (!textAdded && textQuestions.length > 0) {
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
        textAdded = true;
      }
      index += 1;
      continue;
    }

    index += 1;
  }

  return tables;
}

export function computeDashboardStats(
  survey: SurveyDetail,
  responses: Response[],
  answers: Answer[]
): DashboardStats {
  const demographics = buildDemographics(responses, survey.demographicFields);
  const ageGroups = demographics.ageGroups;

  const sectionGroups = survey.sections.map((section) => ({
    sectionId: section.id,
    sectionTitle: section.title,
    sortOrder: section.sortOrder,
    tables: buildSectionTables(
      survey,
      section,
      responses,
      answers,
      ageGroups
    ),
  }));

  return {
    totalResponses: responses.length,
    demographics,
    sectionGroups,
  };
}
