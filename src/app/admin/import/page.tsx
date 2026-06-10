"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ImportDataPage() {
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [blobReady, setBlobReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/import-store")
      .then((res) => res.json())
      .then((data: { blobReady?: boolean }) => setBlobReady(Boolean(data.blobReady)))
      .catch(() => setBlobReady(null));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("store.json 파일을 선택해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const form = new FormData();
      form.append("key", key);
      form.append("file", file);

      const response = await fetch("/api/admin/import-store", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        error?: string;
        surveyCount?: number;
        responseCount?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "가져오기에 실패했습니다.");
      }

      setMessage(
        `가져오기 완료: 조사 ${data.surveyCount ?? 0}개, 응답 ${data.responseCount ?? 0}개`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "가져오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-xl px-6 py-10">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← 조사 목록
        </Link>

        <h1 className="mt-4 text-2xl font-bold">로컬 데이터 가져오기</h1>
        <p className="mt-3 text-sm text-muted">
          배포 환경에 로컬 PC의 <code>data/store.json</code> 파일을 업로드합니다.
        </p>

        {blobReady === false && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">1단계: Vercel Blob 연결 필요</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Vercel 대시보드 → <strong>Storage</strong> → <strong>Blob</strong> → Create</li>
              <li>생성한 Blob을 <strong>PE-mini</strong> 프로젝트에 Connect</li>
              <li><strong>Redeploy</strong> 후 이 페이지를 새로고침</li>
            </ol>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4 text-sm text-muted">
          <p className="font-medium text-foreground">2단계: 환경 변수</p>
          <p className="mt-1">
            Vercel → Settings → Environment Variables →{" "}
            <code>DATA_IMPORT_KEY</code> 추가 후 Redeploy
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium">가져오기 키</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              placeholder="Vercel DATA_IMPORT_KEY 값"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">store.json 파일</label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
            <p className="mt-1 text-xs text-muted">
              경로 예시: C:\Users\user\Projects\PE-mini\data\store.json
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          <Button type="submit" className="w-full py-3" disabled={loading || blobReady === false}>
            {loading ? "업로드 중..." : "데이터 가져오기"}
          </Button>
        </form>
      </main>
    </div>
  );
}
