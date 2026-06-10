import { describe, expect, it } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";
import type { Answer, Response, SurveyDetail } from "./types";

function createSurvey(): SurveyDetail {
  return {
    id: "survey-1",
    title: "테스트 조사",
    slug: "test-survey",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    },
    {
      id: "resp-2",
      surveyId: "survey-1",
      submittedAt: "2026-01-03T00:00:00.000Z",
      participantName: "김영희",
      gender: "female",
      ageGroup: "30s",
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
                selectCount: 1,
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
      expect(choiceTable.data.options).toEqual([
        { option: "빨강", count: 1, percent: 50 },
        { option: "파랑", count: 1, percent: 50 },
      ]);
      expect(
        choiceTable.data.options.some((row) => row.option === "노랑")
      ).toBe(false);
    }
  });

  it("groups text responses by preceding ranking rank1 in black section", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        {
          id: "section-black",
          surveyId: "survey-1",
          title: "블랙",
          description: null,
          sortOrder: 0,
          questions: [
            {
              id: "q-rank-black",
              sectionId: "section-black",
              title: "그룹 순위",
              description: null,
              type: "ranking",
              config: { combinations: ["믹스그룹", "레드그룹"] },
              sortOrder: 0,
            },
            {
              id: "q-text-black",
              sectionId: "section-black",
              title: "의견",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    const responses = createResponses();
    const answers: Answer[] = [
      {
        id: "a7",
        responseId: "resp-1",
        questionId: "q-rank-black",
        value: JSON.stringify({ rank1: "믹스그룹", rank2: "레드그룹" }),
      },
      {
        id: "a8",
        responseId: "resp-1",
        questionId: "q-text-black",
        value: "블랙 믹스 의견",
      },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const textTable = stats.sectionGroups[0].tables.find(
      (table) => table.type === "text"
    );

    expect(textTable?.type).toBe("text");
    if (textTable?.type === "text") {
      expect(textTable.data.groupedByRank1).toBe(true);
      const mixGroup = textTable.data.groups.find(
        (group) => group.groupName === "믹스그룹"
      );
      expect(mixGroup?.items[0]?.responses[0]?.value).toBe("블랙 믹스 의견");
    }
  });

  it("groups text responses by preceding ranking rank1 in section 2", () => {
    const survey: SurveyDetail = {
      ...createSurvey(),
      sections: [
        createSurvey().sections[0],
        {
          id: "section-2",
          surveyId: "survey-1",
          title: "그레이",
          description: null,
          sortOrder: 1,
          questions: [
            {
              id: "q-rank-gray",
              sectionId: "section-2",
              title: "그룹 순위",
              description: null,
              type: "ranking",
              config: { combinations: ["믹스그룹", "레드그룹"] },
              sortOrder: 0,
            },
            {
              id: "q-text-gray",
              sectionId: "section-2",
              title: "의견",
              description: null,
              type: "text",
              config: { maxLength: 500 },
              sortOrder: 1,
            },
          ],
        },
      ],
    };

    const responses = createResponses();
    const answers: Answer[] = [
      ...createAnswers(),
      {
        id: "a7",
        responseId: "resp-1",
        questionId: "q-rank-gray",
        value: JSON.stringify({ rank1: "믹스그룹", rank2: "레드그룹" }),
      },
      {
        id: "a8",
        responseId: "resp-1",
        questionId: "q-text-gray",
        value: "믹스 의견",
      },
      {
        id: "a9",
        responseId: "resp-2",
        questionId: "q-rank-gray",
        value: JSON.stringify({ rank1: "레드그룹", rank2: "믹스그룹" }),
      },
      {
        id: "a10",
        responseId: "resp-2",
        questionId: "q-text-gray",
        value: "레드 의견",
      },
    ];

    const stats = computeDashboardStats(survey, responses, answers);
    const textTable = stats.sectionGroups[1].tables.find(
      (table) => table.type === "text"
    );

    expect(textTable?.type).toBe("text");
    if (textTable?.type === "text") {
      expect(textTable.data.groupedByRank1).toBe(true);
      const mixGroup = textTable.data.groups.find(
        (group) => group.groupName === "믹스그룹"
      );
      const redGroup = textTable.data.groups.find(
        (group) => group.groupName === "레드그룹"
      );
      expect(mixGroup?.items[0]?.responses[0]?.value).toBe("믹스 의견");
      expect(redGroup?.items[0]?.responses[0]?.value).toBe("레드 의견");
    }
  });
});
