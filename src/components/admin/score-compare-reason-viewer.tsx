"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  AgeGroup,
  DemographicFieldConfig,
  ScoreCompareReasonEntry,
  ScoreReasonCategoryStats,
} from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";

type FilterValue = "all" | string;

interface ScoreCompareReasonViewerProps {
  categories: ScoreReasonCategoryStats[];
  demographicFields: DemographicFieldConfig[];
  ageGroups: AgeGroup[];
}

function matchesFilters(
  entry: ScoreCompareReasonEntry,
  gender: FilterValue,
  ageGroup: FilterValue,
  customFilters: Record<string, FilterValue>
): boolean {
  if (gender !== "all" && entry.gender !== gender) return false;
  if (ageGroup !== "all" && entry.ageGroup !== ageGroup) return false;

  for (const field of Object.keys(customFilters)) {
    const selected = customFilters[field];
    if (selected === "all") continue;
    if (entry.demographicValues[field] !== selected) return false;
  }

  return true;
}

function FilterButtonGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: FilterValue;
  options: { value: FilterValue; label: string }[];
  onChange: (value: FilterValue) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={`${label}-${option.value}`}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              value === option.value
                ? "border-primary bg-primary text-white"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScoreCompareReasonViewer({
  categories,
  demographicFields,
  ageGroups,
}: ScoreCompareReasonViewerProps) {
  const [gender, setGender] = useState<FilterValue>("all");
  const [ageGroup, setAgeGroup] = useState<FilterValue>("all");
  const [customFilters, setCustomFilters] = useState<
    Record<string, FilterValue>
  >(() =>
    Object.fromEntries(demographicFields.map((field) => [field.id, "all"]))
  );
  const [showAnswers, setShowAnswers] = useState(false);

  const hasReasons = categories.some((category) =>
    category.blocks.some((block) => block.entries.length > 0)
  );

  const filteredBlocks = useMemo(() => {
    if (!showAnswers) return [];

    return categories.flatMap((category) =>
      category.blocks
        .map((block) => ({
          category: category.category,
          winningCombination: block.winningCombination,
          reasons: block.entries
            .filter((entry) =>
              matchesFilters(entry, gender, ageGroup, customFilters)
            )
            .map((entry) => entry.reason),
        }))
        .filter((block) => block.reasons.length > 0)
    );
  }, [categories, gender, ageGroup, customFilters, showAnswers]);

  if (!hasReasons) {
    return <p className="text-sm text-muted">제출된 이유가 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      <FilterButtonGroup
        label="성별"
        value={gender}
        onChange={setGender}
        options={[
          { value: "all", label: "전체" },
          { value: "male", label: GENDER_LABELS.male },
          { value: "female", label: GENDER_LABELS.female },
        ]}
      />

      <FilterButtonGroup
        label="연령대"
        value={ageGroup}
        onChange={setAgeGroup}
        options={[
          { value: "all", label: "전체" },
          ...ageGroups.map((age) => ({
            value: age,
            label: AGE_GROUP_LABELS[age],
          })),
        ]}
      />

      {demographicFields.map((field, index) => (
        <FilterButtonGroup
          key={field.id}
          label={`구분자 ${index + 1} (${field.label})`}
          value={customFilters[field.id] ?? "all"}
          onChange={(value) =>
            setCustomFilters((prev) => ({ ...prev, [field.id]: value }))
          }
          options={[
            { value: "all", label: "전체" },
            ...field.options.map((option) => ({
              value: option,
              label: option,
            })),
          ]}
        />
      ))}

      <Button type="button" onClick={() => setShowAnswers(true)}>
        답안 표시
      </Button>

      {showAnswers && (
        <div className="space-y-4">
          {filteredBlocks.length === 0 ? (
            <p className="text-sm text-muted">
              선택한 조건에 해당하는 이유가 없습니다.
            </p>
          ) : (
            filteredBlocks.map((block) => (
              <div
                key={`${block.category}-${block.winningCombination}`}
                className="rounded-xl border border-border bg-slate-50 p-4"
              >
                <p className="text-sm font-semibold">
                  {block.category} · {block.winningCombination}
                </p>
                <div className="mt-3 space-y-2">
                  {block.reasons.map((reason, index) => (
                    <p key={`${block.winningCombination}-${index}`} className="text-sm">
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
