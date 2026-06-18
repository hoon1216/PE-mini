import type { ChoiceQuestionConfig, ChoiceSelectionMode } from "./types";

export function choiceSelectionMode(
  config: ChoiceQuestionConfig
): ChoiceSelectionMode {
  if (config.selectionMode) return config.selectionMode;
  return (config.selectCount ?? 1) <= 1 ? "single" : "multiple";
}

export function isSingleChoice(config: ChoiceQuestionConfig): boolean {
  return choiceSelectionMode(config) === "single";
}

/** @deprecated use choiceSelectionMode */
export function choiceSelectCount(config: ChoiceQuestionConfig): number {
  return isSingleChoice(config) ? 1 : config.options.length;
}

export function parseChoiceAnswer(
  value: string | string[] | undefined,
  config: ChoiceQuestionConfig
): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "selected" in parsed &&
      Array.isArray((parsed as { selected?: unknown }).selected)
    ) {
      return (parsed as { selected: unknown[] }).selected.filter(
        (item): item is string => typeof item === "string"
      );
    }
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Legacy single-value string stored before multi-select support.
  }

  if (isSingleChoice(config)) {
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
  config: ChoiceQuestionConfig
): string {
  if (isSingleChoice(config)) {
    return selected[0] ?? "";
  }
  return JSON.stringify(selected);
}

export function validateChoiceAnswer(
  selected: string[],
  config: ChoiceQuestionConfig
): string | null {
  const { options } = config;

  if (selected.length === 0) {
    return "객관식 문항에서 선택지를 선택해주세요.";
  }

  if (isSingleChoice(config) && selected.length !== 1) {
    return "객관식 문항에서 1개의 선택지를 선택해주세요.";
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
  config: ChoiceQuestionConfig
): string[] {
  if (isSingleChoice(config)) {
    return [option];
  }

  if (current.includes(option)) {
    return current.filter((item) => item !== option);
  }

  return [...current, option];
}
