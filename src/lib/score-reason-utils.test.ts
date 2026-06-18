import { describe, expect, it } from "vitest";
import {
  getWinningCombinations,
  parseScoreReasonAnswer,
  serializeScoreReasonAnswer,
  validateScoreCompareQuestion,
} from "./score-reason-utils";
import type { Question } from "./types";

function createQuestion(
  combinations: string[],
  includeReason = false
): Question {
  return {
    id: "q-score-compare",
    sectionId: "section-1",
    title: "안 점수 비교",
    description: null,
    type: "score-compare",
    config: {
      category: "최종 디자인",
      combinations,
      includeReason,
      reasonMaxLength: 500,
    },
    sortOrder: 0,
  };
}

describe("score-compare-utils", () => {
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

  it("requires reason only when includeReason is enabled", () => {
    const question = createQuestion(["디자인안 A", "디자인안 B"], true);

    expect(
      validateScoreCompareQuestion(question, {
        scores: { "디자인안 A": "6", "디자인안 B": "4" },
        reason: "",
      })
    ).toBe("이유를 입력해주세요.");

    expect(
      validateScoreCompareQuestion(question, {
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

  it("rejects duplicate scores across design options", () => {
    const question = createQuestion(["디자인안 A", "디자인안 B"]);

    expect(
      validateScoreCompareQuestion(question, {
        scores: { "디자인안 A": "5", "디자인안 B": "5" },
        reason: "",
      })
    ).toBe("디자인 안마다 서로 다른 점수를 선택해주세요.");
  });
});
