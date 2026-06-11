import { describe, expect, it } from "vitest";
import {
  SubmitValidationError,
  validateSubmitResponse,
} from "./submit-validation";
import type { SurveyDetail } from "./types";

const survey: SurveyDetail = {
  id: "survey-1",
  title: "테스트",
  slug: "test",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sections: [
    {
      id: "section-1",
      surveyId: "survey-1",
      title: "섹션",
      description: null,
      sortOrder: 0,
      questions: [
        {
          id: "q-score",
          sectionId: "section-1",
          title: "점수",
          description: null,
          type: "score",
          config: { category: "색상", combination: "A" },
          sortOrder: 0,
        },
        {
          id: "q-rank",
          sectionId: "section-1",
          title: "순위",
          description: null,
          type: "ranking",
          config: { combinations: ["A", "B", "C"] },
          sortOrder: 1,
        },
        {
          id: "q-choice",
          sectionId: "section-1",
          title: "객관식",
          description: null,
          type: "choice",
          config: { options: ["옵션1", "옵션2", "옵션3"] },
          sortOrder: 2,
        },
      ],
    },
  ],
};

describe("validateSubmitResponse", () => {
  it("accepts valid payload", () => {
    expect(() =>
      validateSubmitResponse(survey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [
          { questionId: "q-score", value: "4" },
          {
            questionId: "q-rank",
            value: JSON.stringify({ rank1: "A", rank2: "B", rank3: "C" }),
          },
          { questionId: "q-choice", value: "옵션2" },
        ],
      })
    ).not.toThrow();
  });

  it("rejects invalid gender", () => {
    expect(() =>
      validateSubmitResponse(survey, {
        participantName: "홍길동",
        gender: "other" as "male",
        ageGroup: "20s",
        answers: [
          { questionId: "q-score", value: "4" },
          {
            questionId: "q-rank",
            value: JSON.stringify({ rank1: "A", rank2: "B", rank3: "C" }),
          },
        ],
      })
    ).toThrow(SubmitValidationError);
  });

  it("rejects unknown question id", () => {
    expect(() =>
      validateSubmitResponse(survey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [{ questionId: "unknown", value: "4" }],
      })
    ).toThrow("조사에 없는 문항에 답변했습니다.");
  });

  it("rejects missing answers", () => {
    expect(() =>
      validateSubmitResponse(survey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [{ questionId: "q-score", value: "4" }],
      })
    ).toThrow("모든 문항에 답변해주세요.");
  });

  it("rejects invalid choice option", () => {
    expect(() =>
      validateSubmitResponse(survey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [
          { questionId: "q-score", value: "4" },
          {
            questionId: "q-rank",
            value: JSON.stringify({ rank1: "A", rank2: "B", rank3: "C" }),
          },
          { questionId: "q-choice", value: "없는옵션" },
        ],
      })
    ).toThrow("유효하지 않은 선택지입니다.");
  });

  it("accepts multi-select choice with one or more options", () => {
    const multiSurvey: SurveyDetail = {
      ...survey,
      sections: [
        {
          ...survey.sections[0],
          questions: [
            {
              id: "q-multi",
              sectionId: "section-1",
              title: "객관식",
              description: null,
              type: "choice",
              config: {
                options: ["옵션1", "옵션2", "옵션3"],
                selectionMode: "multiple",
              },
              sortOrder: 0,
            },
          ],
        },
      ],
    };

    expect(() =>
      validateSubmitResponse(multiSurvey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [
          {
            questionId: "q-multi",
            value: JSON.stringify(["옵션1", "옵션3"]),
          },
        ],
      })
    ).not.toThrow();

    expect(() =>
      validateSubmitResponse(multiSurvey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [
          {
            questionId: "q-multi",
            value: JSON.stringify(["옵션1"]),
          },
        ],
      })
    ).not.toThrow();
  });

  it("rejects multi-select choice with no selection", () => {
    const multiSurvey: SurveyDetail = {
      ...survey,
      sections: [
        {
          ...survey.sections[0],
          questions: [
            {
              id: "q-multi",
              sectionId: "section-1",
              title: "객관식",
              description: null,
              type: "choice",
              config: {
                options: ["옵션1", "옵션2", "옵션3"],
                selectionMode: "multiple",
              },
              sortOrder: 0,
            },
          ],
        },
      ],
    };

    expect(() =>
      validateSubmitResponse(multiSurvey, {
        participantName: "홍길동",
        gender: "male",
        ageGroup: "20s",
        answers: [{ questionId: "q-multi", value: JSON.stringify([]) }],
      })
    ).toThrow("객관식 문항에서 선택지를 선택해주세요.");
  });
});
