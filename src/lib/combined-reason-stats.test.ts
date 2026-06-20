import { describe, expect, it } from "vitest";
import {
  buildCombinedReasonSectionStatsForChoiceOption,
} from "./combined-reason-stats";
import type { Answer, Question, Response } from "./types";

describe("combined-reason-stats", () => {
  it("builds choice reason entries per selected option", () => {
    const question: Question = {
      id: "q-choice",
      sectionId: "section-1",
      title: "선호하는 안 선택",
      description: null,
      type: "choice",
      config: {
        options: ["선택지 A", "선택지 B", "선택지 C"],
        selectionMode: "single",
        includeReason: true,
      },
      sortOrder: 0,
    };

    const section = {
      id: "section-1",
      surveyId: "survey-1",
      title: "선호도",
      description: null,
      sortOrder: 0,
    };

    const responses: Response[] = [
      {
        id: "resp-1",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "A",
        gender: "male",
        ageGroup: "30s",
        demographicValues: {},
      },
      {
        id: "resp-2",
        surveyId: "survey-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        participantName: "B",
        gender: "female",
        ageGroup: "40s",
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
          reason: "A를 선택한 이유",
        }),
      },
      {
        id: "a2",
        responseId: "resp-2",
        questionId: "q-choice",
        value: JSON.stringify({
          selected: ["선택지 B"],
          reason: "B를 선택한 이유",
        }),
      },
    ];

    const optionA = buildCombinedReasonSectionStatsForChoiceOption(
      section,
      question,
      "선택지 A",
      responses,
      answers,
      ["30s", "40s"],
      []
    );
    const optionB = buildCombinedReasonSectionStatsForChoiceOption(
      section,
      question,
      "선택지 B",
      responses,
      answers,
      ["30s", "40s"],
      []
    );
    const optionC = buildCombinedReasonSectionStatsForChoiceOption(
      section,
      question,
      "선택지 C",
      responses,
      answers,
      ["30s", "40s"],
      []
    );

    expect(optionA?.entries.map((entry) => entry.reason)).toEqual([
      "A를 선택한 이유",
    ]);
    expect(optionB?.entries.map((entry) => entry.reason)).toEqual([
      "B를 선택한 이유",
    ]);
    expect(optionC).toBeNull();
  });
});
