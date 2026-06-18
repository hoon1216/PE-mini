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

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-2.5 py-1 text-sm transition ${
        selected
          ? "border-primary bg-primary text-white"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function InlineFilterGroup({
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
    <div className="flex shrink-0 items-center gap-2">
      <span className="whitespace-nowrap text-sm font-medium text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <FilterChip
            key={`${label}-${option.value}`}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </FilterChip>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <InlineFilterGroup
          label="성별"
          value={gender}
          onChange={setGender}
          options={[
            { value: "all", label: "전체" },
            { value: "male", label: GENDER_LABELS.male },
            { value: "female", label: GENDER_LABELS.female },
          ]}
        />

        <InlineFilterGroup
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
          <InlineFilterGroup
            key={field.id}
            label={`구분자${index + 1}`}
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

        <Button
          type="button"
          className="shrink-0"
          onClick={() => setShowAnswers(true)}
        >
          답안 표시
        </Button>
      </div>

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
                    <p
                      key={`${block.winningCombination}-${index}`}
                      className="text-sm"
                    >
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
