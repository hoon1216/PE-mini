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
      return table.data.questionTitle;
    case "score":
    case "text":
    case "score-compare":
    case "choice-comparison":
      return table.data.sectionTitle || sectionTitle;
    default:
      return sectionTitle;
  }
}
