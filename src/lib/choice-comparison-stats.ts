import { parseChoiceAnswer } from "./choice-utils";
import { getPresentAgeGroups, parseRankingAnswer } from "./demographic-utils";
import {
  findPrecedingRankingQuestion,
  isRankGroupedTextSection,
  textQuestionAppliesToRankGroup,
} from "./text-grouping-utils";
import type {
  Answer,
  ChoiceQuestionConfig,
  ComparisonSegment,
  ChoiceComparisonCell,
  ChoiceComparisonRankBlock,
  ChoiceComparisonSectionStats,
  DemographicFieldConfig,
  Question,
  Response,
  Section,
  SurveyDetail,
} from "./types";
import { AGE_GROUP_LABELS } from "./types";

export function isChoiceComparisonSection(
  section: Section & { questions: Question[] }
): boolean {
  if (!isRankGroupedTextSection(section)) return false;

  const ranking = findPrecedingRankingQuestion(section);
  if (!ranking?.id) return false;

  const choiceCount = section.questions.filter((q) => q.type === "choice").length;
  const textCount = section.questions.filter((q) => q.type === "text").length;

  return choiceCount >= 1 && textCount >= 1;
}

export function buildComparisonSegments(
  demographicFields: DemographicFieldConfig[],
  responses: Response[]
): ComparisonSegment[] {
  const ageGroups = getPresentAgeGroups(responses);
  const segments: ComparisonSegment[] = [
    { type: "total", key: "total", groupLabel: "전체", label: "전체" },
  ];

  const customField = demographicFields[0];
  if (customField) {
    for (const option of customField.options) {
      segments.push({
        type: "custom",
        key: `custom-${customField.id}-${option}`,
        groupLabel: customField.label,
        label: option,
        fieldId: customField.id,
        option,
      });
    }
  }

  segments.push(
    {
      type: "gender",
      key: "gender-male",
      groupLabel: "성별",
      label: "남",
      gender: "male",
    },
    {
      type: "gender",
      key: "gender-female",
      groupLabel: "성별",
      label: "여",
      gender: "female",
    }
  );

  for (const ageGroup of ageGroups) {
    segments.push({
      type: "age",
      key: `age-${ageGroup}`,
      groupLabel: "연령대",
      label: AGE_GROUP_LABELS[ageGroup],
      ageGroup,
    });
  }

  return segments;
}

export function segmentMatchesResponse(
  response: Response,
  segment: ComparisonSegment
): boolean {
  switch (segment.type) {
    case "total":
      return true;
    case "custom":
      return response.demographicValues[segment.fieldId] === segment.option;
    case "gender":
      return response.gender === segment.gender;
    case "age":
      return response.ageGroup === segment.ageGroup;
    default:
      return false;
  }
}

function targetOptionForRank1(
  config: ChoiceQuestionConfig,
  rank1Name: string
): string {
  const exact = config.options.find((option) => option === rank1Name);
  if (exact) return exact;

  const partial = config.options.find(
    (option) => option.includes(rank1Name) || rank1Name.includes(option)
  );
  if (partial) return partial;

  return config.options[0] ?? "";
}

function computeChoiceComparisonCell(
  responses: Response[],
  answers: Answer[],
  questionId: string,
  config: ChoiceQuestionConfig,
  rankingQuestionId: string,
  rank1Name: string,
  segment: ComparisonSegment
): ChoiceComparisonCell {
  let answered = 0;
  let matched = 0;
  const targetOption = targetOptionForRank1(config, rank1Name);

  for (const response of responses) {
    if (!segmentMatchesResponse(response, segment)) continue;

    const rankAnswer = answers.find(
      (answer) =>
        answer.responseId === response.id &&
        answer.questionId === rankingQuestionId
    );
    const parsed = parseRankingAnswer(rankAnswer?.value ?? "");
    if (parsed?.rank1 !== rank1Name) continue;

    const choiceAnswer = answers.find(
      (answer) =>
        answer.responseId === response.id && answer.questionId === questionId
    );
    if (!choiceAnswer) continue;

    const selected = parseChoiceAnswer(choiceAnswer.value, config);
    if (selected.length === 0) continue;

    answered += 1;
    if (targetOption && selected.includes(targetOption)) {
      matched += 1;
    }
  }

  return {
    count: matched,
    answered,
    percent:
      answered > 0 ? Math.round((matched / answered) * 1000) / 10 : 0,
  };
}

