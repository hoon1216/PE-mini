interface ScoreSliderProps {
  value: number;
  isSet: boolean;
  onChange: (value: number) => void;
}

export function ScoreSlider({ value, isSet, onChange }: ScoreSliderProps) {
  const activeColor = isSet ? "text-primary" : "text-red-500";
  const activeBg = isSet ? "bg-primary/10" : "bg-red-50";
  const dotActive = isSet ? "bg-primary" : "bg-red-500";
  const dotInactive = isSet ? "bg-blue-200" : "bg-red-300";

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>1점</span>
        <span
          className={`rounded-full px-3 py-1 text-base font-bold ${activeBg} ${activeColor}`}
        >
          {isSet ? `${value}점` : "선택"}
        </span>
        <span>5점</span>
      </div>

      <div className="relative px-1">
        <div className="pointer-events-none absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-between">
          {[1, 2, 3, 4, 5].map((score) => (
            <span
              key={score}
              className={`h-2.5 w-2.5 rounded-full ${
                value === score ? dotActive : dotInactive
              }`}
            />
          ))}
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`score-slider w-full cursor-pointer ${
            isSet ? "score-slider--set" : "score-slider--unset"
          }`}
          aria-label={isSet ? `점수 ${value}점` : "점수 선택"}
        />
      </div>

      <div className="mt-1 flex justify-between px-0.5 text-[10px] text-muted">
        {[1, 2, 3, 4, 5].map((score) => (
          <span
            key={score}
            className={
              value === score ? `font-semibold ${activeColor}` : undefined
            }
          >
            {score}
          </span>
        ))}
      </div>
    </div>
  );
}
