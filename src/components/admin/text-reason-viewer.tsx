"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  AgeGroup,
  DemographicFieldConfig,
  Gender,
  TextReasonEntry,
} from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";

const thClass =
  "border border-slate-300 bg-slate-100 px-2 py-2 text-center text-xs font-semibold";
const tdClass = "border border-slate-300 px-2 py-2 text-center text-xs";

export interface TextReasonAnswerGroup {
  label: string;
  entries: TextReasonEntry[];
}

interface TextReasonViewerProps {
  title: string;
  entries: TextReasonEntry[];
  demographicFields: DemographicFieldConfig[];
  ageGroups: AgeGroup[];
  answerGroups?: TextReasonAnswerGroup[];
}

function matchesFilters(
  entry: TextReasonEntry,
  gender: Gender | null,
  ageGroup: AgeGroup | null,
  customFilters: Record<string, string | null>
): boolean {
  if (gender && entry.gender !== gender) return false;
  if (ageGroup && entry.ageGroup !== ageGroup) return false;

  for (const [fieldId, selected] of Object.entries(customFilters)) {
    if (!selected) continue;
    if (entry.demographicValues[fieldId] !== selected) return false;
  }

  return true;
}

function SelectableCell({
  selected,
  count,
  onClick,
}: {
  selected: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <td className={tdClass}>
      <button
        type="button"
        onClick={onClick}
        className={`min-w-[2.5rem] rounded px-2 py-1 transition ${
          selected
            ? "bg-primary font-semibold text-white"
            : count > 0
              ? "hover:bg-primary/10"
              : "text-muted"
        }`}
      >
        {count > 0 ? count : "-"}
      </button>
    </td>
  );
}

export function TextReasonViewer({
  title,
  entries,
  demographicFields,
  ageGroups,
  answerGroups,
}: TextReasonViewerProps) {
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [customFilters, setCustomFilters] = useState<
    Record<string, string | null>
  >(() => Object.fromEntries(demographicFields.map((field) => [field.id, null])));
  const [showAnswers, setShowAnswers] = useState(false);

  const hasResponses = entries.length > 0;

  const countFor = (
    partialGender: Gender | null,
    partialAge: AgeGroup | null,
    partialCustom: Record<string, string | null>
  ) =>
    entries.filter((entry) =>
      matchesFilters(entry, partialGender, partialAge, partialCustom)
    ).length;

  const filteredReasons = useMemo(() => {
    if (!showAnswers) return [];

    return entries
      .filter((entry) => matchesFilters(entry, gender, ageGroup, customFilters))
      .map((entry) => entry.reason);
  }, [entries, gender, ageGroup, customFilters, showAnswers]);

  const filteredAnswerGroups = useMemo(() => {
    if (!showAnswers || !answerGroups) return [];

    return answerGroups
      .map((group) => ({
        label: group.label,
        reasons: group.entries
          .filter((entry) =>
            matchesFilters(entry, gender, ageGroup, customFilters)
          )
          .map((entry) => entry.reason),
      }))
      .filter((group) => group.reasons.length > 0);
  }, [answerGroups, gender, ageGroup, customFilters, showAnswers]);

  const customColCount = demographicFields.reduce(
    (sum, field) => sum + field.options.length,
    0
  );
  const totalColSpan = 2 + ageGroups.length + customColCount;

  function toggleGender(value: Gender) {
    setGender((current) => (current === value ? null : value));
    setShowAnswers(true);
  }

  function toggleAgeGroup(value: AgeGroup) {
    setAgeGroup((current) => (current === value ? null : value));
    setShowAnswers(true);
  }

  function toggleCustom(fieldId: string, option: string) {
    setCustomFilters((prev) => ({
      ...prev,
      [fieldId]: prev[fieldId] === option ? null : option,
    }));
    setShowAnswers(true);
  }

  if (!hasResponses) {
    return <p className="text-sm text-muted">제출된 답변이 없습니다.</p>;
  }

  const hasFilteredAnswers = answerGroups
    ? filteredAnswerGroups.length > 0
    : filteredReasons.length > 0;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse border border-slate-300 text-sm">
          <thead>
            <tr>
              <th colSpan={totalColSpan} className={thClass}>
                {title}
              </th>
            </tr>
            <tr>
              <th colSpan={2} className={thClass}>
                성별
              </th>
              {ageGroups.length > 0 && (
                <th colSpan={ageGroups.length} className={thClass}>
                  연령대
                </th>
              )}
              {demographicFields.map((field) => (
                <th
                  key={field.id}
                  colSpan={field.options.length}
                  className={thClass}
                >
                  {field.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className={thClass}>{GENDER_LABELS.male}</th>
              <th className={thClass}>{GENDER_LABELS.female}</th>
              {ageGroups.map((age) => (
                <th key={age} className={thClass}>
                  {AGE_GROUP_LABELS[age]}
                </th>
              ))}
              {demographicFields.flatMap((field) =>
                field.options.map((option) => (
                  <th key={`${field.id}-${option}`} className={thClass}>
                    {option}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              {(["male", "female"] as Gender[]).map((value) => (
                <SelectableCell
                  key={value}
                  selected={gender === value}
                  count={countFor(value, ageGroup, customFilters)}
                  onClick={() => toggleGender(value)}
                />
              ))}
              {ageGroups.map((age) => (
                <SelectableCell
                  key={age}
                  selected={ageGroup === age}
                  count={countFor(gender, age, customFilters)}
                  onClick={() => toggleAgeGroup(age)}
                />
              ))}
              {demographicFields.flatMap((field) =>
                field.options.map((option) => {
                  const partialCustom = {
                    ...customFilters,
                    [field.id]: option as string | null,
                  };
                  return (
                    <SelectableCell
                      key={`${field.id}-${option}`}
                      selected={customFilters[field.id] === option}
                      count={countFor(gender, ageGroup, partialCustom)}
                      onClick={() => toggleCustom(field.id, option)}
                    />
                  );
                })
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => setShowAnswers(true)}>
          답안 표시
        </Button>
        <p className="text-xs text-muted">
          셀을 선택하면 해당 조건으로 필터됩니다. 항목별 선택이 없으면 해당
          항목 전체가 포함됩니다.
        </p>
      </div>

      {showAnswers && (
        <>
          {!hasFilteredAnswers ? (
            <p className="text-sm text-muted">
              선택한 조건에 해당하는 답변이 없습니다.
            </p>
          ) : answerGroups ? (
            <div className="space-y-4">
              {filteredAnswerGroups.map((group) => (
                <div
                  key={group.label}
                  className="rounded-xl border border-border bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold">{group.label}</p>
                  <div className="mt-3 space-y-2">
                    {group.reasons.map((reason, index) => (
                      <p key={`${group.label}-${index}`} className="text-sm">
                        {reason}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-slate-50 p-4">
              <div className="space-y-2">
                {filteredReasons.map((reason, index) => (
                  <p key={`${reason}-${index}`} className="text-sm">
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
