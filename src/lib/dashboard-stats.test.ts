import { describe, expect, it } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";
import { demographicKey } from "./demographic-utils";
import type { Answer, Response, SurveyDetail } from "./types";

function createSurvey(): SurveyDetail {
  return {
    id: "survey-1",
    title: "테스트 조사",
    slug: "test-survey",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    demographicFields: [],
    sections: [
      {
        id: "section-1",
        surveyId: "survey-1",
        title: "점수 섹션",
        description: null,
        sortOrder: 0,
        questions: [
          {
            id: "q-score-a",
            sectionId: "section-1",
            title: "조합 A",
            description: null,
            type: "score",
            config: { category: "색상", combination: "A" },
            sortOrder: 0,
          },
          {
            id: "q-score-b",
            sectionId: "section-1",
            title: "조합 B",
            description: null,
            type: "score",
            config: { category: "색상", combination: "B" },
            sortOrder: 1,
          },
        ],
      },
      {
        id: "section-2",
        surveyId: "survey-1",
        title: "순위 섹션",
        description: null,
        sortOrder: 1,
        questions: [
          {
            id: "q-rank",
            sectionId: "section-2",
            title: "순위 문항",
            description: null,
            type: "ranking",
            config: { combinations: ["A", "B", "C"] },
            sortOrder: 0,
          },
        ],
      },
    ],
  };
}

function createResponses(): Response[] {
  return [
    {
      id: "resp-1",
      surveyId: "survey-1",
      submittedAt: "2026-01-02T00:00:00.000Z",
      participantName: "홍길동",
      gender: "male",
      ageGroup: "20s",
      demographicValues: {},
    },
    {
      id: "resp-2",
      surveyId: "survey-1",
      submittedAt: "2026-01-03T00:00:00.000Z",
      participantName: "김영희",
      gender: "female",
      ageGroup: "30s",
      demographicValues: {},
    },
  ];
}

function createAnswers(): Answer[] {
  return [
    { id: "a1", responseId: "resp-1", questionId: "q-score-a", value: "5" },
    { id: "a2", responseId: "resp-1", questionId: "q-score-b", value: "3" },
    {
      id: "a3",
      responseId: "resp-1",
      questionId: "q-rank",
      value: JSON.stringify({ rank1: "A", rank2: "B", rank3: "C" }),
    },
    { id: "a4", responseId: "resp-2", questionId: "q-score-a", value: "4" },
    { id: "a5", responseId: "resp-2", questionId: "q-score-b", value: "4" },
    {
      id: "a6",
      responseId: "resp-2",
      questionId: "q-rank",
      value: JSON.stringify({ rank1: "B", rank2: "A", rank3: "C" }),
    },
  ];
}

