"use client";

import { CombinedReasonField } from "@/components/participant/combined-reason-field";
import { ScoreSlider } from "@/components/participant/score-slider";
import { questionIncludesReason } from "@/lib/combined-reason-utils";
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
import {
  getUsedScoreCompareScores,
  getWinningCombinations,
} from "@/lib/score-reason-utils";
import type {
  Question,
  RankingQuestionConfig,
  ScoreQuestionConfig,
  ScoreCompareQuestionConfig,
  AttributeEvalQuestionConfig,
  Section,
  TextQuestionConfig,
  ChoiceQuestionConfig,
} from "@/lib/types";
import type { ScoreCompareDraftEntry } from "@/lib/evaluation-draft";
import { DEFAULT_SCORE_VALUE, SCORE_MAX, SCORE_MIN } from "@/lib/types";

const RANK_LABELS: Record<RankingField, string> = {
  rank1: "1순위",
  rank2: "2순위",
  rank3: "3순위",
};

type OrderedSegment =
  | { kind: "score-group"; category: string; questions: Question[] }
  | { kind: "question"; question: Question };

function buildOrderedSegments(questions: Question[]): OrderedSegment[] {
  const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const segments: OrderedSegment[] = [];

  for (const question of sorted) {
    if (question.type === "score") {
      const category = (question.config as ScoreQuestionConfig).category;
      const last = segments[segments.length - 1];
      if (last?.kind === "score-group" && last.category === category) {
        last.questions.push(question);
      } else {
        segments.push({ kind: "score-group", category, questions: [question] });
      }
      continue;
    }

    segments.push({ kind: "question", question });
  }

  return segments;
}

interface SectionQuestionsProps {
  section: Section & { questions: Question[] };
  scores: Record<string, string>;
  scoreCompares: Record<string, ScoreCompareDraftEntry>;
  rankings: Record<string, RankingAnswer>;
  texts: Record<string, string>;
  choices: Record<string, string[]>;
  reasons: Record<string, string>;
  onScoreChange: (questionId: string, score: number) => void;
  onScoreCompareChange: (
    questionId: string,
    patch: Partial<ScoreCompareDraftEntry> & {
      combination?: string;
      combinationScore?: string;
    }
  ) => void;
  onRankingChange: (
    questionId: string,
    field: RankingField,
    value: string
  ) => void;
  onTextChange: (questionId: string, value: string) => void;
  onChoiceChange: (questionId: string, selected: string[]) => void;
  onReasonChange: (questionId: string, value: string) => void;
}

