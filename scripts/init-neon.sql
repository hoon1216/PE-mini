-- Neon / PostgreSQL 초기 스키마 (Vercel Storage → Neon 연결 시 자동 생성도 됩니다)
CREATE TABLE IF NOT EXISTS pe_mini_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
