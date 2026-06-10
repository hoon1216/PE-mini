"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { configForType } from "@/lib/question-utils";
import type {
  Question,
  QuestionType,
  RankingQuestionConfig,
  ScoreQuestionConfig,
  Section,
  SurveyDetail,
} from "@/lib/types";
import { createDefaultQuestion } from "@/lib/types";

interface SurveyEditorProps {
  surveyId: string;
}

type EditorQuestion = Omit<Question, "id" | "sectionId"> & {
  id?: string;
  sectionId?: string;
};

type EditorSection = Omit<Section, "id" | "surveyId"> & {
  id?: string;
  surveyId?: string;
  questions: EditorQuestion[];
};

function createEmptySection(sortOrder: number): EditorSection {
  const defaults = createDefaultQuestion(0);
  return {
    title: "새 섹션",
    description: null,
    sortOrder,
    questions: [{ ...defaults }],
  };
}

export function SurveyEditor({ surveyId }: SurveyEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [newQuestionTypes, setNewQuestionTypes] = useState<
    Record<number, QuestionType>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchJson<SurveyDetail>(`/api/surveys/${surveyId}`)
      .then((data) => {
        setTitle(data.title);
        setDescription(data.description ?? "");
        setSections(
          data.sections.map((section) => ({
            id: section.id,
            title: section.title,
            description: section.description,
            sortOrder: section.sortOrder,
            questions: section.questions.map((question) => ({
              id: question.id,
              title: question.title,
              description: question.description,
              type: question.type,
              config: question.config,
              sortOrder: question.sortOrder,
            })),
          }))
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "불러오기 실패")
      )
      .finally(() => setLoading(false));
  }, [surveyId]);

  function updateSection(index: number, patch: Partial<EditorSection>) {
    setSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...patch } : section))
    );
  }

  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<EditorQuestion>
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) =>
            qIdx === questionIndex ? { ...question, ...patch } : question
          ),
        };
      })
    );
  }

  function changeQuestionType(
    sectionIndex: number,
    questionIndex: number,
    type: QuestionType
  ) {
    updateQuestion(sectionIndex, questionIndex, {
      type,
      config: configForType(type),
      title: type === "score" ? "점수 문항" : "순위 문항",
    });
  }

  function updateScoreQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<ScoreQuestionConfig>
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "score") {
              return question;
            }
            return {
              ...question,
              config: {
                ...(question.config as ScoreQuestionConfig),
                ...patch,
              },
            };
          }),
        };
      })
    );
  }

  function updateRankingCombination(
    sectionIndex: number,
    questionIndex: number,
    comboIndex: number,
    value: string
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "ranking") {
              return question;
            }
            const config = question.config as RankingQuestionConfig;
            return {
              ...question,
              config: {
                combinations: config.combinations.map((combo, i) =>
                  i === comboIndex ? value : combo
                ),
              },
            };
          }),
        };
      })
    );
  }

  function addRankingCombination(
    sectionIndex: number,
    questionIndex: number
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "ranking") {
              return question;
            }
            const config = question.config as RankingQuestionConfig;
            return {
              ...question,
              config: {
                combinations: [...config.combinations, "새 조합"],
              },
            };
          }),
        };
      })
    );
  }

  function removeRankingCombination(
    sectionIndex: number,
    questionIndex: number,
    comboIndex: number
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "ranking") {
              return question;
            }
            const config = question.config as RankingQuestionConfig;
            if (config.combinations.length <= 2) return question;
            return {
              ...question,
              config: {
                combinations: config.combinations.filter(
                  (_, i) => i !== comboIndex
                ),
              },
            };
          }),
        };
      })
    );
  }

  function addQuestion(sectionIndex: number) {
    const type = newQuestionTypes[sectionIndex] ?? "score";
    setSections((prev) =>
      prev.map((section, index) => {
        if (index !== sectionIndex) return section;
        const defaults = createDefaultQuestion(section.questions.length, type);
        return {
          ...section,
          questions: [...section.questions, defaults],
        };
      })
    );
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex || section.questions.length <= 1) {
          return section;
        }
        return {
          ...section,
          questions: section.questions
            .filter((_, qIdx) => qIdx !== questionIndex)
            .map((question, sortOrder) => ({ ...question, sortOrder })),
        };
      })
    );
  }

  function duplicateSection(sectionIndex: number) {
    setSections((prev) => {
      const source = prev[sectionIndex];
      const copy: EditorSection = {
        title: `${source.title} (복사)`,
        description: source.description,
        sortOrder: sectionIndex + 1,
        questions: source.questions.map((question, index) => ({
          title: question.title,
          description: question.description,
          type: question.type,
          config:
            question.type === "score"
              ? { ...(question.config as ScoreQuestionConfig) }
              : {
                  combinations: [
                    ...(question.config as RankingQuestionConfig).combinations,
                  ],
                },
          sortOrder: index,
        })),
      };

      const next = [...prev];
      next.splice(sectionIndex + 1, 0, copy);
      return next.map((section, sortOrder) => ({ ...section, sortOrder }));
    });
  }

  function addSection() {
    setSections((prev) => [...prev, createEmptySection(prev.length)]);
  }

  function removeSection(index: number) {
    setSections((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((section, sortOrder) => ({ ...section, sortOrder }))
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        title,
        description,
        sections: sections.map((section, sectionIndex) => ({
          id: section.id || undefined,
          title: section.title,
          description: section.description ?? undefined,
          sortOrder: sectionIndex,
          questions: section.questions.map((question, questionIndex) => ({
            id: question.id || undefined,
            title: question.title,
            description: question.description ?? undefined,
            type: question.type,
            config: question.config,
            sortOrder: questionIndex,
          })),
        })),
      };

      const updated = await fetchJson<SurveyDetail>(`/api/surveys/${surveyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSections(
        updated.sections.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          sortOrder: section.sortOrder,
          questions: section.questions.map((question) => ({
            id: question.id,
            title: question.title,
            description: question.description,
            type: question.type,
            config: question.config,
            sortOrder: question.sortOrder,
          })),
        }))
      );
      setMessage("저장되었습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted">
        편집 내용을 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">조사 기본 정보</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">조사 제목</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">설명</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
        <div
          key={section.id ?? `new-section-${sectionIndex}`}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">섹션 {sectionIndex + 1}</h3>
            <Button
              type="button"
              variant="danger"
              onClick={() => removeSection(sectionIndex)}
              disabled={sections.length === 1}
            >
              섹션 삭제
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">섹션 제목</label>
              <Input
                value={section.title}
                onChange={(e) =>
                  updateSection(sectionIndex, { title: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">섹션 설명</label>
              <Textarea
                value={section.description ?? ""}
                onChange={(e) =>
                  updateSection(sectionIndex, {
                    description: e.target.value || null,
                  })
                }
                rows={2}
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {section.questions.map((question, questionIndex) => {
              const scoreConfig =
                question.type === "score"
                  ? (question.config as ScoreQuestionConfig)
                  : null;
              const rankingConfig =
                question.type === "ranking"
                  ? (question.config as RankingQuestionConfig)
                  : null;

              return (
                <div
                  key={question.id ?? `q-${sectionIndex}-${questionIndex}`}
                  className="rounded-xl border border-border bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-muted">
                      문항 {questionIndex + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        removeQuestion(sectionIndex, questionIndex)
                      }
                      disabled={section.questions.length <= 1}
                    >
                      문항 삭제
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        문항 유형
                      </label>
                      <select
                        value={question.type}
                        onChange={(e) =>
                          changeQuestionType(
                            sectionIndex,
                            questionIndex,
                            e.target.value as QuestionType
                          )
                        }
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="score">점수 부과형</option>
                        <option value="ranking">순위 선정형</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        문항 제목 (선택)
                      </label>
                      <Input
                        value={question.title}
                        onChange={(e) =>
                          updateQuestion(sectionIndex, questionIndex, {
                            title: e.target.value,
                          })
                        }
                        placeholder="표시용 제목"
                      />
                    </div>
                  </div>

                  {scoreConfig && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <Input
                        value={scoreConfig.category}
                        onChange={(e) =>
                          updateScoreQuestion(sectionIndex, questionIndex, {
                            category: e.target.value,
                          })
                        }
                        placeholder="구분"
                      />
                      <Input
                        value={scoreConfig.combination}
                        onChange={(e) =>
                          updateScoreQuestion(sectionIndex, questionIndex, {
                            combination: e.target.value,
                          })
                        }
                        placeholder="조합"
                      />
                    </div>
                  )}

                  {rankingConfig && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium">조합 목록</p>
                      {rankingConfig.combinations.map((combo, comboIndex) => (
                        <div
                          key={`${questionIndex}-combo-${comboIndex}`}
                          className="flex gap-2"
                        >
                          <Input
                            value={combo}
                            onChange={(e) =>
                              updateRankingCombination(
                                sectionIndex,
                                questionIndex,
                                comboIndex,
                                e.target.value
                              )
                            }
                            placeholder="조합명"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              removeRankingCombination(
                                sectionIndex,
                                questionIndex,
                                comboIndex
                              )
                            }
                            disabled={rankingConfig.combinations.length <= 2}
                          >
                            삭제
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-1"
                        onClick={() =>
                          addRankingCombination(sectionIndex, questionIndex)
                        }
                      >
                        조합 추가
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newQuestionTypes[sectionIndex] ?? "score"}
                onChange={(e) =>
                  setNewQuestionTypes((prev) => ({
                    ...prev,
                    [sectionIndex]: e.target.value as QuestionType,
                  }))
                }
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="score">점수 부과형</option>
                <option value="ranking">순위 선정형</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => addQuestion(sectionIndex)}
              >
                문항 추가
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => duplicateSection(sectionIndex)}
            >
              섹션 복사
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={addSection}>
          섹션 추가
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "변경사항 저장"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  );
}
