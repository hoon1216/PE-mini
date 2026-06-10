export interface RankingAnswer {
  rank1: string;
  rank2: string;
  rank3?: string;
}

export type RankingField = "rank1" | "rank2" | "rank3";

export function maxRankingSlots(combinationCount: number): 2 | 3 {
  return combinationCount > 3 ? 3 : 2;
}

export function emptyRankingAnswer(): RankingAnswer {
  return { rank1: "", rank2: "", rank3: "" };
}

export function normalizeRankingAnswer(
  raw?: Partial<RankingAnswer> | null
): RankingAnswer {
  return {
    rank1: raw?.rank1 ?? "",
    rank2: raw?.rank2 ?? "",
    rank3: raw?.rank3 ?? "",
  };
}

export function availableCombinationsForRank(
  combinations: string[],
  ranking: RankingAnswer,
  field: RankingField
): string[] {
  const used = new Set<string>();
  if (field !== "rank1" && ranking.rank1) used.add(ranking.rank1);
  if (field !== "rank2" && ranking.rank2) used.add(ranking.rank2);
  if (field !== "rank3" && ranking.rank3) used.add(ranking.rank3);
  return combinations.filter((combo) => !used.has(combo));
}

export function validateRankingAnswer(
  ranking: RankingAnswer | undefined,
  combinationCount: number
): string | null {
  const normalized = normalizeRankingAnswer(ranking);
  const slots = maxRankingSlots(combinationCount);

  if (!normalized.rank1 || !normalized.rank2) {
    return "순위를 모두 선택해주세요.";
  }

  const selected = [normalized.rank1, normalized.rank2];
  if (slots === 3) {
    if (!normalized.rank3) {
      return "3순위를 선택해주세요.";
    }
    selected.push(normalized.rank3);
  }

  if (new Set(selected).size !== selected.length) {
    return "순위는 서로 달라야 합니다.";
  }

  return null;
}

export function serializeRankingAnswer(
  ranking: RankingAnswer,
  combinationCount: number
): string {
  const normalized = normalizeRankingAnswer(ranking);
  const payload: { rank1: string; rank2: string; rank3?: string } = {
    rank1: normalized.rank1,
    rank2: normalized.rank2,
  };

  if (maxRankingSlots(combinationCount) === 3 && normalized.rank3) {
    payload.rank3 = normalized.rank3;
  }

  return JSON.stringify(payload);
}