describe("computeDashboardStats", () => {
  it("aggregates demographics and section stats", () => {
    const stats = computeDashboardStats(
      createSurvey(),
      createResponses(),
      createAnswers()
    );

    expect(stats.totalResponses).toBe(2);
    expect(stats.demographics.total).toBe(2);
    expect(stats.demographics.male).toBe(1);
    expect(stats.demographics.female).toBe(1);
    expect(stats.sectionGroups).toHaveLength(2);

    const scoreTable = stats.sectionGroups[0].tables.find(
      (table) => table.type === "score"
    );
    expect(scoreTable?.type).toBe("score");
    if (scoreTable?.type === "score") {
      const itemA = scoreTable.data.items.find((item) => item.itemId === "q-score-a");
      expect(itemA?.averageScore).toBe(4.5);
      expect(itemA?.averageRank).toBe(1);
    }

    const rankingTable = stats.sectionGroups[1].tables.find(
      (table) => table.type === "ranking"
    );
    expect(rankingTable?.type).toBe("ranking");
    if (rankingTable?.type === "ranking") {
      const comboA = rankingTable.data.combinations.find(
        (item) => item.combination === "A"
      );
      expect(comboA?.rank1Count).toBe(1);
      expect(comboA?.rank1Percent).toBe(50);
    }
  });

  it("returns empty demographics for no responses", () => {
    const stats = computeDashboardStats(createSurvey(), [], []);

    expect(stats.totalResponses).toBe(0);
    expect(stats.demographics.total).toBe(0);
    expect(stats.demographics.ageGroups).toEqual([]);
  });

  it("counts choice selections and hides unselected options", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-choice",
          surveyId: "survey-1",
          title: "객관식 섹션",
          description: null,
          sortOrder: 0,
          questions: [
            {
              id: "q-choice",
              sectionId: "section-choice",
              title: "선호 색상",
              description: null,
              type: "choice",
              config: {
                options: ["빨강", "파랑", "노랑"],
                selectionMode: "single",
              },
              sortOrder: 0,
            },
          ],
        },
      ],
    };

    const responses = createResponses();
    const answers: Answer[] = [
      { id: "c1", responseId: "resp-1", questionId: "q-choice", value: "빨강" },
      { id: "c2", responseId: "resp-2", questionId: "q-choice", value: "파랑" },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const choiceTable = stats.sectionGroups[0].tables.find(
      (table) => table.type === "choice"
    );

    expect(choiceTable?.type).toBe("choice");
    if (choiceTable?.type === "choice") {
      expect(choiceTable.data.groups[0].options).toEqual([
        { option: "빨강", count: 1, percent: 50 },
        { option: "파랑", count: 1, percent: 50 },
      ]);
      expect(
        choiceTable.data.groups[0].options.some((row) => row.option === "노랑")
      ).toBe(false);
    }
  });

  it("groups last choice question by preceding ranking rank1", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-pref",
          surveyId: "survey-1",
          title: "선호 순위",
          description: null,
          sortOrder: 2,
          questions: [
            {
              id: "q-rank",
              sectionId: "section-pref",
              title: "순위 문항",
              description: null,
              type: "ranking",
              config: {
                combinations: ["A", "B", "C", "D"],
              },
              sortOrder: 0,
            },
            {
              id: "q-choice",
              sectionId: "section-pref",
              title: "1순위 선호 이유",
              description: null,
              type: "choice",
              config: {
                options: ["이유1", "이유2", "이유3"],
                selectionMode: "multiple",
              },
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    const responses = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male" as const,
        ageGroup: "20s" as const,
        demographicValues: {},
      },
      {
        id: "resp-2",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "B",
        gender: "female" as const,
        ageGroup: "30s" as const,
        demographicValues: {},
      },
    ];

    const answers: Answer[] = [
      {
        id: "r1",
        responseId: "resp-1",
        questionId: "q-rank",
        value: JSON.stringify({ rank1: "A", rank2: "B", rank3: "C" }),
      },
      {
        id: "c1",
        responseId: "resp-1",
        questionId: "q-choice",
        value: JSON.stringify(["이유1", "이유2"]),
      },
      {
        id: "r2",
        responseId: "resp-2",
        questionId: "q-rank",
        value: JSON.stringify({ rank1: "B", rank2: "A", rank3: "C" }),
      },
      {
        id: "c2",
        responseId: "resp-2",
        questionId: "q-choice",
        value: JSON.stringify(["이유2", "이유3"]),
      },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const choiceTable = stats.sectionGroups[0].tables.find(
      (table) => table.type === "choice"
    );

    expect(choiceTable?.type).toBe("choice");
    if (choiceTable?.type === "choice") {
      expect(choiceTable.data.groupedByRank1).toBe(true);
      expect(choiceTable.data.groups).toEqual([
        {
          groupName: "A",
          options: [
            { option: "이유1", count: 1, percent: 50 },
            { option: "이유2", count: 1, percent: 50 },
          ],
        },
        {
          groupName: "B",
          options: [
            { option: "이유2", count: 1, percent: 50 },
            { option: "이유3", count: 1, percent: 50 },
          ],
        },
      ]);
    }
  });

  it("groups text responses by final design rank1 and demographics", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-score",
          surveyId: "survey-1",
          title: "점수",
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
          id: "section-black",
          surveyId: "survey-1",
          title: "블랙",
          description: null,
          sortOrder: 1,
          questions: [
            {
              id: "q-text-black",
              sectionId: "section-black",
              title: "의견",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 0,
            },
          ],
        },
      ],
    };

    const responses = createResponses();
    const answers: Answer[] = [
      { id: "a1", responseId: "resp-1", questionId: "q-final-a", value: "6" },
      { id: "a2", responseId: "resp-1", questionId: "q-final-b", value: "4" },
      {
        id: "a8",
        responseId: "resp-1",
        questionId: "q-text-black",
        value: "블랙 A안 의견",
      },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const textTable = stats.sectionGroups[1].tables.find(
      (table) => table.type === "text"
    );

    expect(textTable?.type).toBe("text");
    if (textTable?.type === "text") {
      expect(textTable.data.groupedByFinalDesignRank1).toBe(true);
      const item = textTable.data.demographicItems[0];
      expect(
        item.byRank1Demographic["A안"][demographicKey("20s", "male")]
      ).toEqual(["블랙 A안 의견"]);
    }
  });

  it("groups text responses by final design rank1 across sections", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-score",
          surveyId: "survey-1",
          title: "점수",
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
          id: "section-2",
          surveyId: "survey-1",
          title: "그레이",
          description: null,
          sortOrder: 1,
          questions: [
            {
              id: "q-text-gray",
              sectionId: "section-2",
              title: "의견",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 0,
            },
          ],
        },
      ],
    };

    const responses = createResponses();
    const answers: Answer[] = [
      { id: "a1", responseId: "resp-1", questionId: "q-final-a", value: "6" },
      { id: "a2", responseId: "resp-1", questionId: "q-final-b", value: "4" },
      {
        id: "a8",
        responseId: "resp-1",
        questionId: "q-text-gray",
        value: "A안 의견",
      },
      { id: "a3", responseId: "resp-2", questionId: "q-final-a", value: "3" },
      { id: "a4", responseId: "resp-2", questionId: "q-final-b", value: "7" },
      {
        id: "a10",
        responseId: "resp-2",
        questionId: "q-text-gray",
        value: "B안 의견",
      },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const textTable = stats.sectionGroups[1].tables.find(
      (table) => table.type === "text"
    );

    expect(textTable?.type).toBe("text");
    if (textTable?.type === "text") {
      expect(textTable.data.groupedByFinalDesignRank1).toBe(true);
      const item = textTable.data.demographicItems[0];
      expect(
        item.byRank1Demographic["A안"][demographicKey("20s", "male")]
      ).toEqual(["A안 의견"]);
      expect(
        item.byRank1Demographic["B안"][demographicKey("30s", "female")]
      ).toEqual(["B안 의견"]);
    }
  });

  it("ranks score items within the same category only", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-multi",
          surveyId: "survey-1",
          title: "다중 구분",
          description: null,
          sortOrder: 0,
          questions: [
            {
              id: "q-color-a",
              sectionId: "section-multi",
              title: "색상 A",
              description: null,
              type: "score",
              config: { category: "색상", combination: "A" },
              sortOrder: 0,
            },
            {
              id: "q-color-b",
              sectionId: "section-multi",
              title: "색상 B",
              description: null,
              type: "score",
              config: { category: "색상", combination: "B" },
              sortOrder: 1,
            },
            {
              id: "q-size-x",
              sectionId: "section-multi",
              title: "크기 X",
              description: null,
              type: "score",
              config: { category: "크기", combination: "X" },
              sortOrder: 2,
            },
            {
              id: "q-size-y",
              sectionId: "section-multi",
              title: "크기 Y",
              description: null,
              type: "score",
              config: { category: "크기", combination: "Y" },
              sortOrder: 3,
            },
          ],
        },
      ],
    };

    const responses = createResponses();
    const answers: Answer[] = [
      { id: "a1", responseId: "resp-1", questionId: "q-color-a", value: "5" },
      { id: "a2", responseId: "resp-1", questionId: "q-color-b", value: "3" },
      { id: "a3", responseId: "resp-1", questionId: "q-size-x", value: "2" },
      { id: "a4", responseId: "resp-1", questionId: "q-size-y", value: "5" },
      { id: "a5", responseId: "resp-2", questionId: "q-color-a", value: "4" },
      { id: "a6", responseId: "resp-2", questionId: "q-color-b", value: "5" },
      { id: "a7", responseId: "resp-2", questionId: "q-size-x", value: "5" },
      { id: "a8", responseId: "resp-2", questionId: "q-size-y", value: "3" },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const scoreTable = stats.sectionGroups[0].tables.find(
      (table) => table.type === "score"
    );

    expect(scoreTable?.type).toBe("score");
    if (scoreTable?.type === "score") {
      const colorA = scoreTable.data.items.find(
        (item) => item.itemId === "q-color-a"
      );
      const colorB = scoreTable.data.items.find(
        (item) => item.itemId === "q-color-b"
      );
      const sizeX = scoreTable.data.items.find(
        (item) => item.itemId === "q-size-x"
      );
      const sizeY = scoreTable.data.items.find(
        (item) => item.itemId === "q-size-y"
      );

      expect(colorA?.averageRank).toBe(1);
      expect(colorB?.averageRank).toBe(2);
      expect(sizeX?.averageRank).toBe(2);
      expect(sizeY?.averageRank).toBe(1);
    }
  });
});
