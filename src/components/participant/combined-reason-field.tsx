"use client";

import {
  defaultReasonLabel,
  getReasonFieldConfig,
} from "@/lib/combined-reason-utils";
import type { Question } from "@/lib/types";

interface CombinedReasonFieldProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function CombinedReasonField({
  question,
  value,
  onChange,
  label,
}: CombinedReasonFieldProps) {
  const { placeholder, maxLength } = getReasonFieldConfig(question);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <label
        htmlFor={`reason-${question.id}`}
        className="block text-sm font-medium"
      >
        {label ?? defaultReasonLabel(question)}
      </label>
      <textarea
        id={`reason-${question.id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      <p className="text-right text-xs text-muted">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
