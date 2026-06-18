"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input, Textarea } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { createDefaultDemographicField } from "@/lib/demographic-field-utils";
import { configForType } from "@/lib/question-utils";
import {
  findPrecedingRankingQuestion,
  isRankGroupedTextSection,
} from "@/lib/text-grouping-utils";
import type {
  DemographicFieldConfig,
  Question,
  QuestionConfig,
  QuestionType,
  RankingQuestionConfig,
  ScoreQuestionConfig,
  Section,
  SurveyDetail,
  TextQuestionConfig,
  ChoiceQuestionConfig,
  ChoiceSelectionMode,
} from "@/lib/types";
import { choiceSelectionMode } from "@/lib/choice-utils";
import { ParticipantResponseManager } from "@/components/admin/participant-response-manager";
import {
  createDefaultQuestion,
  defaultQuestionTitle,
  QUESTION_TYPE_LABELS,
} from "@/lib/types";

interface SurveyEditorProps {
  surveyId: string;
  initialSurvey?: SurveyDetail;
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

function mapSurveyToEditorSections(data: SurveyDetail): EditorSection[] {
  return data.sections.map((section) => ({
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
  }));
}

function cloneQuestionConfig(question: EditorQuestion): QuestionConfig {
  if (question.type === "score") {
    return { ...(question.config as ScoreQuestionConfig) };
  }
  if (question.type === "text") {
    return { ...(question.config as TextQuestionConfig) };
  }
  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    return {
      options: [...config.options],
      selectionMode: choiceSelectionMode(config),
    };
  }
  return {
    combinations: [
      ...(question.config as RankingQuestionConfig).combinations,
    ],
  };
}

function ReorderButtons({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
  label,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={`${label} 순서 변경`}
    >
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1"
        onClick={onMoveUp}
        disabled={disableUp}
        aria-label={`${label} 위로`}
      >
        ↑
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1"
        onClick={onMoveDown}
        disabled={disableDown}
        aria-label={`${label} 아래로`}
      >
        ↓
      </Button>
    </div>
  );
}

function createEmptySection(sortOrder: number): EditorSection {
  const defaults = createDefaultQuestion(0);
  return {
    title: "새 섹션",
    description: null,
    sortOrder,
    questions: [{ ...defaults }],
  };
}