function choiceQuestionLabel(question: Question): string {
  return question.title && question.title !== "객관식 문항"
    ? question.title
    : "객관식";
}

function reasonSectionTitle(textQuestions: Question[]): string {
  const primary = [...textQuestions].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!primary) return "선호 이유";

  const title =
    primary.title && primary.title !== "주관식 문항"
      ? primary.title
      : "주관식";
  if (title.includes("이유")) return title;
  return `${title} 선호 이유`;
}

export function buildChoiceComparisonSectionStats(
  survey: SurveyDetail,
  section: Section & { questions: Question[] },
  responses: Response[],
  answers: Answer[]
): ChoiceComparisonSectionStats | null {
  if (!isChoiceComparisonSection(section)) return null;

  const rankingQuestion = findPrecedingRankingQuestion(section);
  if (!rankingQuestion?.id) return null;

  const rankingConfig = rankingQuestion.config as { combinations: string[] };
  const choiceQuestions = section.questions
    .filter((question) => question.type === "choice")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const textQuestions = section.questions
    .filter((question) => question.type === "text")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const segments = buildComparisonSegments(survey.demographicFields, responses);

  const rankBlocks: ChoiceComparisonRankBlock[] = rankingConfig.combinations.map(
    (rank1Name) => ({
      rank1Name,
      segments,
      rows: choiceQuestions.map((question) => {
        const config = question.config as ChoiceQuestionConfig;
        const cells: Record<string, ChoiceComparisonCell> = {};

        for (const segment of segments) {
          cells[segment.key] = computeChoiceComparisonCell(
            responses,
            answers,
            question.id,
            config,
            rankingQuestion.id!,
            rank1Name,
            segment
          );
        }

        return {
          questionId: question.id,
          itemLabel: choiceQuestionLabel(question),
          category: config.category?.trim() || null,
          cells,
        };
      }),
    })
  );

  const reasonGroups = rankingConfig.combinations.map((rank1Name) => {
    const responsesForRank: string[] = [];

    for (const response of responses) {
      const rankAnswer = answers.find(
        (answer) =>
          answer.responseId === response.id &&
          answer.questionId === rankingQuestion.id
      );
      const parsed = parseRankingAnswer(rankAnswer?.value ?? "");
      if (parsed?.rank1 !== rank1Name) continue;

      for (const question of textQuestions) {
        if (!textQuestionAppliesToRankGroup(question, rank1Name)) continue;

        const textAnswer = answers.find(
          (answer) =>
            answer.responseId === response.id && answer.questionId === question.id
        );
        const value = textAnswer?.value?.trim();
        if (value) responsesForRank.push(value);
      }
    }

    return { rank1Name, responses: responsesForRank };
  });

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    rankingQuestionTitle:
      rankingQuestion.title && rankingQuestion.title !== "순위 문항"
        ? rankingQuestion.title
        : "순위 선정",
    rankBlocks,
    reasonTitle: reasonSectionTitle(textQuestions),
    reasonGroups,
  };
}

export function getCategoryRowSpans(
  rows: { category: string | null }[]
): (number | null)[] {
  const spans: (number | null)[] = new Array(rows.length).fill(null);
  let index = 0;

  while (index < rows.length) {
    const category = rows[index].category;
    if (!category) {
      spans[index] = 1;
      index += 1;
      continue;
    }

    let span = 1;
    while (
      index + span < rows.length &&
      rows[index + span].category === category
    ) {
      span += 1;
    }

    spans[index] = span;
    index += span;
  }

  return spans;
}
