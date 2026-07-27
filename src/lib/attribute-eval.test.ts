import { describe, expect, it } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";
import { flattenAttributeEvalQuestions } from "./score-reason-utils";
import { normalizeQuestionConfig } from "./question-utils";
import type { Answer, Question, Response, SurveyDetail } from "./types";

describe("attribute-eval", () => {
  it("normalizes default attribute-eval config", () => {
    const config = normalizeQuestionConfig("attribute-eval", {});
    expect(config).toMatchObject({
      designConcept: "디자인 컨셉",
      attributes: ["속성 1", "속성 2", "속성 3"],
    });
  });

  it("flattens attributes into dashboard score items", () => {
    const question: Question = {
      id: "q-attr",
      sectionId: "section-1",
      title: "디자인 속성 평가 문항",
      description: null,
      type: "attribute-eval",
      config: {
        designConcept: "디자인 컨셉 1",
        attributes: ["속성 1", "속성 2", "속성 3"],
      },
      sortOrder: 0,
    };

    expect(flattenAttributeEvalQuestions([question])).toEqual([
      {
        id: "q-attr::속성 1",
        questionId: "q-attr",
        category: "디자인 컨셉 1",
        combination: "속성 1",
        combinations: ["속성 1", "속성 2", "속성 3"],
      },
      {
        id: "q-attr::속성 2",
        questionId: "q-attr",
        category: "디자인 컨셉 1",
        combination: "속성 2",
        combinations: ["속성 1", "속성 2", "속성 3"],
      },
      {
        id: "q-attr::속성 3",
        questionId: "q-attr",
        category: "디자인 컨셉 1",
        combination: "속성 3",
        combinations: ["속성 1", "속성 2", "속성 3"],
      },
    ]);
  });

  it("builds attribute-eval dashboard table with score and rank", () => {
    const survey: SurveyDetail = {
      id: "survey-1",
      title: "테스트",
      slug: "test",
      description: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      demographicFields: [
        { id: "field1", label: "소속", options: ["참여 학생", "LG 디자인"] },
      ],
      sections: [
        {
          id: "section-1",
          surveyId: "survey-1",
          title: "섹션 이름",
          description: null,
          sortOrder: 0,
          questions: [
            {
              id: "q-attr",
              sectionId: "section-1",
              title: "디자인 속성 평가 문항",
              description: null,
              type: "attribute-eval",
              config: {
                designConcept: "디자인 컨셉 1",
                attributes: ["속성 1", "속성 2"],
              },
              sortOrder: 0,
            },
          ],
        },
      ],
    };

    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "20s",
        demographicValues: { field1: "참여 학생" },
      },
      {
        id: "resp-2",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "B",
        gender: "female",
        ageGroup: "30s",
        demographicValues: { field1: "LG 디자인" },
      },
    ];

    const answers: Answer[] = [
      {
        id: "a1",
        responseId: "resp-1",
        questionId: "q-attr",
        value: JSON.stringify({
          scores: { "속성 1": 7, "속성 2": 5 },
          reason: "",
        }),
      },
      {
        id: "a2",
        responseId: "resp-2",
        questionId: "q-attr",
        value: JSON.stringify({
          scores: { "속성 1": 5, "속성 2": 6 },
          reason: "",
        }),
      },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const table = stats.sectionGroups[0].tables[0];

    expect(table.type).toBe("attribute-eval");
    if (table.type === "attribute-eval") {
      expect(table.data.items).toHaveLength(2);
      expect(table.data.items[0]).toMatchObject({
        category: "디자인 컨셉 1",
        combination: "속성 1",
        averageScore: 6,
      });
      expect(table.data.items[1]).toMatchObject({
        category: "디자인 컨셉 1",
        combination: "속성 2",
        averageScore: 5.5,
      });
      expect(table.data.customField?.label).toBe("소속");
    }
  });
});
