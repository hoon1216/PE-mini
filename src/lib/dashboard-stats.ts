import type {
  AgeGroup,
  Answer,
  DashboardStats,
  DemographicCell,
  DemographicStats,
  Gender,
  Question,
  RankingCombinationStats,
  RankingQuestionConfig,
  RankingSectionStats,
  Response,
  ScoreQuestionConfig,
  ScoreSectionStats,
  Section,
  SurveyDetail,
} from "./types";
import {
  demographicKey,
  getPresentAgeGroups,
  parseRankingAnswer,
} from "./demographic-utils";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function computeRanks(
  items: { id: string; scores: number[] }[]
): Map<string, number | null> {
  const avgs = items.map((item) => ({
    id: item.id,
    avg: average(item.scores),
  }));
  const valid = avgs
    .filter((item) => item.avg !== null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  const ranks = new Map<string, number | null>();
  let rank = 1;
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i].avg !== valid[i - 1].avg) rank = i + 1;
    ranks.set(valid[i].id, rank);
  }
  for (const item of avgs) {
    if (!ranks.has(item.id)) ranks.set(item.id, null);
  }
  return ranks;
}

function buildDemographics(responses: Response[]): DemographicStats {
  const byAgeGroup: Partial<Record<AgeGroup, number>> = {};
  let male = 0;
  let female = 0;

  for (const response of responses) {
    if (response.gender === "male") male += 1;
    if (response.gender === "female") female += 1;
    if (response.ageGroup) {
      byAgeGroup[response.ageGroup] = (byAgeGroup[response.ageGroup] ?? 0) + 1;
    }
  }

  return {
    total: responses.length,
    male,
    female,
    ageGroups: getPresentAgeGroups(responses),
    byAgeGroup,
  };
}

function scoreForItem(
  answers: Answer[],
  responseId: string,
  itemId: string
): number | null {
  const answer = answers.find(
    (a) => a.responseId === responseId && a.questionId === itemId
  );
  if (!answer) return null;
  const score = Number(answer.value);
  return Number.isFinite(score) ? score : null;
}

function buildScoreSectionStats(
  section: Section,
  scoreQuestions: Question[],
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[]
): ScoreSectionStats {
  const items = scoreQuestions.map((question) => {
    const config = question.config as ScoreQuestionConfig;
    return {
      id: question.id,
      category: config.category,
      combination: config.combination,
    };
  });

  const overallScores = items.map((item) => ({
    id: item.id,
    scores: responses
      .map((r) => scoreForItem(answers, r.id, item.id))
      .filter((s): s is number => s !== null),
  }));
  const overallRanks = computeRanks(overallScores);

  const itemStats = items.map((item) => {
    const byDemographic: Record<string, DemographicCell> = {};

    for (const age of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        const key = demographicKey(age, gender);
        const filtered = responses.filter(
          (r) => r.ageGroup === age && r.gender === gender
        );
        const scores = filtered
          .map((r) => scoreForItem(answers, r.id, item.id))
          .filter((s): s is number => s !== null);

        const demoItems = items.map((it) => ({
          id: it.id,
          scores: filtered
            .map((r) => scoreForItem(answers, r.id, it.id))
            .filter((s): s is number => s !== null),
        }));
        const demoRanks = computeRanks(demoItems);

        byDemographic[key] = {
          score: average(scores),
          rank: demoRanks.get(item.id) ?? null,
        };
      }
    }

    return {
      itemId: item.id,
      category: item.category,
      combination: item.combination,
      averageScore: average(
        overallScores.find((s) => s.id === item.id)?.scores ?? []
      ),
      averageRank: overallRanks.get(item.id) ?? null,
      byDemographic,
    };
  });

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    ageGroups,
    items: itemStats,
  };
}

function buildRankingSectionStats(
  section: Section,
  question: Question,
  responses: Response[],
  answers: Answer[],
  ageGroups: AgeGroup[]
): RankingSectionStats {
  const config = question.config as RankingQuestionConfig;
  const total = responses.length;

  const combinations = config.combinations.map((combination) => {
    let rank1Count = 0;
    let rank2Count = 0;
    let rank3Count = 0;
    const byDemographic: Record<string, { count: number; percent: number }> =
      {};

    for (const age of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        byDemographic[demographicKey(age, gender)] = { count: 0, percent: 0 };
      }
    }

    for (const response of responses) {
      const answer = answers.find(
        (a) => a.responseId === response.id && a.questionId === question.id
      );
      if (!answer) continue;

      const parsed = parseRankingAnswer(answer.value);
      if (!parsed) continue;

      if (parsed.rank1 === combination) rank1Count += 1;
      if (parsed.rank2 === combination) rank2Count += 1;
      if (parsed.rank3 === combination) rank3Count += 1;

      if (
        response.ageGroup &&
        response.gender &&
        parsed.rank1 === combination
      ) {
        const key = demographicKey(response.ageGroup, response.gender);
        if (byDemographic[key]) {
          byDemographic[key].count += 1;
        }
      }
    }

    const rank12Count = rank1Count + rank2Count;
    const rank123Count = rank1Count + rank2Count + rank3Count;

    for (const age of ageGroups) {
      for (const gender of ["male", "female"] as Gender[]) {
        const key = demographicKey(age, gender);
        const groupTotal = responses.filter(
          (r) => r.ageGroup === age && r.gender === gender
        ).length;
        const cell = byDemographic[key];
        cell.percent =
          groupTotal > 0
            ? Math.round((cell.count / groupTotal) * 1000) / 10
            : 0;
      }
    }

    return {
      combination,
      rank1Count,
      rank1Percent: total > 0 ? Math.round((rank1Count / total) * 1000) / 10 : 0,
      rank2Count,
      rank3Count,
      rank12Count,
      rank12Percent:
        total > 0 ? Math.round((rank12Count / total) * 1000) / 10 : 0,
      rank123Count,
      rank123Percent:
        total > 0 ? Math.round((rank123Count / total) * 1000) / 10 : 0,
      byDemographic,
    } satisfies RankingCombinationStats;
  });

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    questionTitle: question.title,
    questionId: question.id,
    ageGroups,
    combinations,
  };
}

export function computeDashboardStats(
  survey: SurveyDetail,
  responses: Response[],
  answers: Answer[]
): DashboardStats {
  const demographics = buildDemographics(responses);
  const ageGroups = demographics.ageGroups;

  const sectionGroups = survey.sections.map((section) => {
    const tables: DashboardStats["sectionGroups"][number]["tables"] = [];
    const scoreQuestions = section.questions.filter((q) => q.type === "score");

    if (scoreQuestions.length > 0) {
      tables.push({
        type: "score",
        data: buildScoreSectionStats(
          section,
          scoreQuestions,
          responses,
          answers,
          ageGroups
        ),
      });
    }

    for (const question of section.questions.filter((q) => q.type === "ranking")) {
      tables.push({
        type: "ranking",
        data: buildRankingSectionStats(
          section,
          question,
          responses,
          answers,
          ageGroups
        ),
      });
    }

    return {
      sectionId: section.id,
      sectionTitle: section.title,
      sortOrder: section.sortOrder,
      tables,
    };
  });

  return {
    totalResponses: responses.length,
    demographics,
    sectionGroups,
  };
}
