"use client";

import { useEffect, useState } from "react";

interface ScoreSliderProps {
  value: number;
  isSet: boolean;
  onChange: (value: number) => void;
}

export function ScoreSlider({ value, isSet, onChange }: ScoreSliderProps) {
  const [touched, setTouched] = useState(isSet);
  const active = touched || isSet;

  useEffect(() => {
    if (isSet) setTouched(true);
  }, [isSet]);

  function handleChange(nextValue: number) {
    setTouched(true);
    onChange(nextValue);
  }

  const thumbColor = active ? "#2563eb" : "#ef4444";
  const dotActiveColor = active ? "#2563eb" : "#ef4444";
  const dotInactiveColor = active ? "#93c5fd" : "#fca5a5";

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>1점</span>
        <span
          className="rounded-full px-3 py-1 text-base font-bold"
          style={{
            color: thumbColor,
            backgroundColor: active ? "rgb(37 99 235 / 0.1)" : "rgb(254 226 226)",
          }}
        >
          {active ? `${value}점` : "선택"}
        </span>
        <span>5점</span>
      </div>

      <div className="px-1">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => handleChange(Number(e.target.value))}
          onInput={(e) => handleChange(Number(e.currentTarget.value))}
          className={`score-slider w-full cursor-pointer ${
            active ? "score-slider--set" : "score-slider--unset"
          }`}
          style={{ "--thumb-color": thumbColor } as React.CSSProperties}
          aria-label={active ? `점수 ${value}점` : "점수 선택"}
        />

        <div className="mt-2 flex justify-between px-0.5">
          {[1, 2, 3, 4, 5].map((score) => (
            <span
              key={score}
              className="flex flex-col items-center gap-1"
            >
              <span
                className="block h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    value === score ? dotActiveColor : dotInactiveColor,
                }}
              />
              <span
                className="text-[10px] text-muted"
                style={{
                  color: value === score ? thumbColor : undefined,
                  fontWeight: value === score ? 600 : 400,
                }}
              >
                {score}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
