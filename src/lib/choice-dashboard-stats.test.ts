import { describe, expect, it } from "vitest";
import {
  buildChoiceDashboardStats,
  getChoiceItemLabelRowSpans,
} from "./choice-dashboard-stats";
import type { Question, Response } from "./types";

describe("choice-dashboard-stats", () => {
  it("orders dashboard segments with total column labeled 전체", () => {
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
      "전체",
      "가전보유",
      "가전보유",
      "성별",
      "성별",
      "연령대",
    ]);
    expect(stats.segments[0].label).toBe("전체");
    expect(stats.items[0]).toMatchObject({
      category: "색상",
      itemLabel: "색상 선택",
      option: "A",
    });
    expect(stats.items[0].bySegment.total).toEqual({ count: 1, percent: 100 });
    expect(stats.items[1].bySegment.total).toBeNull();
  });

  it("uses question title only in 구분 when category matches title", () => {
    const question: Question = {
      id: "q-choice",
      sectionId: "section-1",
      title: "선호하는 안 선택",
      description: null,
      type: "choice",
      config: {
        category: "선호하는 안 선택",
        options: ["선택지 A", "선택지 B"],
        selectionMode: "single",
      },
      sortOrder: 0,
    };

    const stats = buildChoiceDashboardStats([question], [], [], []);

    expect(stats.items[0]).toMatchObject({
      category: null,
      itemLabel: "선호하는 안 선택",
      option: "선택지 A",
    });
  });

  it("includes questions whose category is 없음 without a 구분 column", () => {
    const noCategory: Question = {
      id: "q-no-category",
      sectionId: "section-1",
      title: "선호하는 안 선택",
      description: null,
      type: "choice",
      config: {
        category: "없음",
        options: ["선택지 A"],
        selectionMode: "single",
      },
      sortOrder: 0,
    };

    const stats = buildChoiceDashboardStats([noCategory], [], [], []);

    expect(stats.items).toHaveLength(1);
    expect(stats.items[0]).toMatchObject({
      category: null,
      itemLabel: "선호하는 안 선택",
      option: "선택지 A",
    });
    expect(stats.showCategoryColumn).toBe(false);
  });

  it("shows 구분 column when any item has a category", () => {
    const withCategory: Question = {
      id: "q-with-category",
      sectionId: "section-1",
      title: "색상 선택",
      description: null,
      type: "choice",
      config: {
        category: "색상",
        options: ["A"],
        selectionMode: "single",
      },
      sortOrder: 0,
    };
    const withoutCategory: Question = {
      id: "q-without-category",
      sectionId: "section-1",
      title: "기타",
      description: null,
      type: "choice",
      config: {
        category: "없음",
        options: ["B"],
        selectionMode: "single",
      },
      sortOrder: 1,
    };

    const stats = buildChoiceDashboardStats(
      [withCategory, withoutCategory],
      [],
      [],
      []
    );

    expect(stats.items).toHaveLength(2);
    expect(stats.showCategoryColumn).toBe(true);
  });

  it("returns null spans for continuation rows in getChoiceItemLabelRowSpans", () => {
    const spans = getChoiceItemLabelRowSpans([
      { category: null, itemLabel: "선호하는 안 선택" },
      { category: null, itemLabel: "선호하는 안 선택" },
      { category: null, itemLabel: "선호하는 안 선택" },
    ]);

    expect(spans).toEqual([3, null, null]);
  });
});
