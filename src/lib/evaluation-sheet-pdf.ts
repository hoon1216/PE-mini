import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type {
  BodyColumnData,
  EvaluationSheet,
  GroupRankRow,
  ScoreRow,
} from "./evaluation-sheet-data";

type PdfDoc = InstanceType<typeof PDFDocument>;

const FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSansKR-Regular.otf"
);

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 24;

function loadKoreanFont(): Buffer {
  if (!fs.existsSync(FONT_PATH)) {
    throw new Error(
      "한글 PDF 폰트를 찾을 수 없습니다. npm install 후 다시 시도해주세요."
    );
  }
  return fs.readFileSync(FONT_PATH);
}

function drawText(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: { align?: "left" | "center" | "right"; fontSize?: number }
) {
  const fontSize = options?.fontSize ?? 8;
  doc.fontSize(fontSize).text(text, x, y, {
    width,
    align: options?.align ?? "center",
    lineBreak: false,
  });
}

function drawRect(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  height: number
) {
  doc.rect(x, y, width, height).stroke();
}

function drawScoreTable(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  rows: ScoreRow[]
): number {
  const colWidths = [width * 0.2, width * 0.48, width * 0.16, width * 0.16];
  const headerHeight = 16;
  const rowHeight = 13;
  const tableHeight = headerHeight * 2 + rows.length * rowHeight;
  let cursorY = y;

  drawRect(doc, x, cursorY, width, tableHeight);

  let colX = x;
  for (let i = 0; i < colWidths.length; i++) {
    if (i > 0) doc.moveTo(colX, y).lineTo(colX, y + tableHeight).stroke();
    colX += colWidths[i];
  }

  doc.moveTo(x, y + headerHeight).lineTo(x + width, y + headerHeight).stroke();
  doc
    .moveTo(x + colWidths[0] + colWidths[1], y + headerHeight)
    .lineTo(x + width, y + headerHeight)
    .stroke();

  drawText(doc, "구분", x, y + 4, colWidths[0]);
  drawText(doc, "조합", x + colWidths[0], y + 4, colWidths[1]);
  drawText(
    doc,
    "평균",
    x + colWidths[0] + colWidths[1],
    y + 2,
    colWidths[2] + colWidths[3]
  );
  drawText(
    doc,
    "점수",
    x + colWidths[0] + colWidths[1],
    y + headerHeight + 2,
    colWidths[2]
  );
  drawText(
    doc,
    "순위",
    x + colWidths[0] + colWidths[1] + colWidths[2],
    y + headerHeight + 2,
    colWidths[3]
  );

  cursorY = y + headerHeight * 2;

  let index = 0;
  while (index < rows.length) {
    const category = rows[index].category;
    let span = 1;
    while (
      index + span < rows.length &&
      rows[index + span].category === category
    ) {
      span += 1;
    }

    const spanHeight = span * rowHeight;
    doc
      .moveTo(x, cursorY)
      .lineTo(x + width, cursorY)
      .stroke();
    doc
      .moveTo(x + colWidths[0], cursorY)
      .lineTo(x + colWidths[0], cursorY + spanHeight)
      .stroke();
    doc
      .moveTo(x + colWidths[0] + colWidths[1], cursorY)
      .lineTo(x + colWidths[0] + colWidths[1], cursorY + spanHeight)
      .stroke();
    doc
      .moveTo(x + colWidths[0] + colWidths[1] + colWidths[2], cursorY)
      .lineTo(x + colWidths[0] + colWidths[1] + colWidths[2], cursorY + spanHeight)
      .stroke();

    drawText(doc, category, x, cursorY + 4, colWidths[0], { fontSize: 7 });

    for (let offset = 0; offset < span; offset++) {
      const row = rows[index + offset];
      const rowY = cursorY + offset * rowHeight;
      if (offset > 0) {
        doc
          .moveTo(x + colWidths[0], rowY)
          .lineTo(x + width, rowY)
          .stroke();
      }

      drawText(
        doc,
        row.combination,
        x + colWidths[0] + 2,
        rowY + 3,
        colWidths[1] - 4,
        { align: "left", fontSize: 7 }
      );
      drawText(
        doc,
        row.score === null ? "" : String(row.score),
        x + colWidths[0] + colWidths[1],
        rowY + 3,
        colWidths[2],
        { fontSize: 7 }
      );
      drawText(
        doc,
        row.rank === null ? "" : String(row.rank),
        x + colWidths[0] + colWidths[1] + colWidths[2],
        rowY + 3,
        colWidths[3],
        { fontSize: 7 }
      );
    }

    cursorY += spanHeight;
    index += span;
  }

  return y + tableHeight;
}

function drawGroupRankTable(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  rows: GroupRankRow[]
): number {
  const colWidths = [width * 0.68, width * 0.32];
  const rowHeight = 14;
  const tableHeight = rowHeight * (rows.length + 1);

  drawRect(doc, x, y, width, tableHeight);

  const dividerX = x + colWidths[0];
  doc.moveTo(dividerX, y).lineTo(dividerX, y + tableHeight).stroke();
  doc.moveTo(x, y + rowHeight).lineTo(x + width, y + rowHeight).stroke();

  drawText(doc, "", x, y + 3, colWidths[0]);
  drawText(doc, "순위", x + colWidths[0], y + 3, colWidths[1]);

  rows.forEach((row, index) => {
    const rowY = y + rowHeight * (index + 1);
    if (index < rows.length - 1) {
      doc.moveTo(x, rowY + rowHeight).lineTo(x + width, rowY + rowHeight).stroke();
    }
    drawText(doc, row.label, x, rowY + 3, colWidths[0], { fontSize: 7 });
    drawText(
      doc,
      row.rank === null ? "" : String(row.rank),
      x + colWidths[0],
      rowY + 3,
      colWidths[1],
      { fontSize: 7 }
    );
  });

  return y + tableHeight;
}

