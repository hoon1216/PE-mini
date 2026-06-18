import ExcelJS from "exceljs";
import { demographicKey } from "./demographic-utils";
import type {
  DashboardSectionTable,
  DashboardStats,
  Gender,
} from "./types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "./types";

function formatNum(value: number | null | undefined): string | number {
  if (value === null || value === undefined) return "-";
  return value;
}

function rankingTableLabel(questionTitle: string): string {
  return questionTitle && questionTitle !== "순위 문항"
    ? questionTitle
    : "순위 선정형";
}

class SheetWriter {
  private row = 1;

  constructor(private sheet: ExcelJS.Worksheet) {}

  addBlank(lines = 1) {
    this.row += lines;
  }

  addTitle(text: string) {
    const row = this.sheet.getRow(this.row);
    row.getCell(1).value = text;
    row.font = { bold: true, size: 12 };
    this.row += 1;
  }

  addRows(rows: (string | number)[][]) {
    for (const values of rows) {
      const row = this.sheet.getRow(this.row);
      values.forEach((value, index) => {
        row.getCell(index + 1).value = value;
      });
      this.row += 1;
    }
  }
}

function writeDemographics(writer: SheetWriter, stats: DashboardStats) {
  const { demographics } = stats;
  const ageGroups = demographics.ageGroups;

  writer.addTitle("조사 대상");
  writer.addRows([
    ["총 인원", "성별", "", ...ageGroups.map((age) => AGE_GROUP_LABELS[age])],
    ["", "남", "여", ...ageGroups.map(() => "")],
    [
      demographics.total,
      demographics.male,
      demographics.female,
      ...ageGroups.map((age) => demographics.byAgeGroup[age] ?? 0),
    ],
  ]);

  for (const field of demographics.customFields) {
    writer.addBlank();
    writer.addRows([
      [field.label, ...field.options.slice(1).map(() => "")],
      field.options,
      field.options.map((option) => field.byOption[option] ?? 0),
    ]);
  }

  writer.addBlank(2);
}

function writeScoreTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "score" }>
) {
  const section = table.data;
  const ageGroups = section.ageGroups;
  const demoHeaders = ageGroups.flatMap((age) => [
    `${AGE_GROUP_LABELS[age]} 남`,
    `${AGE_GROUP_LABELS[age]} 남 순위`,
    `${AGE_GROUP_LABELS[age]} 여`,
    `${AGE_GROUP_LABELS[age]} 여 순위`,
  ]);

  writer.addTitle(`점수 부과형 — ${section.sectionTitle}`);
  writer.addRows([
    ["구분", "조합", "평균 점수", "평균 순위", ...demoHeaders],
  ]);

  const categorySpans: (number | null)[] = [];
  let index = 0;
  while (index < section.items.length) {
    const category = section.items[index].category;
    let span = 1;
    while (
      index + span < section.items.length &&
      section.items[index + span].category === category
    ) {
      span += 1;
    }
    categorySpans[index] = span;
    index += span;
  }

  section.items.forEach((item, itemIndex) => {
    const demoCells = ageGroups.flatMap((age) =>
      (["male", "female"] as Gender[]).flatMap((gender) => {
        const cell = item.byDemographic[demographicKey(age, gender)];
        return [formatNum(cell?.score), formatNum(cell?.rank)];
      })
    );

    writer.addRows([
      [
        categorySpans[itemIndex] !== null ? item.category : "",
        item.combination,
        formatNum(item.averageScore),
        formatNum(item.averageRank),
        ...demoCells,
      ],
    ]);
  });
  writer.addBlank(2);
}

function writeRankingTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "ranking" }>
) {
  const section = table.data;
  const ageGroups = section.ageGroups;
  const demoHeaders = ageGroups.flatMap((age) =>
    (["male", "female"] as Gender[]).flatMap(
      (gender) => [`${AGE_GROUP_LABELS[age]} ${GENDER_LABELS[gender]} 선택`, "%"]
    )
  );

  writer.addTitle(
    `${rankingTableLabel(section.questionTitle)} — ${section.sectionTitle}`
  );
  writer.addRows([
    [
      "조합",
      "1순위 선택",
      "1순위 %",
      "1+2순위 선택",
      "1+2순위 %",
      "1+2+3순위 선택",
      "1+2+3순위 %",
      ...demoHeaders,
    ],
  ]);

  for (const row of section.combinations) {
    const demoCells = ageGroups.flatMap((age) =>
      (["male", "female"] as Gender[]).flatMap((gender) => {
        const cell = row.byDemographic[demographicKey(age, gender)];
        return [cell?.count ?? 0, cell?.percent ?? 0];
      })
    );

    writer.addRows([
      [
        row.combination,
        row.rank1Count,
        row.rank1Percent,
        row.rank12Count,
        row.rank12Percent,
        row.rank123Count,
        row.rank123Percent,
        ...demoCells,
      ],
    ]);
  }
  writer.addBlank(2);
}

function writeTextTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "text" }>
) {
  const section = table.data;
  writer.addTitle(`주관식 — ${section.sectionTitle}`);

  if (section.groupedByRank1 && section.rankingQuestionTitle) {
    writer.addRows([[`${section.rankingQuestionTitle} 1순위 기준 그룹`]]);
  }

  for (const group of section.groups) {
    if (section.groupedByRank1) {
      writer.addRows([[group.groupName]]);
    }

    for (const item of group.items) {
      if (!section.groupedByRank1) {
        writer.addRows([[item.questionTitle]]);
      } else if (item.questionTitle) {
        writer.addRows([[item.questionTitle]]);
      }

      if (item.responses.length === 0) {
        writer.addRows([["답변 없음"]]);
        continue;
      }

      if (section.groupedByRank1) {
        writer.addRows([["성별", "연령대", "답변"]]);
        for (const response of item.responses) {
          writer.addRows([
            [
              response.gender ? GENDER_LABELS[response.gender] : "-",
              response.ageGroup ? AGE_GROUP_LABELS[response.ageGroup] : "-",
              response.value,
            ],
          ]);
        }
      } else {
        writer.addRows([["문항", "참가자", "성별", "연령대", "답변"]]);
        for (const response of item.responses) {
          writer.addRows([
            [
              item.questionTitle,
              response.participantName ?? "이름 없음",
              response.gender ? GENDER_LABELS[response.gender] : "-",
              response.ageGroup ? AGE_GROUP_LABELS[response.ageGroup] : "-",
              response.value,
            ],
          ]);
        }
      }
    }
  }
  writer.addBlank(2);
}

function writeChoiceComparisonTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "choice-comparison" }>
) {
  const section = table.data;
  writer.addTitle(`객관식 평가 비교 — ${section.sectionTitle}`);

  const segments = section.rankBlocks[0]?.segments ?? [];
  const rows = section.rankBlocks[0]?.rows ?? [];

  const headerGroupRow = section.rankBlocks.flatMap(() => {
    const groups: string[] = [];
    let current = "";
    for (const segment of segments) {
      if (segment.groupLabel !== current) {
        groups.push(segment.groupLabel);
        current = segment.groupLabel;
      } else {
        groups.push("");
      }
    }
    return groups;
  });

  writer.addRows([
    [
      "구분",
      "평가 항목",
      ...section.rankBlocks.flatMap((block) => [block.rank1Name, ...segments.slice(1).map(() => "")]),
    ],
    [
      "",
      "",
      ...headerGroupRow,
    ],
    [
      "",
      "",
      ...section.rankBlocks.flatMap(() =>
        segments.map((segment) => segment.label)
      ),
    ],
  ]);

  for (const row of rows) {
    writer.addRows([
      [
        row.category ?? "",
        row.itemLabel,
        ...section.rankBlocks.flatMap((block) => {
          const blockRow = block.rows.find(
            (item) => item.questionId === row.questionId
          );
          return segments.map((segment) => {
            const cell = blockRow?.cells[segment.key];
            if (!cell || cell.answered === 0) return "-";
            return `${cell.percent}%`;
          });
        }),
      ],
    ]);
  }

  writer.addBlank();
  writer.addTitle(section.reasonTitle);
  writer.addRows([["안", "선호 이유"]]);
  for (const group of section.reasonGroups) {
    if (group.responses.length === 0) {
      writer.addRows([[group.rank1Name, "답변 없음"]]);
      continue;
    }
    for (const [index, response] of group.responses.entries()) {
      writer.addRows([[index === 0 ? group.rank1Name : "", response]]);
    }
  }
  writer.addBlank(2);
}

function writeChoiceTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "choice" }>
) {
  const section = table.data;
  writer.addTitle(`${section.questionTitle} — ${section.sectionTitle}`);

  const hasOptions = section.groups.some((group) => group.options.length > 0);
  if (!hasOptions) {
    writer.addRows([["선택된 답변이 없습니다."]]);
    writer.addBlank(2);
    return;
  }

  if (section.groupedByRank1) {
    writer.addRows([["선택 1순위 컬러조합", "선택지", "선택 수", "1순위 별%"]]);
    for (const group of section.groups) {
      for (const option of group.options) {
        writer.addRows([
          [group.groupName, option.option, option.count, option.percent],
        ]);
      }
    }
  } else {
    writer.addRows([["선택지", "선택 수", "%"]]);
    for (const option of section.groups[0]?.options ?? []) {
      writer.addRows([[option.option, option.count, option.percent]]);
    }
  }
  writer.addBlank(2);
}

export async function buildDashboardExcelBuffer(
  surveyTitle: string,
  stats: DashboardStats
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PE-mini";
  const sheet = workbook.addWorksheet("대시보드");
  const writer = new SheetWriter(sheet);

  writer.addTitle(surveyTitle);
  writer.addRows([["총 응답 수", stats.totalResponses]]);
  writer.addBlank(2);

  writeDemographics(writer, stats);

  const orderedGroups = [...stats.sectionGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  for (const group of orderedGroups) {
    if (group.tables.length === 0) continue;
    writer.addTitle(group.sectionTitle);

    for (const table of group.tables) {
      if (table.type === "score") writeScoreTable(writer, table);
      if (table.type === "ranking") writeRankingTable(writer, table);
      if (table.type === "text") writeTextTable(writer, table);
      if (table.type === "choice-comparison") {
        writeChoiceComparisonTable(writer, table);
      }
      if (table.type === "choice") writeChoiceTable(writer, table);
    }
  }

  sheet.columns.forEach((column) => {
    column.width = 16;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
