import { describe, expect, it } from "vitest";
import {
  buildChoiceComparisonSectionStats,
  buildComparisonSegments,
  isChoiceComparisonSection,
  normalizeChoiceCategory,
} from "./choice-comparison-stats";
import { demographicKey } from "./demographic-utils";
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
        id: "section-score",
        surveyId: "survey-1",
        title: "최종 디자인",
        description: null,
        sortOrder: 0,
        questions: [
          {
            id: "q-final-a",
            sectionId: "section-score",
            title: "A안",
            description: null,
            type: "score",
            config: { category: "최종 디자인", combination: "A안" },
            sortOrder: 0,
          },
          {
            id: "q-final-b",
            sectionId: "section-score",
            title: "B안",
            description: null,
            type: "score",
            config: { category: "최종 디자인", combination: "B안" },
            sortOrder: 1,
          },
        ],
      },
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
  it("normalizes empty or 없음 category", () => {
    expect(normalizeChoiceCategory(undefined)).toBeNull();
    expect(normalizeChoiceCategory("")).toBeNull();
    expect(normalizeChoiceCategory("없음")).toBeNull();
    expect(normalizeChoiceCategory("요소")).toBe("요소");
  });

  it("detects rank-grouped sections with choice and text", () => {
    const section = createSurvey().sections[1];
    expect(isChoiceComparisonSection(section)).toBe(true);
  });

  it("detects sections with choice and text regardless of sort order", () => {
    const section = {
      ...createSurvey().sections[1],
      sortOrder: 5,
      questions: createSurvey().sections[1].questions.filter(
        (question) => question.type !== "ranking"
      ),
    };
    expect(isChoiceComparisonSection(section)).toBe(true);
  });

  it("builds option-mode comparison without ranking question", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-design",
          surveyId: "survey-1",
          title: "디자인 요소 선호",
          description: null,
          sortOrder: 4,
          questions: [
            {
              id: "q-handle",
              sectionId: "section-design",
              title: "손잡이",
              description: null,
              type: "choice",
              config: {
                category: "요소",
                options: ["선택지 A", "선택지 B"],
                selectionMode: "single",
              },
              sortOrder: 0,
            },
            {
              id: "q-overall",
              sectionId: "section-design",
              title: "전체 디자인",
              description: null,
              type: "choice",
              config: {
                options: ["선택지 A", "선택지 B"],
                selectionMode: "single",
              },
              sortOrder: 1,
            },
            {
              id: "q-reason",
              sectionId: "section-design",
              title: "전체 디자인 선택이유",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 2,
            },
          ],
        },
      ],
    };

    const section = survey.sections[0];
    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "가가가",
        gender: "male",
        ageGroup: "40s",
        demographicValues: {},
      },
    ];
    const answers: Answer[] = [
      {
        id: "a1",
        responseId: "resp-1",
        questionId: "q-handle",
        value: "선택지 B",
      },
      {
        id: "a2",
        responseId: "resp-1",
        questionId: "q-overall",
        value: "선택지 A",
      },
      {
        id: "a3",
        responseId: "resp-1",
        questionId: "q-reason",
        value: "균형잡혀 있고 심플함이 좋다",
      },
    ];

    const stats = buildChoiceComparisonSectionStats(
      survey,
      section,
      responses,
      answers
    );

    expect(stats?.comparisonMode).toBe("option");
    expect(stats?.rankBlocks).toHaveLength(2);
    expect(stats?.rankBlocks[0].rank1Name).toBe("선택지 A");
    expect(stats?.rankBlocks[0].rows[0].cells.total.percent).toBe(0);
    expect(stats?.rankBlocks[1].rows[0].cells.total.percent).toBe(100);
    expect(stats?.reasonGroups).toEqual([
      { rank1Name: "전체", responses: ["균형잡혀 있고 심플함이 좋다"] },
    ]);
    expect(
      stats?.reasonDemographic.byRank1Demographic["전체"][
        demographicKey("40s", "male")
      ]
    ).toEqual(["균형잡혀 있고 심플함이 좋다"]);
  });

  it("includes combined includeReason answers in comparison sections", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-pref",
          surveyId: "survey-1",
          title: "선호도 섹션",
          description: null,
          sortOrder: 0,
          questions: [
            {
              id: "q-choice",
              sectionId: "section-pref",
              title: "안 선택 문항",
              description: null,
              type: "choice",
              config: {
                options: ["선택지 A", "선택지 B", "선택지 C"],
                selectionMode: "single",
                includeReason: true,
              },
              sortOrder: 0,
            },
            {
              id: "q-text",
              sectionId: "section-pref",
              title: "이유 기술 문항",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    const section = survey.sections[0];
    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "20s",
        demographicValues: {},
      },
    ];
    const answers: Answer[] = [
      {
        id: "a1",
        responseId: "resp-1",
        questionId: "q-choice",
        value: JSON.stringify({
          selected: ["선택지 A"],
          reason: "연결된 선택 이유",
        }),
      },
      {
        id: "a2",
        responseId: "resp-1",
        questionId: "q-text",
        value: "독립 이유 기술 답변",
      },
    ];

    const stats = buildChoiceComparisonSectionStats(
      survey,
      section,
      responses,
      answers
    );

    expect(stats?.combinedReasonSections).toHaveLength(1);
    expect(stats?.combinedReasonSections[0].optionLabel).toBe("선택지 A");
    expect(stats?.combinedReasonSections[0].entries[0].reason).toBe(
      "연결된 선택 이유"
    );
    expect(stats?.combinedReasonSections[0].viewerTitle).toBe(
      "선택지 A — 선택 이유"
    );
    expect(
      stats?.reasonDemographic.entriesByRank1["전체"][0].reason
    ).toBe("독립 이유 기술 답변");
  });

  it("does not duplicate score-compare includeReason in comparison sections", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-mixed",
          surveyId: "survey-1",
          title: "혼합",
          description: null,
          sortOrder: 0,
          questions: [
            {
              id: "q-compare",
              sectionId: "section-mixed",
              title: "안 점수 비교 문항",
              description: null,
              type: "score-compare",
              config: {
                category: "구분",
                combinations: ["디자인안 A", "디자인안 B"],
                includeReason: true,
              },
              sortOrder: 0,
            },
            {
              id: "q-choice",
              sectionId: "section-mixed",
              title: "안 선택 문항",
              description: null,
              type: "choice",
              config: {
                options: ["선택지 A", "선택지 B"],
                selectionMode: "single",
                includeReason: true,
              },
              sortOrder: 1,
            },
            {
              id: "q-text",
              sectionId: "section-mixed",
              title: "이유 기술 문항",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 2,
            },
          ],
        },
      ],
    };

    const section = survey.sections[0];
    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "30s",
        demographicValues: { "field-1": "보유하지 않음" },
      },
    ];
    const answers: Answer[] = [
      {
        id: "a1",
        responseId: "resp-1",
        questionId: "q-compare",
        value: JSON.stringify({
          scores: { "디자인안 A": 6, "디자인안 B": 4 },
          reason: "ㄷㄷㄷㄷㄷㄷㄷㄷ",
        }),
      },
      {
        id: "a2",
        responseId: "resp-1",
        questionId: "q-choice",
        value: JSON.stringify({
          selected: ["선택지 A"],
          reason: "선택 이유",
        }),
      },
      {
        id: "a3",
        responseId: "resp-1",
        questionId: "q-text",
        value: "독립 이유",
      },
    ];

    const stats = buildChoiceComparisonSectionStats(
      survey,
      section,
      responses,
      answers
    );

    expect(stats?.combinedReasonSections).toHaveLength(1);
    expect(stats?.combinedReasonSections[0].questionId).toBe("q-choice");
    expect(
      stats?.combinedReasonSections.some(
        (entry) => entry.questionId === "q-compare"
      )
    ).toBe(false);
  });

  it("builds comparison matrix and reason groups", () => {
    const survey = createSurvey();
    const section = survey.sections[1];
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
        id: "s1",
        responseId: "resp-1",
        questionId: "q-final-a",
        value: "7",
      },
      {
        id: "s2",
        responseId: "resp-1",
        questionId: "q-final-b",
        value: "4",
      },
      {
        id: "s3",
        responseId: "resp-2",
        questionId: "q-final-a",
        value: "3",
      },
      {
        id: "s4",
        responseId: "resp-2",
        questionId: "q-final-b",
        value: "6",
      },
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
    expect(stats?.comparisonMode).toBe("rank1");
    expect(stats?.rankBlocks).toHaveLength(2);
    expect(stats?.rankBlocks[0].rows[0].category).toBe("요소");
    expect(stats?.rankBlocks[0].rows[0].cells.total.percent).toBe(100);
    expect(stats?.rankBlocks[1].rows[0].cells.total.percent).toBe(100);
    expect(stats?.reasonGroups[0]).toEqual({
      rank1Name: "A안",
      responses: ["색감이 좋음"],
    });
    expect(stats?.reasonGroups[1]).toEqual({
      rank1Name: "B안",
      responses: ["심플함"],
    });
    expect(
      stats?.reasonDemographic.byRank1Demographic["A안"][
        demographicKey("20s", "male")
      ]
    ).toEqual(["색감이 좋음"]);
    expect(
      stats?.reasonDemographic.byRank1Demographic["B안"][
        demographicKey("30s", "female")
      ]
    ).toEqual(["심플함"]);
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
