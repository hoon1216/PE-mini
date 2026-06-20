import {
  normalizeChoiceCategory,
  segmentMatchesResponse,
} from "./choice-comparison-stats";
import { parseChoiceAnswer } from "./choice-utils";
import { parseRankingAnswer } from "./demographic-utils";
import { buildDemographicDashboardSegments } from "./score-compare-stats";
import {
  findPrecedingRankingQuestion,
  isRankGroupedTextSection,
} from "./text-grouping-utils";
import type {
  AgeGroup,
  Answer,
  ChoiceDashboardItemStats,
  ChoiceDashboardStats,
  ChoiceGroupStats,
  ChoiceQuestionConfig,
  ChoiceSectionStats,
  DemographicFieldConfig,
  Question,
  RankingQuestionConfig,
  Response,
  Section,
} from "./types";

function choiceQuestionTitle(question: Question): string {
  if (
    question.title &&
    question.title !== "객관식 문항" &&
    question.title !== "안 선택 문항"
  ) {
    return question.title;
  }
  return "객관식";
}

function countOptionSelections(
  config: ChoiceQuestionConfig,
  filtered: Response[],
  answers: Answer[],
  questionId: string,
  option: string
): number {
  let count = 0;

  for (const response of filtered) {
    const answer = answers.find(
      (entry) => entry.responseId === response.id && entry.questionId === questionId
    );
    if (!answer) continue;

    const selected = parseChoiceAnswer(answer.value, config);
    if (selected.includes(option)) {
      count += 1;
    }
  }

  return count;
}

function buildChoiceSegmentCell(
  config: ChoiceQuestionConfig,
  filtered: Response[],
  answers: Answer[],
  questionId: string,
  option: string
): { count: number; percent: number } | null {
  const count = countOptionSelections(
    config,
    filtered,
    answers,
    questionId,
    option
  );
  if (count === 0) return null;

  const total = filtered.length;
  return {
    count,
    percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  };
}

export function isHiddenChoiceCategory(category?: string | null): boolean {
  return category?.trim() === "없음";
}

function choiceDashboardCategory(
  question: Question
): { category: string | null; itemLabel: string } {
  const config = question.config as ChoiceQuestionConfig;
  const itemLabel = choiceQuestionTitle(question);
  const normalizedCategory = normalizeChoiceCategory(config.category);

  if (normalizedCategory && normalizedCategory !== itemLabel) {
    return { category: normalizedCategory, itemLabel };
  }

  return { category: null, itemLabel };
}

function buildChoiceDashboardItems(
  choiceQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  segments: ChoiceDashboardStats["segments"]
): ChoiceDashboardItemStats[] {
  return choiceQuestions
    .filter(
      (question) =>
        !isHiddenChoiceCategory(
          (question.config as ChoiceQuestionConfig).category
        )
    )
    .flatMap((question) => {
      const config = question.config as ChoiceQuestionConfig;
      const { category, itemLabel } = choiceDashboardCategory(question);

      return config.options.map((option) => ({
        itemId: `${question.id}::${option}`,
        category,
        itemLabel,
        option,
        bySegment: Object.fromEntries(
          segments.map((segment) => {
            const filtered = responses.filter((response) =>
              segmentMatchesResponse(response, segment)
            );
            return [
              segment.key,
              buildChoiceSegmentCell(
                config,
                filtered,
                answers,
                question.id,
                option
              ),
            ];
          })
        ),
      }));
    });
}

export function buildChoiceDashboardStats(
  choiceQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  demographicFields: DemographicFieldConfig[]
): ChoiceDashboardStats {
  const segments = buildDemographicDashboardSegments(demographicFields, responses, {
    includeTotalAverage: true,
    totalLabel: "전체",
  });

  return {
    segments,
    items: buildChoiceDashboardItems(
      choiceQuestions,
      responses,
      answers,
      segments
    ),
  };
}

function isLastChoiceQuestionInSection(
  section: Section & { questions: Question[] },
  question: Question
): boolean {
  const choiceQuestions = section.questions.filter((entry) => entry.type === "choice");
  if (choiceQuestions.length === 0) return false;
  const lastChoice = choiceQuestions.sort((a, b) => b.sortOrder - a.sortOrder)[0];
  return lastChoice.id === question.id;
}

export function isChoiceGroupedByRank1(
  section: Section & { questions: Question[] },
  question: Question
): boolean {
  const precedingRanking = findPrecedingRankingQuestion(section);
  return (
    isRankGroupedTextSection(section) &&
    precedingRanking !== null &&
    isLastChoiceQuestionInSection(section, question)
  );
}

function buildRankGroupedChoiceSectionStats(
  section: Section & { questions: Question[] },
  question: Question,
  precedingRanking: Question & { id: string; title: string },
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  demographicFields: DemographicFieldConfig[]
): ChoiceSectionStats {
  const config = question.config as ChoiceQuestionConfig;
  const rankingConfig = precedingRanking.config as RankingQuestionConfig;
  const optionCountsByRank1 = new Map<string, Map<string, number>>();

  for (const response of responses) {
    const rankAnswer = answers.find(
      (entry) =>
        entry.responseId === response.id && entry.questionId === precedingRanking.id
    );
    const parsed = parseRankingAnswer(rankAnswer?.value ?? "");
    if (!parsed?.rank1) continue;

    const choiceAnswer = answers.find(
      (entry) => entry.responseId === response.id && entry.questionId === question.id
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
    dashboardStats: null,
    demographicFields,
    ageGroups,
  };
}

export function buildChoiceSectionStats(
  section: Section & { questions: Question[] },
  choiceQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[],
  demographicFields: DemographicFieldConfig[]
): ChoiceSectionStats {
  if (choiceQuestions.length === 1 && isChoiceGroupedByRank1(section, choiceQuestions[0])) {
    const precedingRanking = findPrecedingRankingQuestion(section);
    if (precedingRanking?.id && precedingRanking.title !== undefined) {
      return buildRankGroupedChoiceSectionStats(
        section,
        choiceQuestions[0],
        precedingRanking as Question & { id: string; title: string },
        responses,
        answers,
        ageGroups,
        demographicFields
      );
    }
  }

  const primaryQuestion = choiceQuestions[0];
  const questionTitle =
    choiceQuestions.length === 1
      ? choiceQuestionTitle(primaryQuestion)
      : section.title;

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    questionId: primaryQuestion.id,
    questionTitle,
    groupedByRank1: false,
    rankingQuestionTitle: null,
    groups: [],
    dashboardStats: buildChoiceDashboardStats(
      choiceQuestions,
      responses,
      answers,
      demographicFields
    ),
    demographicFields,
    ageGroups,
  };
}

export function formatChoiceSegmentCell(
  cell: { count: number; percent: number } | null | undefined
): string {
  if (!cell || cell.count === 0) return "-";
  return `${cell.percent}% (${cell.count})`;
}

export function getChoiceItemLabelRowSpans(
  items: Pick<ChoiceDashboardItemStats, "category" | "itemLabel">[]
): (number | null)[] {
  const spans: (number | null)[] = [];
  let index = 0;

  while (index < items.length) {
    const current = items[index];
    let span = 1;

    while (
      index + span < items.length &&
      items[index + span].category === current.category &&
      items[index + span].itemLabel === current.itemLabel
    ) {
      span += 1;
    }

    spans[index] = span;
    index += span;
  }

  return spans;
}
