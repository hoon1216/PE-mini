import { describe, expect, it } from "vitest";
import { dashboardTableKey } from "./dashboard-layout";
import type { DashboardSectionTable } from "./types";

describe("dashboardTableKey", () => {
  it("uses question id for per-question tables", () => {
    const rankingTable: DashboardSectionTable = {
      type: "ranking",
      data: {
        questionId: "q-rank",
      } as never,
    };

    expect(dashboardTableKey("section-1", rankingTable)).toBe(
      "section-1-ranking-q-rank"
    );
  });
});
