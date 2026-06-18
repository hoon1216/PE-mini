import { parseChoiceAnswer } from "./choice-utils";
import { getPresentAgeGroups, parseRankingAnswer } from "./demographic-utils";
import {
  findPrecedingRankingQuestion,
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
  RankingQuestionConfig,
  Response,
  Section,
  SurveyDetail,
} from "./types";
import { AGE_GROUP_LABELS } from "./types";

export function isChoiceComparisonSection(
  section: Section & { questions: Question[] }
): boolean {
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

function targetOptionForGroup(
  config: ChoiceQuestionConfig,
  groupName: string
): string {
  const exact = config.options.find((option) => option === groupName);
  if (exact) return exact;

  const partial = config.options.find(
    (option) => option.includes(groupName) || groupName.includes(option)
  );
  if (partial) return partial;

  return config.options[0] ?? "";
}

function computeRank1ModeCell(
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
  const targetOption = targetOptionForGroup(config, rank1Name);

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

function computeOptionModeCell(
  responses: Response[],
  answers: Answer[],
  questionId: string,
  config: ChoiceQuestionConfig,
  optionName: string,
  segment: ComparisonSegment
): ChoiceComparisonCell {
  let answered = 0;
  let matched = 0;
  const targetOption = targetOptionForGroup(config, optionName);

  for (const response of responses) {
    if (!segmentMatchesResponse(response, segment)) continue;

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

function findReasonGroupingChoice(
  choiceQuestions: Question[]
): Question | null {
  const byTitle = choiceQuestions.find(
    (question) =>
      question.title.includes("전체") || question.title.includes("디자인")
  );
  if (byTitle) return byTitle;

  return choiceQuestions[choiceQuestions.length - 1] ?? null;
}

function resolveComparisonGroups(
  choiceQuestions: Question[],
  rankingQuestion: ReturnType<typeof findPrecedingRankingQuestion>
): {
  mode: ChoiceComparisonSectionStats["comparisonMode"];
  groups: string[];
  rankingQuestionId?: string;
} {
  if (rankingQuestion?.id) {
    const config = rankingQuestion.config as RankingQuestionConfig;
    return {
      mode: "rank1",
      groups: config.combinations,
      rankingQuestionId: rankingQuestion.id,
    };
  }

  const referenceChoice = choiceQuestions[0];
  if (!referenceChoice) {
    return { mode: "option", groups: [] };
  }

  return {
    mode: "option",
    groups: (referenceChoice.config as ChoiceQuestionConfig).options,
  };
}

function buildReasonGroups(
  mode: ChoiceComparisonSectionStats["comparisonMode"],
  groups: string[],
  rankingQuestion: ReturnType<typeof findPrecedingRankingQuestion>,
  choiceQuestions: Question[],
  textQuestions: Question[],
  responses: Response[],
  answers: Answer[]
) {
  if (mode === "rank1" && rankingQuestion?.id) {
    return groups.map((rank1Name) => {
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
              answer.responseId === response.id &&
              answer.questionId === question.id
          );
          const value = textAnswer?.value?.trim();
          if (value) responsesForRank.push(value);
        }
      }

      return { rank1Name, responses: responsesForRank };
    });
  }

  const groupingChoice = findReasonGroupingChoice(choiceQuestions);
  if (!groupingChoice) {
    return groups.map((groupName) => ({ rank1Name: groupName, responses: [] }));
  }

  const groupingConfig = groupingChoice.config as ChoiceQuestionConfig;

  return groups.map((groupName) => {
    const responsesForGroup: string[] = [];

    for (const response of responses) {
      const choiceAnswer = answers.find(
        (answer) =>
          answer.responseId === response.id &&
          answer.questionId === groupingChoice.id
      );
      const selected = parseChoiceAnswer(choiceAnswer?.value ?? "", groupingConfig);
      const targetOption = targetOptionForGroup(groupingConfig, groupName);
      if (!targetOption || !selected.includes(targetOption)) continue;

      for (const question of textQuestions) {
        const textAnswer = answers.find(
          (answer) =>
            answer.responseId === response.id && answer.questionId === question.id
        );
        const value = textAnswer?.value?.trim();
        if (value) responsesForGroup.push(value);
      }
    }

    return { rank1Name: groupName, responses: responsesForGroup };
  });
}

export function buildChoiceComparisonSectionStats(
  survey: SurveyDetail,
  section: Section & { questions: Question[] },
  responses: Response[],
  answers: Answer[]
): ChoiceComparisonSectionStats | null {
  if (!isChoiceComparisonSection(section)) return null;

  const rankingQuestion = findPrecedingRankingQuestion(section);
  const choiceQuestions = section.questions
    .filter((question) => question.type === "choice")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const textQuestions = section.questions
    .filter((question) => question.type === "text")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { mode, groups, rankingQuestionId } = resolveComparisonGroups(
    choiceQuestions,
    rankingQuestion
  );

  if (groups.length === 0) return null;

  const segments = buildComparisonSegments(survey.demographicFields, responses);

  const rankBlocks: ChoiceComparisonRankBlock[] = groups.map((groupName) => ({
    rank1Name: groupName,
    segments,
    rows: choiceQuestions.map((question) => {
      const config = question.config as ChoiceQuestionConfig;
      const cells: Record<string, ChoiceComparisonCell> = {};

      for (const segment of segments) {
        cells[segment.key] =
          mode === "rank1" && rankingQuestionId
            ? computeRank1ModeCell(
                responses,
                answers,
                question.id,
                config,
                rankingQuestionId,
                groupName,
                segment
              )
            : computeOptionModeCell(
                responses,
                answers,
                question.id,
                config,
                groupName,
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
  }));

  const reasonGroups = buildReasonGroups(
    mode,
    groups,
    rankingQuestion,
    choiceQuestions,
    textQuestions,
    responses,
    answers
  );

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    comparisonMode: mode,
    rankingQuestionTitle:
      mode === "rank1" && rankingQuestion?.title
        ? rankingQuestion.title !== "순위 문항"
          ? rankingQuestion.title
          : "순위 선정"
        : findReasonGroupingChoice(choiceQuestions)?.title ?? "선택 기준",
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
