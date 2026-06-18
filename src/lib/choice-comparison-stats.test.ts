import { describe, expect, it } from "vitest";
import {
  buildChoiceComparisonSectionStats,
  buildComparisonSegments,
  isChoiceComparisonSection,
} from "./choice-comparison-stats";
import type { Answer, Response, SurveyDetail } from "./types";

function createSurvey(): SurveyDetail {
  return {
    id: "survey-1",
    title: "테스트",
    slug: "test",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    demographicFields: [
      {
        id: "field-1",
        label: "프로젝터 보유",
        options: ["보유함", "보유하지 않음"],
      },
    ],
    sections: [
      {
        id: "section-1",
        surveyId: "survey-1",
        title: "A/B 비교",
        description: null,
        sortOrder: 0,
        questions: [
          {
            id: "q-rank",
            sectionId: "section-1",
            title: "순위 문항",
            description: null,
            type: "ranking",
            config: { combinations: ["A안", "B안"] },
            sortOrder: 0,
          },
          {
            id: "q-choice-1",
            sectionId: "section-1",
            title: "손잡이",
            description: null,
            type: "choice",
            config: {
              category: "요소",
              options: ["A안", "B안"],
              selectionMode: "single",
            },
            sortOrder: 1,
          },
          {
            id: "q-text",
            sectionId: "section-1",
            title: "전체 디자인 선호 이유",
            description: null,
            type: "text",
            config: { maxLength: 500 },
            sortOrder: 2,
          },
        ],
      },
    ],
  };
}

describe("choice-comparison-stats", () => {
  it("detects rank-grouped sections with choice and text", () => {
    const section = createSurvey().sections[0];
    expect(isChoiceComparisonSection(section)).toBe(true);
  });

  it("builds comparison matrix and reason groups", () => {
    const survey = createSurvey();
    const section = survey.sections[0];
    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "20s",
        demographicValues: { "field-1": "보유함" },
      },
      {
        id: "resp-2",
        surveyId: "survey-1",
        submittedAt: "2026-01-02T00:00:00.000Z",
        participantName: "B",
        gender: "female",
        ageGroup: "30s",
        demographicValues: { "field-1": "보유하지 않음" },
      },
    ];
    const answers: Answer[] = [
      {
        id: "a1",
        responseId: "resp-1",
        questionId: "q-rank",
        value: JSON.stringify({ rank1: "A안", rank2: "B안" }),
      },
      {
        id: "a2",
        responseId: "resp-1",
        questionId: "q-choice-1",
        value: "A안",
      },
      {
        id: "a3",
        responseId: "resp-1",
        questionId: "q-text",
        value: "색감이 좋음",
      },
      {
        id: "a4",
        responseId: "resp-2",
        questionId: "q-rank",
        value: JSON.stringify({ rank1: "B안", rank2: "A안" }),
      },
      {
        id: "a5",
        responseId: "resp-2",
        questionId: "q-choice-1",
        value: "B안",
      },
      {
        id: "a6",
        responseId: "resp-2",
        questionId: "q-text",
        value: "심플함",
      },
    ];

    const stats = buildChoiceComparisonSectionStats(
      survey,
      section,
      responses,
      answers
    );

    expect(stats).not.toBeNull();
    expect(stats?.rankBlocks).toHaveLength(2);
    expect(stats?.rankBlocks[0].rows[0].category).toBe("요소");
    expect(stats?.rankBlocks[0].rows[0].cells.total.percent).toBe(100);
    expect(stats?.rankBlocks[1].rows[0].cells.total.percent).toBe(100);
    expect(stats?.reasonGroups[0].responses).toEqual(["색감이 좋음"]);
    expect(stats?.reasonGroups[1].responses).toEqual(["심플함"]);
  });

  it("builds demographic comparison segments", () => {
    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "20s",
        demographicValues: { "field-1": "보유함" },
      },
    ];

    const segments = buildComparisonSegments(
      createSurvey().demographicFields,
      responses
    );

    expect(segments.some((segment) => segment.type === "custom")).toBe(true);
    expect(segments.some((segment) => segment.type === "gender")).toBe(true);
    expect(segments.some((segment) => segment.type === "age")).toBe(true);
  });
});
