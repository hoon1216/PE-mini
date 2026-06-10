"use client";

import { ScoreSlider } from "@/components/participant/score-slider";
import type {
  Question,
  RankingQuestionConfig,
  ScoreQuestionConfig,
  Section,
} from "@/lib/types";

function groupScoreQuestionsByCategory(
  questions: Question[]
): { category: string; questions: Question[] }[] {
  const groups: { category: string; questions: Question[] }[] = [];
  const seen = new Set<string>();

  for (const question of questions.filter((q) => q.type === "score")) {
    const category = (question.config as ScoreQuestionConfig).category;
    if (!seen.has(category)) {
      seen.add(category);
      groups.push({ category, questions: [] });
    }
    groups.find((g) => g.category === category)!.questions.push(question);
  }

  return groups;
}

interface SectionQuestionsProps {
  section: Section & { questions: Question[] };
  scores: Record<string, string>;
  rankings: Record<string, { rank1: string; rank2: string }>;
  onScoreChange: (questionId: string, score: number) => void;
  onRankingChange: (
    questionId: string,
    field: "rank1" | "rank2",
    value: string
  ) => void;
}

export function SectionQuestions({
  section,
  scores,
  rankings,
  onScoreChange,
  onRankingChange,
}: SectionQuestionsProps) {
  const scoreGroups = groupScoreQuestionsByCategory(section.questions);
  const rankingQuestions = section.questions.filter((q) => q.type === "ranking");

  return (
    <div className="space-y-5">
      {scoreGroups.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">점수 부과형 (1~5점)</p>
          {scoreGroups.map((group) => (
            <div
              key={group.category}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="mb-3 text-sm font-semibold">{group.category}</p>
              <div className="space-y-3">
                {group.questions.map((question) => {
                  const config = question.config as ScoreQuestionConfig;
                  return (
                    <div
                      key={question.id}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <p className="text-sm font-medium text-muted">
                        {config.combination}
                      </p>
                      <ScoreSlider
                        value={Number(scores[question.id] ?? 3)}
                        onChange={(score) => onScoreChange(question.id, score)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {rankingQuestions.map((question) => {
        const config = question.config as RankingQuestionConfig;
        const ranking = rankings[question.id] ?? { rank1: "", rank2: "" };

        return (
          <div key={question.id} className="space-y-4">
            <p className="text-sm font-medium">
              {question.title !== "순위 문항" ? question.title : "순위 선정"}
            </p>
            <p className="text-xs text-muted">순위 선정형</p>
            <div>
              <label className="mb-1 block text-sm font-medium">1순위</label>
              <select
                value={ranking.rank1}
                onChange={(e) =>
                  onRankingChange(question.id, "rank1", e.target.value)
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {config.combinations.map((combo) => (
                  <option key={combo} value={combo}>
                    {combo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">2순위</label>
              <select
                value={ranking.rank2}
                onChange={(e) =>
                  onRankingChange(question.id, "rank2", e.target.value)
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {config.combinations
                  .filter((combo) => combo !== ranking.rank1)
                  .map((combo) => (
                    <option key={combo} value={combo}>
                      {combo}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
