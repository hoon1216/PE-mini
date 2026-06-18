import { describe, expect, it } from "vitest";
import {
  getWinningQuestionIdsInCategory,
  parseScoreReasonAnswer,
  serializeScoreReasonAnswer,
  validateScoreReasonCategory,
} from "./score-reason-utils";
import type { Question } from "./types";

function createQuestion(
  id: string,
  category: string,
  combination: string
): Question {
  return {
    id,
    sectionId: "section-1",
    title: combination,
    description: null,
    type: "score-reason",
    config: {
      category,
      combination,
      maxLength: 500,
    },
    sortOrder: 0,
  };
}

describe("score-reason-utils", () => {
  it("serializes and parses score-reason answers", () => {
    const value = serializeScoreReasonAnswer("6", "심플해서 좋음");
    expect(parseScoreReasonAnswer(value)).toEqual({
      score: 6,
      reason: "심플해서 좋음",
    });
  });

  it("requires reason only for the highest score in a category", () => {
    const questions = [
      createQuestion("q-a", "최종 디자인", "A안"),
      createQuestion("q-b", "최종 디자인", "B안"),
    ];

    expect(
      validateScoreReasonCategory(questions, {
        "q-a": { score: "6", reason: "" },
        "q-b": { score: "4", reason: "" },
      })
    ).toBe("가장 높은 점수를 준 디자인 안에 대한 이유를 입력해주세요.");

    expect(
      validateScoreReasonCategory(questions, {
        "q-a": { score: "6", reason: "색감이 좋음" },
        "q-b": { score: "4", reason: "" },
      })
    ).toBeNull();
  });

  it("finds winning question ids", () => {
    const questions = [
      createQuestion("q-a", "최종 디자인", "A안"),
      createQuestion("q-b", "최종 디자인", "B안"),
    ];

    expect(
      getWinningQuestionIdsInCategory(questions, {
        "q-a": { score: "5", reason: "" },
        "q-b": { score: "7", reason: "" },
      })
    ).toEqual(["q-b"]);
  });
});
