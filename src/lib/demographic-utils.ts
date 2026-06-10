import type { AgeGroup, Gender } from "./types";

export const AGE_GROUP_ORDER: AgeGroup[] = [
  "10s",
  "20s",
  "30s",
  "40s",
  "50s",
  "60s",
];

export function demographicKey(age: AgeGroup, gender: Gender): string {
  return `${age}-${gender}`;
}

export function getPresentAgeGroups(
  responses: { ageGroup: AgeGroup | null }[]
): AgeGroup[] {
  const present = new Set<AgeGroup>();
  for (const response of responses) {
    if (response.ageGroup) present.add(response.ageGroup);
  }
  return AGE_GROUP_ORDER.filter((age) => present.has(age));
}

export function parseRankingAnswer(
  value: string
): { rank1: string; rank2: string; rank3?: string } | null {
  try {
    const parsed = JSON.parse(value) as {
      rank1?: string;
      rank2?: string;
      rank3?: string;
    };
    if (!parsed.rank1 || !parsed.rank2) return null;
    return {
      rank1: parsed.rank1,
      rank2: parsed.rank2,
      rank3: parsed.rank3,
    };
  } catch {
    return null;
  }
}
