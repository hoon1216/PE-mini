import ExcelJS from "exceljs";
import { formatChoiceSegmentCell } from "./choice-dashboard-stats";
import { demographicKey, scoreCustomFieldKey } from "./demographic-utils";
import {
  textDemographicHeaderRow,
  textDemographicValueRow,
} from "./text-demographic-stats";
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
  const customHeaders = demographics.customFields.flatMap((field) =>
    field.options.map((option) => `${field.label} ${option}`)
  );

  writer.addTitle("조사 대상");
  writer.addRows([
    ["총 인원", "남", "여", ...ageGroups.map((age) => AGE_GROUP_LABELS[age]), ...customHeaders],
    [
      demographics.total,
      demographics.male,
      demographics.female,
      ...ageGroups.map((age) => demographics.byAgeGroup[age] ?? 0),
      ...demographics.customFields.flatMap((field) =>
        field.options.map((option) => field.byOption[option] ?? 0)
      ),
    ],
  ]);

  writer.addBlank(2);
}

function writeScoreTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "score" }>
) {
  const section = table.data;
  const ageGroups = section.ageGroups;
  const customField = section.customField;
  const demoHeaders = ageGroups.flatMap((age) => [
    `${AGE_GROUP_LABELS[age]} 남`,
    `${AGE_GROUP_LABELS[age]} 남 순위`,
    `${AGE_GROUP_LABELS[age]} 여`,
    `${AGE_GROUP_LABELS[age]} 여 순위`,
  ]);
  const customHeaders =
    customField?.options.flatMap((option) => [
      `${customField.label} ${option}`,
      `${customField.label} ${option} 순위`,
    ]) ?? [];

  writer.addTitle(section.sectionTitle);
  writer.addRows([
    [
      "구분",
      "디자인 안",
      "평균 점수",
      "평균 순위",
      ...customHeaders,
      ...demoHeaders,
    ],
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
    const customCells =
      customField?.options.flatMap((option) => {
        const cell =
          item.byCustomField[scoreCustomFieldKey(customField.fieldId, option)];
        return [formatNum(cell?.score), formatNum(cell?.rank)];
      }) ?? [];
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
        ...customCells,
        ...demoCells,
      ],
    ]);
  });
  writer.addBlank(2);
}

function writeScoreCompareTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "score-compare" }>
) {
  const { scoreStats, sectionTitle } = table.data;
  const { segments, items } = scoreStats;

  writer.addTitle(sectionTitle);
  writer.addRows([
    ["구분", "디자인 안", ...segments.map((segment) => `${segment.groupLabel} ${segment.label}`)],
  ]);

  const categorySpans: (number | null)[] = [];
  let index = 0;
  while (index < items.length) {
    const category = items[index].category;
    let span = 1;
    while (
      index + span < items.length &&
      items[index + span].category === category
    ) {
      span += 1;
    }
    categorySpans[index] = span;
    index += span;
  }

  items.forEach((item, itemIndex) => {
    writer.addRows([
      [
        categorySpans[itemIndex] !== null ? item.category : "",
        item.combination,
        ...segments.map((segment) => formatNum(item.bySegment[segment.key])),
      ],
    ]);
  });

  writer.addBlank();

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

  writer.addTitle(section.sectionTitle);
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
  writer.addTitle(section.sectionTitle);

  if (section.groupedByFinalDesignRank1) {
    writer.addRows([["최종 디자인 1순위 기준"]]);
  }

  const hideRank1 =
    section.rank1Names.length === 1 && section.rank1Names[0] === "전체";

  for (const item of section.demographicItems) {
    if (section.demographicItems.length > 1) {
      writer.addRows([[item.questionTitle]]);
    }

    for (const rank1Name of section.rank1Names) {
      if (!hideRank1) {
        writer.addRows([[rank1Name]]);
      }

      writer.addRows([textDemographicHeaderRow(section.ageGroups)]);
      writer.addRows([
        textDemographicValueRow(
          section.ageGroups,
          item.byRank1Demographic[rank1Name] ?? {}
        ),
      ]);
    }
  }
  writer.addBlank(2);
}

function writeChoiceComparisonTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "choice-comparison" }>
) {
  const section = table.data;
  writer.addTitle(section.sectionTitle);

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
    const categoryCell = row.category ?? "";
    const itemCell = row.category ? row.itemLabel : row.itemLabel;

    writer.addRows([
      [
        row.category ? categoryCell : row.itemLabel,
        row.category ? itemCell : "",
        ...section.rankBlocks.flatMap((block) => {
          const blockRow = block.rows.find(
            (item) => item.questionId === row.questionId
          );
          return segments.map((segment) => {
            const cell = blockRow?.cells[segment.key];
            if (!cell || cell.answered === 0) return "-";
            return `${cell.percent}% (${cell.count})`;
          });
        }),
      ],
    ]);
  }

  writer.addBlank();
  writer.addTitle(section.reasonTitle);
  if (section.reasonDemographic.rank1Names.some((name) => name !== "전체")) {
    writer.addRows([["최종 디자인 1순위 기준"]]);
  }

  const hideRank1 =
    section.reasonDemographic.rank1Names.length === 1 &&
    section.reasonDemographic.rank1Names[0] === "전체";

  for (const rank1Name of section.reasonDemographic.rank1Names) {
    if (!hideRank1) {
      writer.addRows([[rank1Name]]);
    }
    writer.addRows([
      textDemographicHeaderRow(section.reasonDemographic.ageGroups),
    ]);
    writer.addRows([
      textDemographicValueRow(
        section.reasonDemographic.ageGroups,
        section.reasonDemographic.byRank1Demographic[rank1Name] ?? {}
      ),
    ]);
  }

  for (const reasonSection of section.combinedReasonSections) {
    writer.addTitle(reasonSection.tableLabel);
    for (const entry of reasonSection.entries) {
      writer.addRows([[entry.reason]]);
    }
    writer.addBlank();
  }

  writer.addBlank(2);
}

function writeCombinedReasonTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "combined-reason" }>
) {
  const section = table.data;
  writer.addTitle(section.tableLabel);
  for (const entry of section.entries) {
    writer.addRows([[entry.reason]]);
  }
  writer.addBlank(2);
}

function writeChoiceTable(
  writer: SheetWriter,
  table: Extract<DashboardSectionTable, { type: "choice" }>
) {
  const section = table.data;
  writer.addTitle(section.questionTitle);

  if (section.dashboardStats) {
    const { segments, items } = section.dashboardStats;
    writer.addRows([
      [
        "구분",
        "디자인 안",
        ...segments.map((segment) => `${segment.groupLabel} ${segment.label}`),
      ],
    ]);

    const categorySpans: (number | null)[] = [];
    let index = 0;
    while (index < items.length) {
      const category = items[index].category;
      let span = 1;
      while (
        index + span < items.length &&
        items[index + span].category === category
      ) {
        span += 1;
      }
      categorySpans[index] = span;
      index += span;
    }

    items.forEach((item, itemIndex) => {
      writer.addRows([
        [
          categorySpans[itemIndex] !== null ? item.category : "",
          item.option,
          ...segments.map((segment) =>
            formatChoiceSegmentCell(item.bySegment[segment.key])
          ),
        ],
      ]);
    });
    writer.addBlank(2);
    return;
  }

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
          [
            group.groupName,
            option.option,
            option.count,
            `${option.percent}% (${option.count})`,
          ],
        ]);
      }
    }
  } else {
    writer.addRows([["선택지", "선택 수", "%"]]);
    for (const option of section.groups[0]?.options ?? []) {
      writer.addRows([
        [option.option, option.count, `${option.percent}% (${option.count})`],
      ]);
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

  for (const section of [...stats.sectionGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder
  )) {
    if (section.tables.length === 0) continue;

    writer.addTitle(section.sectionTitle);

    for (const table of section.tables) {
      if (table.type === "score") writeScoreTable(writer, table);
      if (table.type === "score-compare") writeScoreCompareTable(writer, table);
      if (table.type === "ranking") writeRankingTable(writer, table);
      if (table.type === "text") writeTextTable(writer, table);
      if (table.type === "choice-comparison") {
        writeChoiceComparisonTable(writer, table);
      }
      if (table.type === "choice") writeChoiceTable(writer, table);
      if (table.type === "combined-reason") {
        writeCombinedReasonTable(writer, table);
      }
    }
  }

  sheet.columns.forEach((column) => {
    column.width = 16;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