export function SectionQuestions({
  section,
  scores,
  scoreCompares,
  rankings,
  texts,
  choices,
  reasons,
  onScoreChange,
  onScoreCompareChange,
  onRankingChange,
  onTextChange,
  onChoiceChange,
  onReasonChange,
}: SectionQuestionsProps) {
  const segments = buildOrderedSegments(section.questions);
  const rankGroupedTextSection = isRankGroupedTextSection(section);
  const precedingRankingQuestion = findPrecedingRankingQuestion(section);
  const rank1 = getRank1ForSection(section, rankings);

  const sortedQuestions = [...section.questions].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const firstTextQuestion = sortedQuestions.find((q) => q.type === "text");
  const firstVisibleTextQuestion = sortedQuestions.find((question) =>
    shouldShowTextQuestion(question, section, rank1)
  );
  const firstScoreSegmentIndex = segments.findIndex(
    (segment) => segment.kind === "score-group"
  );
  const firstScoreCompareQuestionIndex = segments.findIndex(
    (segment) =>
      segment.kind === "question" && segment.question.type === "score-compare"
  );
  const firstAttributeEvalQuestionIndex = segments.findIndex(
    (segment) =>
      segment.kind === "question" && segment.question.type === "attribute-eval"
  );

  return (
    <div className="space-y-5">
      {segments.map((segment, index) => {
        if (segment.kind === "score-group") {
          const showTypeLabel = index === firstScoreSegmentIndex;

          return (
            <div key={`score-${segment.category}-${segment.questions[0]?.id}`}>
              {showTypeLabel && (
                <p className="mb-4 text-xs text-muted">
                  2. 안별 점수부과형 ({SCORE_MIN}~{SCORE_MAX}점)
                </p>
              )}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold">{segment.category}</p>
                  <div className="space-y-3">
                    {segment.questions.map((question) => {
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
                            value={Number(
                              scores[question.id] ?? DEFAULT_SCORE_VALUE
                            )}
                            isSet={!!scores[question.id]}
                            onChange={(score) =>
                              onScoreChange(question.id, score)
                            }
                          />
                          {questionIncludesReason(question) && (
                            <CombinedReasonField
                              question={question}
                              value={reasons[question.id] ?? ""}
                              onChange={(value) =>
                                onReasonChange(question.id, value)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const question = segment.question;

        if (question.type === "score-compare") {
          const config = question.config as ScoreCompareQuestionConfig;
          const entry = scoreCompares[question.id] ?? { scores: {}, reason: "" };
          const maxLength = config.reasonMaxLength ?? 500;
          const winners = getWinningCombinations(question, entry);
          const showTypeLabel = index === firstScoreCompareQuestionIndex;

          return (
            <div key={question.id} className="space-y-4">
              {showTypeLabel && (
                <p className="text-xs text-muted">
                  4. 안 점수 비교형 ({SCORE_MIN}~{SCORE_MAX}점)
                </p>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold">{config.category}</p>
                <p className="mb-3 text-xs text-muted">
                  각 안에 서로 다른 점수를 부여해주세요.
                  {questionIncludesReason(question)
                    ? " 가장 높은 점수를 준 안에 대한 이유도 입력해주세요."
                    : ""}
                </p>
                <div className="space-y-4">
                  {config.combinations.map((combination) => {
                    const usedScores = getUsedScoreCompareScores(
                      entry,
                      combination
                    );

                    return (
                    <div
                      key={`${question.id}-${combination}`}
                      className="rounded-lg border border-border bg-card p-3 space-y-3"
                    >
                      <p className="text-sm font-medium text-muted">
                        {combination}
                      </p>
                      <ScoreSlider
                        value={Number(
                          entry.scores[combination] || DEFAULT_SCORE_VALUE
                        )}
                        isSet={!!entry.scores[combination]}
                        disabledScores={[...usedScores]}
                        onChange={(score) =>
                          onScoreCompareChange(question.id, {
                            combination,
                            combinationScore: String(score),
                          })
                        }
                      />
                    </div>
                    );
                  })}
                  {questionIncludesReason(question) && winners.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                      <label
                        htmlFor={`score-compare-${question.id}`}
                        className="block text-sm font-medium"
                      >
                        {winners.join(", ")} 선호 이유
                      </label>
                      <textarea
                        id={`score-compare-${question.id}`}
                        value={entry.reason}
                        onChange={(e) =>
                          onScoreCompareChange(question.id, {
                            reason: e.target.value,
                          })
                        }
                        placeholder={
                          config.reasonPlaceholder ??
                          "가장 높은 점수를 준 안에 대한 이유를 입력해주세요"
                        }
                        maxLength={maxLength}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      />
                      <p className="text-right text-xs text-muted">
                        {entry.reason.length}/{maxLength}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (question.type === "attribute-eval") {
          const config = question.config as AttributeEvalQuestionConfig;
          const entry = scoreCompares[question.id] ?? { scores: {}, reason: "" };
          const showTypeLabel = index === firstAttributeEvalQuestionIndex;

          return (
            <div key={question.id} className="space-y-4">
              {showTypeLabel && (
                <p className="text-xs text-muted">
                  5. 속성 평가형 ({SCORE_MIN}~{SCORE_MAX}점)
                </p>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold">
                  {config.designConcept}
                </p>
                <p className="mb-3 text-xs text-muted">
                  각 속성을 {SCORE_MIN}~{SCORE_MAX}점으로 평가해주세요.
                </p>
                <div className="space-y-4">
                  {config.attributes.map((attribute) => (
                    <div
                      key={`${question.id}-${attribute}`}
                      className="rounded-lg border border-border bg-card p-3 space-y-3"
                    >
                      <p className="text-sm font-medium text-muted">
                        {attribute}
                      </p>
                      <ScoreSlider
                        value={Number(
                          entry.scores[attribute] || DEFAULT_SCORE_VALUE
                        )}
                        isSet={!!entry.scores[attribute]}
                        onChange={(score) =>
                          onScoreCompareChange(question.id, {
                            combination: attribute,
                            combinationScore: String(score),
                          })
                        }
                      />
                    </div>
                  ))}
                  {questionIncludesReason(question) && (
                    <CombinedReasonField
                      question={question}
                      value={entry.reason}
                      onChange={(value) =>
                        onScoreCompareChange(question.id, { reason: value })
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (question.type === "ranking") {
          const config = question.config as RankingQuestionConfig;
          const ranking = normalizeRankingAnswer(
            rankings[question.id] ?? emptyRankingAnswer()
          );
          const rankFields: RankingField[] = Array.from(
            { length: maxRankingSlots(config.combinations.length) },
            (_, index) =>
              index === 0 ? "rank1" : index === 1 ? "rank2" : "rank3"
          );

          return (
            <div key={question.id} className="space-y-4">
              <p className="text-sm font-medium">
                {question.title !== "순위 문항" ? question.title : "순위 선정"}
              </p>
              <p className="text-xs text-muted">
                3. 순위 선정형 ({rankFields.length}순위까지 선택)
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
              {questionIncludesReason(question) && (
                <CombinedReasonField
                  question={question}
                  value={reasons[question.id] ?? ""}
                  onChange={(value) => onReasonChange(question.id, value)}
                />
              )}
            </div>
          );
        }

        if (question.type === "choice") {
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
                1. 안 선택형 · {isSingle ? "1개 선택" : "복수 선택 가능"}
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
              {questionIncludesReason(question) && (
                <CombinedReasonField
                  question={question}
                  value={reasons[question.id] ?? ""}
                  onChange={(value) => onReasonChange(question.id, value)}
                />
              )}
            </fieldset>
          );
        }

        if (question.type === "text") {
          const showRankHint =
            rankGroupedTextSection &&
            precedingRankingQuestion &&
            !rank1 &&
            question.id === firstTextQuestion?.id;

          const showRank1Header =
            rankGroupedTextSection &&
            rank1 &&
            question.id === firstVisibleTextQuestion?.id;

          if (!shouldShowTextQuestion(question, section, rank1)) {
            return showRankHint ? (
              <p key={question.id} className="text-sm text-amber-700">
                직전 순위 문항에서 1순위를 선택하면 주관식 문항이 표시됩니다.
              </p>
            ) : null;
          }

          const config = question.config as TextQuestionConfig;
          const maxLength = config.maxLength ?? 500;
          const value = texts[question.id] ?? "";

          return (
            <div key={question.id} className="space-y-2">
              {showRankHint && (
                <p className="text-sm text-amber-700">
                  직전 순위 문항에서 1순위를 선택하면 주관식 문항이 표시됩니다.
                </p>
              )}
              {showRank1Header && (
                <p className="text-sm font-semibold">{rank1} (1순위)</p>
              )}
              <label
                htmlFor={`text-${question.id}`}
                className="block text-sm font-medium"
              >
                {question.title !== "이유 기술 문항"
                  ? question.title
                  : "5. 이유 기술형"}
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
              <p className="text-right text-xs text-muted">
                {value.length}/{maxLength}
              </p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
