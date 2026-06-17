"use client";

import { ScoreSlider } from "@/components/participant/score-slider";
import {
  availableCombinationsForRank,
  emptyRankingAnswer,
  maxRankingSlots,
  normalizeRankingAnswer,
  type RankingAnswer,
  type RankingField,
} from "@/lib/ranking-utils";
import {
  isSingleChoice,
  toggleChoiceSelection,
} from "@/lib/choice-utils";
import {
  findPrecedingRankingQuestion,
  getRank1ForSection,
  isRankGroupedTextSection,
  shouldShowTextQuestion,
} from "@/lib/text-grouping-utils";
import type {
  Question,
  RankingQuestionConfig,
  ScoreQuestionConfig,
  Section,
  TextQuestionConfig,
  ChoiceQuestionConfig,
} from "@/lib/types";
import { DEFAULT_SCORE_VALUE, SCORE_MAX, SCORE_MIN } from "@/lib/types";

const RANK_LABELS: Record<RankingField, string> = {
  rank1: "1순위",
  rank2: "2순위",
  rank3: "3순위",
};

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
  rankings: Record<string, RankingAnswer>;
  texts: Record<string, string>;
  choices: Record<string, string[]>;
  onScoreChange: (questionId: string, score: number) => void;
  onRankingChange: (
    questionId: string,
    field: RankingField,
    value: string
  ) => void;
  onTextChange: (questionId: string, value: string) => void;
  onChoiceChange: (questionId: string, selected: string[]) => void;
}

export function SectionQuestions({
  section,
  scores,
  rankings,
  texts,
  choices,
  onScoreChange,
  onRankingChange,
  onTextChange,
  onChoiceChange,
}: SectionQuestionsProps) {
  const scoreGroups = groupScoreQuestionsByCategory(section.questions);
  const rankingQuestions = section.questions.filter((q) => q.type === "ranking");
  const textQuestions = section.questions.filter((q) => q.type === "text");
  const choiceQuestions = section.questions.filter((q) => q.type === "choice");
  const rankGroupedTextSection = isRankGroupedTextSection(section);
  const precedingRankingQuestion = findPrecedingRankingQuestion(section);
  const rank1 = getRank1ForSection(section, rankings);
  const visibleTextQuestions = textQuestions.filter((question) =>
    shouldShowTextQuestion(question, section, rank1)
  );

  return (
    <div className="space-y-5">
      {scoreGroups.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            점수 부과형 ({SCORE_MIN}~{SCORE_MAX}점)
          </p>
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
                        value={Number(scores[question.id] ?? DEFAULT_SCORE_VALUE)}
                        isSet={!!scores[question.id]}
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
        const ranking = normalizeRankingAnswer(
          rankings[question.id] ?? emptyRankingAnswer()
        );
        const rankFields: RankingField[] = Array.from(
          { length: maxRankingSlots(config.combinations.length) },
          (_, index) => (index === 0 ? "rank1" : index === 1 ? "rank2" : "rank3")
        );

        return (
          <div key={question.id} className="space-y-4">
            <p className="text-sm font-medium">
              {question.title !== "순위 문항" ? question.title : "순위 선정"}
            </p>
            <p className="text-xs text-muted">
              순위 선정형 ({rankFields.length}순위까지 선택)
            </p>
            {rankFields.map((field) => (
              <div key={field}>
                <label className="mb-1 block text-sm font-medium">
                  {RANK_LABELS[field]}
                </label>
                <select
                  value={ranking[field] ?? ""}
                  onChange={(e) =>
                    onRankingChange(question.id, field, e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {availableCombinationsForRank(
                    config.combinations,
                    ranking,
                    field
                  ).map((combo) => (
                    <option key={combo} value={combo}>
                      {combo}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        );
      })}

      {choiceQuestions.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">객관식</p>
          {choiceQuestions.map((question) => {
            const config = question.config as ChoiceQuestionConfig;
            const selected = choices[question.id] ?? [];
            const groupName = `choice-${question.id}`;
            const isSingle = isSingleChoice(config);

            return (
              <fieldset key={question.id} className="space-y-2">
                <legend className="text-sm font-medium">
                  {question.title !== "객관식 문항"
                    ? question.title
                    : "객관식 답변"}
                </legend>
                {question.description && (
                  <p className="text-xs text-muted">{question.description}</p>
                )}
                <p className="text-xs text-muted">
                  {isSingle ? "1개 선택" : "복수 선택 가능"}
                </p>
                <div className="space-y-2">
                  {config.options.map((option) => {
                    const isChecked = selected.includes(option);

                    return (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                      >
                        <input
                          type={isSingle ? "radio" : "checkbox"}
                          name={groupName}
                          value={option}
                          checked={isChecked}
                          onChange={() =>
                            onChoiceChange(
                              question.id,
                              toggleChoiceSelection(selected, option, config)
                            )
                          }
                          className="text-primary"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      {textQuestions.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">주관식</p>
          {rankGroupedTextSection && precedingRankingQuestion && !rank1 && (
            <p className="text-sm text-amber-700">
              직전 순위 문항에서 1순위를 선택하면 주관식 문항이 표시됩니다.
            </p>
          )}
          {rankGroupedTextSection && rank1 && (
            <p className="text-sm font-semibold">{rank1} (1순위)</p>
          )}
          {visibleTextQuestions.map((question) => {
            const config = question.config as TextQuestionConfig;
            const maxLength = config.maxLength ?? 500;
            const value = texts[question.id] ?? "";

            return (
              <div key={question.id} className="space-y-2">
                <label
                  htmlFor={`text-${question.id}`}
                  className="block text-sm font-medium"
                >
                  {question.title !== "주관식 문항"
                    ? question.title
                    : "주관식 답변"}
                </label>
                {question.description && (
                  <p className="text-xs text-muted">{question.description}</p>
                )}
                <textarea
                  id={`text-${question.id}`}
                  value={value}
                  onChange={(e) => onTextChange(question.id, e.target.value)}
                  placeholder={config.placeholder ?? "답변을 입력해주세요"}
                  maxLength={maxLength}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted text-right">
                  {value.length}/{maxLength}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
