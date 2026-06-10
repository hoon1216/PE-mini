interface ScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function ScoreSlider({ value, onChange }: ScoreSliderProps) {
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>1점</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-base font-bold text-primary">
          {value}점
        </span>
        <span>5점</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="score-slider w-full cursor-pointer"
        aria-label={`점수 ${value}점`}
      />
      <div className="mt-1 flex justify-between px-0.5 text-[10px] text-muted">
        {[1, 2, 3, 4, 5].map((score) => (
          <span
            key={score}
            className={value === score ? "font-semibold text-primary" : ""}
          >
            {score}
          </span>
        ))}
      </div>
    </div>
  );
}
