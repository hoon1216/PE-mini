import { describe, expect, it } from "vitest";
import {
  buildChoiceDashboardStats,
  formatChoiceSegmentCell,
} from "./choice-dashboard-stats";
import type { Answer, Question, Response } from "./types";

describe("choice-dashboard-stats", () => {
  it("orders dashboard segments without total average", () => {
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

    const question: Question = {
      id: "q-choice",
      sectionId: "section-1",
      title: "색상 선택",
      description: null,
      type: "choice",
      config: {
        category: "색상",
        options: ["A", "B"],
        selectionMode: "single",
      },
      sortOrder: 0,
    };

    const stats = buildChoiceDashboardStats(
      [question],
      responses,
      [{ id: "a1", responseId: "resp-1", questionId: "q-choice", value: "A" }],
      [{ id: "field1", label: "가전보유", options: ["보유", "미보유"] }]
    );

    expect(stats.segments.map((segment) => segment.groupLabel)).toEqual([
      "가전보유",
      "가전보유",
      "성별",
      "성별",
      "연령대",
    ]);
    expect(stats.items[0].bySegment["gender-male"]).toEqual({
      count: 1,
      percent: 100,
    });
  });

  it("formats segment cells as count and percent", () => {
    expect(formatChoiceSegmentCell({ count: 3, percent: 37.5 })).toBe(
      "3 (37.5%)"
    );
    expect(formatChoiceSegmentCell(null)).toBe("-");
  });
});
