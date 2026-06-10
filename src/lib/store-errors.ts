import { BlobServiceRateLimited } from "@vercel/blob";

export function formatStoreError(error: unknown): string {
  if (error instanceof BlobServiceRateLimited) {
    return `Vercel Blob 사용 한도에 도달했습니다. ${error.retryAfter}초 후 다시 시도하거나, Vercel 대시보드 Storage에서 사용량을 확인해 주세요. (Hobby: Advanced Operations 월 2,000회)`;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("rate") || message.includes("limit")) {
      return "저장소 요청 한도에 도달했습니다. 잠시 후 다시 시도하거나 Vercel Storage 사용량을 확인해 주세요.";
    }

    if (message.includes("blob")) {
      return `저장소 오류: ${error.message}`;
    }

    return error.message;
  }

  return "데이터 저장에 실패했습니다.";
}