function drawReasonBox(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  title: string,
  text: string,
  minContentLines = 2
): number {
  const lineCount = text ? text.split("\n").length : minContentLines;
  const boxHeight = 14 + Math.max(minContentLines, lineCount) * 11;
  drawRect(doc, x, y, width, boxHeight);
  drawText(doc, title, x, y + 3, width, { fontSize: 7 });
  doc
    .moveTo(x, y + 14)
    .lineTo(x + width, y + 14)
    .stroke();

  if (text) {
    doc.fontSize(7).text(text, x + 4, y + 17, {
      width: width - 8,
      height: boxHeight - 20,
      align: "left",
      lineBreak: true,
    });
  }

  return y + boxHeight;
}

function drawBodyColumn(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  column: BodyColumnData
): number {
  drawText(doc, column.sectionTitle, x, y, width, { fontSize: 10 });
  let cursorY = y + 16;

  cursorY = drawScoreTable(doc, x, cursorY, width, column.scoreRows) + 6;
  cursorY = drawGroupRankTable(doc, x, cursorY, width, column.groupRanks) + 6;
  cursorY = drawReasonBox(
    doc,
    x,
    cursorY,
    width,
    "1순위 이유",
    column.firstRankReason
  );

  return cursorY;
}

function drawPreferredGrillTable(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  sheet: EvaluationSheet
): number {
  const labelWidth = width * 0.18;
  const valueWidth = width - labelWidth;
  const rowHeight = 16;
  const tableHeight = rowHeight * 4;

  drawRect(doc, x, y, width, tableHeight);
  drawText(doc, "선호 스피커 그릴", x, y + 3, width, { fontSize: 8 });

  const bodyY = y + rowHeight;
  doc.moveTo(x, bodyY).lineTo(x + width, bodyY).stroke();
  doc.moveTo(x + labelWidth, bodyY).lineTo(x + labelWidth, y + tableHeight).stroke();

  const ranks = [
    { label: "1순위", value: sheet.preferredGrill.rank1 },
    { label: "2순위", value: sheet.preferredGrill.rank2 },
    { label: "3순위", value: sheet.preferredGrill.rank3 },
  ];

  ranks.forEach((row, index) => {
    const rowY = bodyY + rowHeight * index;
    if (index > 0) {
      doc.moveTo(x, rowY).lineTo(x + width, rowY).stroke();
    }
    drawText(doc, row.label, x, rowY + 4, labelWidth, { fontSize: 7 });
    drawText(
      doc,
      row.value,
      x + labelWidth + 2,
      rowY + 4,
      valueWidth - 4,
      { align: "left", fontSize: 7 }
    );
  });

  return y + tableHeight;
}

function renderSheetPage(doc: PdfDoc, sheet: EvaluationSheet) {
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = MARGIN;

  drawText(
    doc,
    `이름  ${sheet.participantName || "-"}`,
    MARGIN,
    y,
    contentWidth * 0.34,
    { align: "left", fontSize: 9 }
  );
  drawText(
    doc,
    `성별  ${sheet.genderLabel}`,
    MARGIN + contentWidth * 0.34,
    y,
    contentWidth * 0.22,
    { align: "left", fontSize: 9 }
  );
  drawText(
    doc,
    `연령대  ${sheet.ageGroupLabel}`,
    MARGIN + contentWidth * 0.56,
    y,
    contentWidth * 0.44,
    { align: "left", fontSize: 9 }
  );

  y += 16;
  for (const line of sheet.demographicLines) {
    drawText(
      doc,
      `${line.label}  ${line.value}`,
      MARGIN,
      y,
      contentWidth,
      { align: "left", fontSize: 9 }
    );
    y += 14;
  }

  y += 8;

  const columns = sheet.bodyColumns;
  const gap = 10;
  const columnWidth =
    columns.length > 1
      ? (contentWidth - gap * (columns.length - 1)) / columns.length
      : contentWidth;

  let bottomY = y;
  columns.forEach((column, index) => {
    const columnX = MARGIN + index * (columnWidth + gap);
    const columnBottom = drawBodyColumn(doc, columnX, y, columnWidth, column);
    bottomY = Math.max(bottomY, columnBottom);
  });

  y = bottomY + 10;
  y = drawPreferredGrillTable(doc, MARGIN, y, contentWidth, sheet) + 8;
  drawReasonBox(
    doc,
    MARGIN,
    y,
    contentWidth,
    "1순위 선호 이유",
    sheet.preferredReason,
    4
  );
}

export async function buildEvaluationSheetsPdfBuffer(
  sheets: EvaluationSheet[]
): Promise<Buffer> {
  const fontBuffer = loadKoreanFont();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margin: 0,
      autoFirstPage: false,
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Korean", fontBuffer);
    doc.font("Korean");

    if (sheets.length === 0) {
      doc.addPage();
      doc.fontSize(12).text("제출된 평가가 없습니다.", MARGIN, MARGIN, {
        width: PAGE_WIDTH - MARGIN * 2,
        align: "center",
      });
      doc.end();
      return;
    }

    for (const sheet of sheets) {
      doc.addPage();
      renderSheetPage(doc, sheet);
    }

    doc.end();
  });
}
