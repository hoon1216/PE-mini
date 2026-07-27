import type { DashboardSectionTable } from "./types";

export type DashboardTableKind = DashboardSectionTable["type"];

export interface DashboardTableEntry {
  key: string;
  sectionId: string;
  sectionTitle: string;
  sectionSortOrder: number;
  table: DashboardSectionTable;
}

export function dashboardTableKey(
  sectionId: string,
  table: DashboardSectionTable
): string {
  switch (table.type) {
    case "ranking":
      return `${sectionId}-ranking-${table.data.questionId}`;
    case "choice":
      return `${sectionId}-choice-${table.data.questionId}`;
    case "combined-reason":
      return table.data.optionLabel
        ? `${sectionId}-combined-reason-${table.data.questionId}-${table.data.optionLabel}`
        : `${sectionId}-combined-reason-${table.data.questionId}`;
    default:
      return `${sectionId}-${table.type}`;
  }
}

export function dashboardTableTitle(entry: DashboardTableEntry): string {
  const { table, sectionTitle } = entry;

  switch (table.type) {
    case "ranking": {
      const questionTitle = table.data.questionTitle;
      if (questionTitle && questionTitle !== "순위 문항") {
        return questionTitle;
      }
      return table.data.sectionTitle || sectionTitle;
    }
    case "choice":
      if (table.data.dashboardStats) {
        return table.data.sectionTitle || sectionTitle;
      }
      return table.data.questionTitle;
    case "combined-reason":
      return table.data.tableLabel;
    case "score":
    case "score-compare":
    case "attribute-eval":
    case "choice-comparison":
      return table.data.sectionTitle || sectionTitle;
    default:
      return sectionTitle;
  }
}
