import { demographicKey } from "./demographic-utils";
import {
  findFinalDesignScoreQuestions,
  getFinalDesignRank1Combinations,
  getFinalDesignRank1ForResponse,
} from "./final-design-utils";
import type {
  AgeGroup,
  Answer,
  Gender,
  Question,
  Response,
  SurveyDetail,
  TextDemographicItemStats,
  TextReasonEntry,
} from "./types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "./types";

function emptyDemographicBuckets(
  rank1Names: string[],
  ageGroups: AgeGroup[]
): Record<string, Record<string, string[]>> {
  const buckets: Record<string, Record<string, string[]>> = {};

  for (const rank1Name of rank1Names) {
    buckets[rank1Name] = {};
    for (const ageGroup of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        buckets[rank1Name][demographicKey(ageGroup, gender)] = [];
      }
    }
  }

  return buckets;
}

export function buildTextDemographicItems(
  survey: SurveyDetail,
  textQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[]
): {
  groupedByFinalDesignRank1: boolean;
  rank1Names: string[];
  items: TextDemographicItemStats[];
} {
  const finalDesignQuestions = findFinalDesignScoreQuestions(survey);
  const rank1Names = getFinalDesignRank1Combinations(finalDesignQuestions);
  const groupedByFinalDesignRank1 =
    finalDesignQuestions.length > 0 && rank1Names.length > 0;
  const effectiveRank1Names = groupedByFinalDesignRank1 ? rank1Names : ["전체"];

  const items = textQuestions.map((question) => {
    const byRank1Demographic = emptyDemographicBuckets(
      effectiveRank1Names,
      ageGroups
    );
    const entriesByRank1: Record<string, TextReasonEntry[]> =
      Object.fromEntries(effectiveRank1Names.map((name) => [name, []]));

    for (const response of responses) {
      const rank1 = groupedByFinalDesignRank1
        ? getFinalDesignRank1ForResponse(
            response.id,
            finalDesignQuestions,
            answers
          )
        : "전체";
      if (!rank1 || !response.gender || !response.ageGroup) continue;

      const textAnswer = answers.find(
        (answer) =>
          answer.responseId === response.id && answer.questionId === question.id
      );
      const value = textAnswer?.value?.trim();
      if (!value) continue;

      const key = demographicKey(response.ageGroup, response.gender);
      byRank1Demographic[rank1]?.[key]?.push(value);
      entriesByRank1[rank1]?.push({
        reason: value,
        gender: response.gender,
        ageGroup: response.ageGroup,
        demographicValues: response.demographicValues,
      });
    }

    return {
      questionId: question.id,
      questionTitle: question.title,
      byRank1Demographic,
      entriesByRank1,
    };
  });

  return {
    groupedByFinalDesignRank1,
    rank1Names: effectiveRank1Names,
    items,
  };
}

export function mergeTextEntriesByRank1(
  items: TextDemographicItemStats[]
): Record<string, TextReasonEntry[]> {
  const merged: Record<string, TextReasonEntry[]> = {};

  for (const item of items) {
    for (const [rank1Name, entries] of Object.entries(item.entriesByRank1)) {
      merged[rank1Name] = [...(merged[rank1Name] ?? []), ...entries];
    }
  }

  return merged;
}

export function mergeTextDemographicItems(
  items: TextDemographicItemStats[]
): Record<string, Record<string, string[]>> {
  if (items.length === 0) return {};

  const merged: Record<string, Record<string, string[]>> = {};

  for (const item of items) {
    for (const [rank1Name, demographicCells] of Object.entries(
      item.byRank1Demographic
    )) {
      if (!merged[rank1Name]) merged[rank1Name] = {};
      for (const [key, values] of Object.entries(demographicCells)) {
        merged[rank1Name][key] = [...(merged[rank1Name][key] ?? []), ...values];
      }
    }
  }

  return merged;
}

export function textDemographicHeaderRow(ageGroups: AgeGroup[]): string[] {
  return ageGroups.flatMap((ageGroup) => [
    `${AGE_GROUP_LABELS[ageGroup]} ${GENDER_LABELS.male}`,
    `${AGE_GROUP_LABELS[ageGroup]} ${GENDER_LABELS.female}`,
  ]);
}

export function textDemographicValueRow(
  ageGroups: AgeGroup[],
  cells: Record<string, string[]>
): string[] {
  return ageGroups.flatMap((ageGroup) =>
    (["male", "female"] as Gender[]).map((gender) => {
      const values = cells[demographicKey(ageGroup, gender)] ?? [];
      return values.length > 0 ? values.join("\n") : "-";
    })
  );
}
