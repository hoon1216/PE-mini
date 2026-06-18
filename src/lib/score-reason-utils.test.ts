import { describe, expect, it } from "vitest";
import {
  getWinningCombinations,
  parseScoreReasonAnswer,
  serializeScoreReasonAnswer,
  validateScoreReasonQuestion,
} from "./score-reason-utils";
import type { Question } from "./types";

function createQuestion(combinations: string[]): Question {
  return {
    id: "q-score-reason",
    sectionId: "section-1",
    title: "점수 및 이유",
    description: null,
    type: "score-reason",
    config: {
      category: "최종 디자인",
      combinations,
      maxLength: 500,
    },
    sortOrder: 0,
  };
}

describe("score-reason-utils", () => {
  it("serializes and parses multi-design answers", () => {
    const value = serializeScoreReasonAnswer(
      { "디자인안 A": "6", "디자인안 B": "4" },
      "심플해서 좋음"
    );
    expect(parseScoreReasonAnswer(value, ["디자인안 A", "디자인안 B"])).toEqual({
      scores: { "디자인안 A": 6, "디자인안 B": 4 },
      reason: "심플해서 좋음",
    });
  });

  it("requires reason for the highest-scored design option", () => {
    const question = createQuestion(["디자인안 A", "디자인안 B"]);

    expect(
      validateScoreReasonQuestion(question, {
        scores: { "디자인안 A": "6", "디자인안 B": "4" },
        reason: "",
      })
    ).toBe("가장 높은 점수를 준 디자인안에 대한 이유를 입력해주세요.");

    expect(
      validateScoreReasonQuestion(question, {
        scores: { "디자인안 A": "6", "디자인안 B": "4" },
        reason: "색감이 좋음",
      })
    ).toBeNull();
  });

  it("finds winning design options", () => {
    const question = createQuestion(["디자인안 A", "디자인안 B"]);

    expect(
      getWinningCombinations(question, {
        scores: { "디자인안 A": "5", "디자인안 B": "7" },
        reason: "",
      })
    ).toEqual(["디자인안 B"]);
  });
});
