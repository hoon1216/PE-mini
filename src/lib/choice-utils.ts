import type { ChoiceQuestionConfig } from "./types";

export function normalizeChoiceSelectCount(
  selectCount: number | undefined,
  optionCount: number
): number {
  const max = Math.max(1, optionCount);
  const count = selectCount ?? 1;
  return Math.min(Math.max(1, Math.floor(count)), max);
}

export function choiceSelectCount(config: ChoiceQuestionConfig): number {
  return normalizeChoiceSelectCount(config.selectCount, config.options.length);
}

export function parseChoiceAnswer(
  value: string | string[] | undefined,
  selectCount: number
): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  if (!value) return [];

  if (selectCount <= 1) {
    return value ? [value] : [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Legacy single-value string stored before multi-select support.
  }

  return value ? [value] : [];
}

export function serializeChoiceAnswer(
  selected: string[],
  selectCount: number
): string {
  if (selectCount <= 1) {
    return selected[0] ?? "";
  }
  return JSON.stringify(selected);
}

export function validateChoiceAnswer(
  selected: string[],
  options: string[],
  selectCount: number
): string | null {
  const required = choiceSelectCount({ options, selectCount });

  if (selected.length !== required) {
    return required === 1
      ? "객관식 문항에서 선택지를 선택해주세요."
      : `객관식 문항에서 ${required}개의 선택지를 선택해주세요.`;
  }

  const unique = new Set(selected);
  if (unique.size !== selected.length) {
    return "객관식 문항에서 중복된 선택지를 고를 수 없습니다.";
  }

  for (const item of selected) {
    if (!options.includes(item)) {
      return "유효하지 않은 선택지입니다.";
    }
  }

  return null;
}

export function toggleChoiceSelection(
  current: string[],
  option: string,
  selectCount: number
): string[] {
  if (selectCount <= 1) {
    return [option];
  }

  if (current.includes(option)) {
    return current.filter((item) => item !== option);
  }

  if (current.length >= selectCount) {
    return current;
  }

  return [...current, option];
}
