"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DashboardExportButtonsProps {
  surveyId: string;
  surveyTitle: string;
}

async function downloadFile(url: string, fallbackName: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    let message = "다운로드에 실패했습니다.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function DashboardExportButtons({
  surveyId,
  surveyTitle,
}: DashboardExportButtonsProps) {
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState("");

  async function handleExcelDownload() {
    setLoadingExcel(true);
    setError("");
    try {
      await downloadFile(
        `/api/surveys/${surveyId}/export/excel`,
        `${surveyTitle}-dashboard.xlsx`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 다운로드 실패");
    } finally {
      setLoadingExcel(false);
    }
  }

  async function handlePdfDownload() {
    setLoadingPdf(true);
    setError("");
    try {
      await downloadFile(
        `/api/surveys/${surveyId}/export/pdf`,
        `${surveyTitle}-개별평가지.pdf`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 다운로드 실패");
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={loadingExcel || loadingPdf}
          onClick={handleExcelDownload}
        >
          {loadingExcel ? "생성 중..." : "엑셀다운"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loadingExcel || loadingPdf}
          onClick={handlePdfDownload}
        >
          {loadingPdf ? "생성 중..." : "개별 평가지 PDF"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