export function SurveyEditor({
  surveyId,
  initialSurvey,
}: SurveyEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialSurvey?.title ?? "");
  const [description, setDescription] = useState(
    initialSurvey?.description ?? ""
  );
  const [sections, setSections] = useState<EditorSection[]>(
    initialSurvey ? mapSurveyToEditorSections(initialSurvey) : []
  );
  const [demographicFields, setDemographicFields] = useState<
    DemographicFieldConfig[]
  >(initialSurvey?.demographicFields ?? []);
  const [newQuestionTypes, setNewQuestionTypes] = useState<
    Record<number, QuestionType>
  >({});
  const [loading, setLoading] = useState(!initialSurvey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialSurvey) return;

    fetchJson<SurveyDetail>(`/api/surveys/${surveyId}`)
      .then((data) => {
        setTitle(data.title);
        setDescription(data.description ?? "");
        setDemographicFields(data.demographicFields ?? []);
        setSections(mapSurveyToEditorSections(data));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "불러오기 실패")
      )
      .finally(() => setLoading(false));
  }, [surveyId, initialSurvey]);

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
      title: defaultQuestionTitle(type),
    });
  }

  function updateChoiceQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<ChoiceQuestionConfig>
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "choice") {
              return question;
            }
            const config = question.config as ChoiceQuestionConfig;
            const next = { ...config, ...patch };
            const selectionMode: ChoiceSelectionMode =
              next.selectionMode ??
              (next.selectCount && next.selectCount > 1 ? "multiple" : "single");
            return {
              ...question,
              config: { options: next.options, selectionMode },
            };
          }),
        };
      })
    );
  }

  function updateChoiceOption(
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number,
    value: string
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "choice") {
              return question;
            }
            const config = question.config as ChoiceQuestionConfig;
            return {
              ...question,
              config: {
                options: config.options.map((option, i) =>
                  i === optionIndex ? value : option
                ),
              },
            };
          }),
        };
      })
    );
  }

  function addChoiceOption(sectionIndex: number, questionIndex: number) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "choice") {
              return question;
            }
            const config = question.config as ChoiceQuestionConfig;
            return {
              ...question,
              config: {
                options: [...config.options, "새 선택지"],
              },
            };
          }),
        };
      })
    );
  }

  function removeChoiceOption(
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "choice") {
              return question;
            }
            const config = question.config as ChoiceQuestionConfig;
            if (config.options.length <= 2) return question;
            const options = config.options.filter((_, i) => i !== optionIndex);
            return {
              ...question,
              config: {
                options,
                selectionMode: choiceSelectionMode(config),
              },
            };
          }),
        };
      })
    );
  }

  function updateTextQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<TextQuestionConfig>
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        return {
          ...section,
          questions: section.questions.map((question, qIdx) => {
            if (qIdx !== questionIndex || question.type !== "text") {
              return question;
            }
            return {
              ...question,
              config: {
                ...(question.config as TextQuestionConfig),
                ...patch,
              },
            };
          }),
        };
      })
    );
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((section, sortOrder) => ({ ...section, sortOrder }));
    });
  }

  function moveQuestion(
    sectionIndex: number,
    questionIndex: number,
    direction: -1 | 1
  ) {
    setSections((prev) =>
      prev.map((section, sIdx) => {
        if (sIdx !== sectionIndex) return section;
        const target = questionIndex + direction;
        if (target < 0 || target >= section.questions.length) return section;
        const questions = [...section.questions];
        [questions[questionIndex], questions[target]] = [
          questions[target],
          questions[questionIndex],
        ];
        return {
          ...section,
          questions: questions.map((question, sortOrder) => ({
            ...question,
            sortOrder,
          })),
        };
      })
    );
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
          config: cloneQuestionConfig(question),
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

  function addDemographicField() {
    setDemographicFields((prev) => [...prev, createDefaultDemographicField()]);
  }

  function updateDemographicField(
    index: number,
    patch: Partial<DemographicFieldConfig>
  ) {
    setDemographicFields((prev) =>
      prev.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field
      )
    );
  }

  function updateDemographicOption(
    fieldIndex: number,
    optionIndex: number,
    value: string
  ) {
    setDemographicFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;
        return {
          ...field,
          options: field.options.map((option, currentIndex) =>
            currentIndex === optionIndex ? value : option
          ),
        };
      })
    );
  }

  function addDemographicOption(fieldIndex: number) {
    setDemographicFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;
        return {
          ...field,
          options: [...field.options, "새 선택지"],
        };
      })
    );
  }

  function removeDemographicOption(fieldIndex: number, optionIndex: number) {
    setDemographicFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex || field.options.length <= 2) return field;
        return {
          ...field,
          options: field.options.filter((_, currentIndex) => currentIndex !== optionIndex),
        };
      })
    );
  }

  function removeDemographicField(index: number) {
    setDemographicFields((prev) => prev.filter((_, fieldIndex) => fieldIndex !== index));
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
        demographicFields,
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

      setDemographicFields(updated.demographicFields ?? []);
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

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">조사 대상 정보</h2>
        <p className="mt-2 text-sm text-muted">
          이름, 성별, 연령대는 기본 항목입니다. 아래에서 구분 항목을 추가하면
          참가자가 선택형으로 응답합니다.
        </p>

        {demographicFields.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            등록된 구분 항목이 없습니다.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {demographicFields.map((field, fieldIndex) => (
              <div
                key={field.id}
                className="rounded-xl border border-border bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-sm font-medium">
                      구분 항목명
                    </label>
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        updateDemographicField(fieldIndex, {
                          label: e.target.value,
                        })
                      }
                      placeholder="예: 가전보유 여부"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-6"
                    onClick={() => removeDemographicField(fieldIndex)}
                  >
                    항목 삭제
                  </Button>
                </div>

                <p className="mt-4 text-sm font-medium">선택지</p>
                <div className="mt-2 space-y-2">
                  {field.options.map((option, optionIndex) => (
                    <div
                      key={`${field.id}-option-${optionIndex}`}
                      className="flex gap-2"
                    >
                      <Input
                        value={option}
                        onChange={(e) =>
                          updateDemographicOption(
                            fieldIndex,
                            optionIndex,
                            e.target.value
                          )
                        }
                        placeholder="선택지"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          removeDemographicOption(fieldIndex, optionIndex)
                        }
                        disabled={field.options.length <= 2}
                      >
                        삭제
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => addDemographicOption(fieldIndex)}
                >
                  선택지 추가
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={addDemographicField}
        >
          구분 항목 추가
        </Button>
      </div>

      {sections.map((section, sectionIndex) => (
        <div
          key={section.id ?? `new-section-${sectionIndex}`}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">섹션 {sectionIndex + 1}</h3>
              <ReorderButtons
                label={`섹션 ${sectionIndex + 1}`}
                onMoveUp={() => moveSection(sectionIndex, -1)}
                onMoveDown={() => moveSection(sectionIndex, 1)}
                disableUp={sectionIndex === 0}
                disableDown={sectionIndex === sections.length - 1}
              />
            </div>
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
              const textConfig =
                question.type === "text"
                  ? (question.config as TextQuestionConfig)
                  : null;
              const choiceConfig =
                question.type === "choice"
                  ? (question.config as ChoiceQuestionConfig)
                  : null;

              return (
                <div
                  key={question.id ?? `q-${sectionIndex}-${questionIndex}`}
                  className="rounded-xl border border-border bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-muted">
                        문항 {questionIndex + 1}
                      </p>
                      <ReorderButtons
                        label={`섹션 ${sectionIndex + 1} 문항 ${questionIndex + 1}`}
                        onMoveUp={() =>
                          moveQuestion(sectionIndex, questionIndex, -1)
                        }
                        onMoveDown={() =>
                          moveQuestion(sectionIndex, questionIndex, 1)
                        }
                        disableUp={questionIndex === 0}
                        disableDown={
                          questionIndex === section.questions.length - 1
                        }
                      />
                    </div>
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
                        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(
                          (type) => (
                            <option key={type} value={type}>
                              {QUESTION_TYPE_LABELS[type]}
                            </option>
                          )
                        )}
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

                  {choiceConfig && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          구분
                        </label>
                        <Input
                          value={choiceConfig.category ?? ""}
                          list={`choice-category-${sectionIndex}-${questionIndex}`}
                          onChange={(e) =>
                            updateChoiceQuestion(sectionIndex, questionIndex, {
                              category: e.target.value || undefined,
                            })
                          }
                          placeholder="없음"
                        />
                        <datalist id={`choice-category-${sectionIndex}-${questionIndex}`}>
                          <option value="없음" />
                          <option value="요소" />
                        </datalist>
                        <p className="mt-1 text-xs text-muted">
                          비우거나 「없음」이면 대시보드에서 항목명만 표시합니다.
                          같은 구분명을 쓰면 묶어 표시합니다.
                        </p>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium">선택 방식</p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`choice-mode-${sectionIndex}-${questionIndex}`}
                              checked={choiceSelectionMode(choiceConfig) === "single"}
                              onChange={() =>
                                updateChoiceQuestion(sectionIndex, questionIndex, {
                                  selectionMode: "single",
                                })
                              }
                              className="text-primary"
                            />
                            단일 선택 (1개)
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`choice-mode-${sectionIndex}-${questionIndex}`}
                              checked={
                                choiceSelectionMode(choiceConfig) === "multiple"
                              }
                              onChange={() =>
                                updateChoiceQuestion(sectionIndex, questionIndex, {
                                  selectionMode: "multiple",
                                })
                              }
                              className="text-primary"
                            />
                            복수 선택
                          </label>
                        </div>
                      </div>
                      <p className="text-sm font-medium">선택지 목록</p>
                      {choiceConfig.options.map((option, optionIndex) => (
                        <div
                          key={`${questionIndex}-option-${optionIndex}`}
                          className="flex gap-2"
                        >
                          <Input
                            value={option}
                            onChange={(e) =>
                              updateChoiceOption(
                                sectionIndex,
                                questionIndex,
                                optionIndex,
                                e.target.value
                              )
                            }
                            placeholder="선택지"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              removeChoiceOption(
                                sectionIndex,
                                questionIndex,
                                optionIndex
                              )
                            }
                            disabled={choiceConfig.options.length <= 2}
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
                          addChoiceOption(sectionIndex, questionIndex)
                        }
                      >
                        선택지 추가
                      </Button>
                    </div>
                  )}

                  {textConfig && (
                    <div className="mt-3 space-y-3">
                      {isRankGroupedTextSection(section) &&
                        (() => {
                          const rankingQuestion =
                            findPrecedingRankingQuestion(section);
                          const combinations = rankingQuestion
                            ? (rankingQuestion.config as RankingQuestionConfig)
                                .combinations
                            : [];

                          if (combinations.length === 0) return null;

                          return (
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                1순위 그룹 매칭 (선택)
                              </label>
                              <select
                                value={textConfig.rankGroup ?? ""}
                                onChange={(e) =>
                                  updateTextQuestion(
                                    sectionIndex,
                                    questionIndex,
                                    {
                                      rankGroup: e.target.value || undefined,
                                    }
                                  )
                                }
                                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">
                                  1순위와 무관 (모든 1순위 그룹에 공통)
                                </option>
                                {combinations.map((combo) => (
                                  <option key={combo} value={combo}>
                                    {combo}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-muted">
                                지정 시 해당 1순위를 선택한 참가자에게만
                                표시됩니다.
                              </p>
                            </div>
                          );
                        })()}
                      <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          입력 안내 (placeholder)
                        </label>
                        <Input
                          value={textConfig.placeholder ?? ""}
                          onChange={(e) =>
                            updateTextQuestion(sectionIndex, questionIndex, {
                              placeholder: e.target.value,
                            })
                          }
                          placeholder="답변을 입력해주세요"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          최대 글자 수
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={2000}
                          value={textConfig.maxLength ?? 500}
                          onChange={(e) =>
                            updateTextQuestion(sectionIndex, questionIndex, {
                              maxLength: Number(e.target.value) || 500,
                            })
                          }
                        />
                      </div>
                      </div>
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
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {QUESTION_TYPE_LABELS[type]}
                    </option>
                  )
                )}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => addQuestion(sectionIndex)}
              >
                문항 추가
              </Button>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => duplicateSection(sectionIndex)}
              >
                섹션 복사
              </Button>
              {sectionIndex === sections.length - 1 && (
                <Button type="button" variant="secondary" onClick={addSection}>
                  섹션 추가
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

      <ParticipantResponseManager
        surveyId={surveyId}
        demographicFields={demographicFields}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "변경사항 저장"}
        </Button>
        <ButtonLink href={`/admin/surveys/${surveyId}`} variant="secondary">
          대시보드
        </ButtonLink>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  );
}
