"use client";

import { useEffect, useState } from "react";
import { SCORE_LABELS, SCORE_MAX, SCORE_MIN, SCORE_VALUES } from "@/lib/types";

interface ScoreSliderProps {
  value: number;
  isSet: boolean;
  onChange: (value: number) => void;
  /** Scores already assigned to other design options in the same question. */
  disabledScores?: number[];
}

export function ScoreSlider({
  value,
  isSet,
  onChange,
  disabledScores = [],
}: ScoreSliderProps) {
  const [touched, setTouched] = useState(isSet);
  const active = touched || isSet;

  useEffect(() => {
    if (isSet) setTouched(true);
  }, [isSet]);

  function select(score: number) {
    if (disabledScores.includes(score)) return;
    setTouched(true);
    onChange(score);
  }

  const primary = active ? "#2563eb" : "#ef4444";
  const secondary = active ? "#dbeafe" : "#fee2e2";

  return (
    <div className="mt-3">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>{SCORE_MIN}점</span>
        <span
          className="rounded-full px-3 py-1 text-base font-bold"
          style={{
            color: primary,
            backgroundColor: active ? "rgb(37 99 235 / 0.12)" : "rgb(254 226 226)",
          }}
        >
          {active ? `${value}점` : "선택"}
        </span>
        <span>{SCORE_MAX}점</span>
      </div>

      <div className="relative px-1 py-2">
        <div
          className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: active ? "#bfdbfe" : "#fecaca" }}
        />
        <div className="relative flex justify-between gap-0.5">
          {SCORE_VALUES.map((score) => {
            const selected = active && value === score;
            const disabled = disabledScores.includes(score);
            return (
              <button
                type="button"
                key={score}
                onClick={() => select(score)}
                disabled={disabled}
                aria-label={`${score}점 ${SCORE_LABELS[score]}`}
                aria-pressed={selected}
                className={`relative z-10 flex w-9 items-center justify-center sm:w-10 ${
                  disabled ? "cursor-not-allowed opacity-40" : ""
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform active:scale-95 sm:h-10 sm:w-10"
                  style={{
                    backgroundColor: selected ? primary : secondary,
                    boxShadow: selected
                      ? `0 0 0 3px ${primary}33`
                      : "0 1px 4px rgb(15 23 42 / 15%)",
                  }}
                >
                  <span
                    className="text-xs font-bold sm:text-sm"
                    style={{ color: selected ? "#ffffff" : primary }}
                  >
                    {score}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
