import { describe, expect, it } from "vitest";
import {
  buildEvaluationSheet,
  formatGroupLabel,
  isPreferenceSection,
} from "./evaluation-sheet-data";
import type { SurveyDetail } from "./types";

function createSurvey(): SurveyDetail {
  return {
    id: "survey-1",
    title: "테스트 조사",
    slug: "test",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: "section-black",
        surveyId: "survey-1",
        title: "블랙",
        description: null,
        sortOrder: 0,
        questions: [
          {
            id: "score-1",
            sectionId: "section-black",
            title: "1.젠틀그린+웜그레이",
            description: null,
            type: "score",
            config: {
              category: "믹스 그룹",
              combination: "1.젠틀그린+웜그레이",
            },
            sortOrder: 0,
          },
          {
            id: "score-2",
            sectionId: "section-black",
            title: "2.프렌치블루+라임 옐로우",
            description: null,
            type: "score",
            config: {
              category: "믹스 그룹",
              combination: "2.프렌치블루+라임 옐로우",
            },
            sortOrder: 1,
          },
          {
            id: "rank-black",
            sectionId: "section-black",
            title: "그룹 순위",
            description: null,
            type: "ranking",
            config: {
              combinations: ["믹스그룹", "레드그룹", "톤온톤그룹"],
            },
            sortOrder: 2,
          },
        ],
      },
      {
        id: "section-pref",
        surveyId: "survey-1",
        title: "선호 순위",
        description: null,
        sortOrder: 2,
        questions: [
          {
            id: "rank-pref",
            sectionId: "section-pref",
            title: "순위 문항",
            description: null,
            type: "ranking",
            config: {
              combinations: ["A", "B", "C", "D", "E", "F"],
            },
            sortOrder: 0,
          },
        ],
      },
    ],
  };
}

describe("evaluation-sheet-data", () => {
  it("formats group labels with spaces", () => {
    expect(formatGroupLabel("믹스그룹")).toBe("믹스 그룹");
    expect(formatGroupLabel("믹스 그룹")).toBe("믹스 그룹");
  });

  it("detects preference section by ranking-only structure", () => {
    const survey = createSurvey();
    expect(isPreferenceSection(survey.sections[0])).toBe(false);
    expect(isPreferenceSection(survey.sections[1])).toBe(true);
  });

  it("builds per-response evaluation sheet", () => {
    const survey = createSurvey();
    const sheet = buildEvaluationSheet(
      survey,
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
      },
      [
        { id: "a1", responseId: "resp-1", questionId: "score-1", value: "5" },
        { id: "a2", responseId: "resp-1", questionId: "score-2", value: "3" },
        {
          id: "a3",
          responseId: "resp-1",
          questionId: "rank-black",
          value: JSON.stringify({
            rank1: "믹스그룹",
            rank2: "레드그룹",
            rank3: "톤온톤그룹",
          }),
        },
        {
          id: "a4",
          responseId: "resp-1",
          questionId: "rank-pref",
          value: JSON.stringify({
            rank1: "A",
            rank2: "B",
            rank3: "C",
          }),
        },
      ]
    );

    expect(sheet.participantName).toBe("홍길동");
    expect(sheet.genderLabel).toBe("남");
    expect(sheet.ageGroupLabel).toBe("20대");
    expect(sheet.bodyColumns).toHaveLength(1);
    expect(sheet.bodyColumns[0].sectionTitle).toBe("블랙");
    expect(sheet.bodyColumns[0].scoreRows[0].score).toBe(5);
    expect(sheet.bodyColumns[0].scoreRows[0].rank).toBe(1);
    expect(sheet.bodyColumns[0].groupRanks[0]).toEqual({
      label: "믹스 그룹",
      rank: 1,
    });
    expect(sheet.preferredGrill.rank1).toBe("A");
    expect(sheet.preferredReason).toBe("A\nB\nC");
  });

  it("includes all selected choice options in preferred reason", () => {
    const survey = createSurvey();
    survey.sections[1].questions.push({
      id: "choice-pref",
      sectionId: "section-pref",
      title: "선호 이유",
      description: null,
      type: "choice",
      config: {
        options: ["색감", "조화", "독특함"],
        selectionMode: "multiple",
      },
      sortOrder: 1,
    });

    const sheet = buildEvaluationSheet(
      survey,
      {
        id: "resp-2",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "김철수",
        gender: "female",
        ageGroup: "30s",
      },
      [
        {
          id: "a1",
          responseId: "resp-2",
          questionId: "rank-pref",
          value: JSON.stringify({
            rank1: "A",
            rank2: "B",
            rank3: "C",
          }),
        },
        {
          id: "a2",
          responseId: "resp-2",
          questionId: "choice-pref",
          value: JSON.stringify(["색감", "독특함"]),
        },
      ]
    );

    expect(sheet.preferredReason).toBe("A\nB\nC\n색감\n독특함");
  });
});
