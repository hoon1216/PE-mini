import { describe, expect, it } from "vitest";
import {
  buildScoreCompareDashboardSegments,
  buildScoreCompareScoreStats,
} from "./score-compare-stats";
import type { Answer, Question, Response } from "./types";

describe("score-compare-stats", () => {
  it("orders dashboard segments as total, custom fields, gender, age", () => {
    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "20s",
        demographicValues: { field1: "보유" },
      },
    ];

    const segments = buildScoreCompareDashboardSegments(
      [
        { id: "field1", label: "가전보유", options: ["보유", "미보유"] },
        { id: "field2", label: "프로젝터", options: ["있음", "없음"] },
      ],
      responses
    );

    expect(segments.map((segment) => segment.groupLabel)).toEqual([
      "전체",
      "가전보유",
      "가전보유",
      "프로젝터",
      "프로젝터",
      "성별",
      "성별",
      "연령대",
    ]);
  });

  it("builds score-only cells without ranks", () => {
    const question: Question = {
      id: "q-compare",
      sectionId: "section-1",
      title: "비교",
      description: null,
      type: "score-compare",
      config: {
        category: "최종",
        combinations: ["A안", "B안"],
        includeReason: true,
      },
      sortOrder: 0,
    };

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
      {
        id: "resp-2",
        surveyId: "survey-1",
        submittedAt: "2026-01-02T00:00:00.000Z",
        participantName: "B",
        gender: "female",
        ageGroup: "30s",
        demographicValues: {},
      },
    ];

    const answers: Answer[] = [
      {
        id: "a1",
        responseId: "resp-1",
        questionId: "q-compare",
        value: JSON.stringify({ scores: { "A안": 6, "B안": 4 }, reason: "A" }),
      },
      {
        id: "a2",
        responseId: "resp-2",
        questionId: "q-compare",
        value: JSON.stringify({ scores: { "A안": 4, "B안": 6 }, reason: "B" }),
      },
    ];

    const stats = buildScoreCompareScoreStats(
      [question],
      responses,
      answers,
      []
    );

    expect(stats.items).toHaveLength(2);
    expect(stats.items[0].bySegment.total).toBe(5);
    expect(stats.items[1].bySegment.total).toBe(5);
    expect(stats.items[0].bySegment["gender-male"]).toBe(6);
    expect(stats.items[1].bySegment["gender-female"]).toBe(6);
  });
});
