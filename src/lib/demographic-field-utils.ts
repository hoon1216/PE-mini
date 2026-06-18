import { nanoid } from "nanoid";
import type { DemographicFieldConfig } from "./types";

export function createDefaultDemographicField(): DemographicFieldConfig {
  return {
    id: nanoid(8),
    label: "가전보유 여부",
    options: ["보유함", "보유하지 않음"],
  };
}

export function normalizeDemographicFields(
  raw: unknown
): DemographicFieldConfig[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim()
          : nanoid(8);
      const options = Array.isArray(record.options)
        ? record.options
            .map((option) => (typeof option === "string" ? option.trim() : ""))
            .filter(Boolean)
        : [];

      if (!label || options.length < 2) return null;

      return { id, label, options };
    })
    .filter((field): field is DemographicFieldConfig => field !== null);
}

export function normalizeDemographicValues(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim()) {
      result[key] = value.trim();
    }
  }
  return result;
}

export function validateDemographicValues(
  fields: DemographicFieldConfig[],
  values: Record<string, string> | undefined
): string | null {
  const selectedValues = values ?? {};

  for (const field of fields) {
    const selected = selectedValues[field.id];
    if (!selected) {
      return `${field.label}을(를) 선택해주세요.`;
    }
    if (!field.options.includes(selected)) {
      return `${field.label} 선택값이 올바르지 않습니다.`;
    }
  }

  return null;
}

export function isDemographicProfileComplete(
  fields: DemographicFieldConfig[],
  values: Record<string, string> | undefined
): boolean {
  return validateDemographicValues(fields, values) === null;
}
