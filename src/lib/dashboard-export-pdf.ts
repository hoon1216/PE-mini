import PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;
import { formatAnswerValue, questionDisplayLabel } from "./format-answer";
import type { Answer, Response, SurveyDetail } from "./types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "./types";

const KOREAN_FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Korean/NotoSansKR-Regular.otf";

let cachedFont: Buffer | null = null;

async function loadKoreanFont(): Promise<Buffer> {
  if (cachedFont) return cachedFont;
  const response = await fetch(KOREAN_FONT_URL);
  if (!response.ok) {
    throw new Error("한글 PDF 폰트를 불러오지 못했습니다.");
  }
  cachedFont = Buffer.from(await response.arrayBuffer());
  return cachedFont;
}

export interface ResponseWithAnswers extends Response {
  answers: Answer[];
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

function renderResponsePage(
  doc: PdfDoc,
  survey: SurveyDetail,
  response: ResponseWithAnswers,
  answerByQuestionId: Map<string, string>
) {
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - left - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  let y = doc.page.margins.top;

  doc.fontSize(14).text(survey.title, left, y, {
    width: pageWidth,
    align: "center",
  });
  y += 24;

  doc.fontSize(10);
  doc.text(`참가자: ${response.participantName ?? "이름 없음"}`, left, y);
  y += 14;
  doc.text(
    `성별: ${response.gender ? GENDER_LABELS[response.gender] : "-"} · 연령대: ${
      response.ageGroup ? AGE_GROUP_LABELS[response.ageGroup] : "-"
    }`,
    left,
    y
  );
  y += 14;
  doc.text(`제출일: ${formatSubmittedAt(response.submittedAt)}`, left, y);
  y += 18;

  for (const section of survey.sections) {
    if (section.questions.length === 0) continue;
    if (y > bottom - 24) break;

    doc.fontSize(11).text(section.title, left, y, {
      width: pageWidth,
      underline: true,
    });
    y += 16;
    doc.fontSize(8);

    for (const question of section.questions) {
      const label = questionDisplayLabel(question);
      const value = answerByQuestionId.get(question.id);
      const formatted = value ? formatAnswerValue(question, value) : "-";
      const text = `${label}: ${formatted}`;
      const blockHeight = doc.heightOfString(text, { width: pageWidth });

      if (y + blockHeight > bottom) break;

      doc.text(text, left, y, { width: pageWidth, lineBreak: false });
      y += blockHeight + 4;
    }

    y += 6;
  }
}

export async function buildIndividualEvaluationsPdfBuffer(
  survey: SurveyDetail,
  responses: ResponseWithAnswers[]
): Promise<Buffer> {
  const fontBuffer = await loadKoreanFont();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Korean", fontBuffer);
    doc.font("Korean");

    if (responses.length === 0) {
      doc.addPage();
      doc.fontSize(14).text("제출된 평가가 없습니다.", { align: "center" });
      doc.end();
      return;
    }

    responses.forEach((response, index) => {
      doc.addPage();
      const answerByQuestionId = new Map(
        response.answers.map((answer) => [answer.questionId, answer.value])
      );
      renderResponsePage(doc, survey, response, answerByQuestionId);

      if (index < responses.length - 1) {
        // Each response already has its own page via addPage above.
      }
    });

    doc.end();
  });
}
