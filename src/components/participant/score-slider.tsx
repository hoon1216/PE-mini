"use client";

import { useEffect, useState } from "react";

interface ScoreSliderProps {
  value: number;
  isSet: boolean;
  onChange: (value: number) => void;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export function ScoreSlider({ value, isSet, onChange }: ScoreSliderProps) {
  const [touched, setTouched] = useState(isSet);
  const active = touched || isSet;

  useEffect(() => {
    if (isSet) setTouched(true);
  }, [isSet]);

  function select(score: number) {
    setTouched(true);
    onChange(score);
  }

  const primary = active ? "#2563eb" : "#ef4444";
  const secondary = active ? "#dbeafe" : "#fee2e2";

  return (
    <div className="mt-3">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>1점</span>
        <span
          className="rounded-full px-3 py-1 text-base font-bold"
          style={{
            color: primary,
            backgroundColor: active ? "rgb(37 99 235 / 0.12)" : "rgb(254 226 226)",
          }}
        >
          {active ? `${value}점` : "선택"}
        </span>
        <span>5점</span>
      </div>

      <div className="relative px-1 py-2">
        <div
          className="absolute left-5 right-5 top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: active ? "#bfdbfe" : "#fecaca" }}
        />
        <div className="relative flex justify-between">
          {SCORES.map((score) => {
            const selected = active && value === score;
            return (
              <button
                type="button"
                key={score}
                onClick={() => select(score)}
                aria-label={`${score}점`}
                aria-pressed={selected}
                className="relative z-10 h-10 w-10 rounded-full border-2 border-white shadow-md transition-transform active:scale-95"
                style={{
                  backgroundColor: selected ? primary : secondary,
                  boxShadow: selected
                    ? `0 0 0 3px ${primary}33`
                    : "0 1px 4px rgb(15 23 42 / 15%)",
                }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: selected ? "#ffffff" : primary }}
                >
                  {score}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
