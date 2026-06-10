# PE-mini 로컬 개발 환경 설정
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Test-Path ".env")) {
  Write-Step ".env 생성"
  Copy-Item ".env.example" ".env"
  Write-Host "  .env 파일을 생성했습니다."
}

$databaseUrl = (Get-Content ".env" -Raw) -match 'DATABASE_URL="([^"]+)"'
if (-not $matches) {
  throw ".env에 DATABASE_URL이 없습니다."
}
$url = $matches[1]

Write-Step "Docker 확인"
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host @"

  Docker가 설치되어 있지 않습니다. 아래 중 하나를 선택하세요.

  [A] Docker Desktop 설치 (권장)
      https://www.docker.com/products/docker-desktop/
      설치 후 터미널을 다시 열고: npm run db:up

  [B] Neon 개발 DB 사용 (Docker 없이)
      1. https://neon.tech 에서 무료 프로젝트 생성
      2. Connection string 복사
      3. .env 의 DATABASE_URL 을 Neon URL로 교체
      4. npm run db:push && npm run db:seed

"@ -ForegroundColor Yellow
  exit 1
}

Write-Step "PostgreSQL 컨테이너 시작"
docker compose up -d
Start-Sleep -Seconds 3

Write-Step "스키마 적용 (db push)"
npm run db:push

Write-Step "시드 데이터 삽입 (db:seed)"
npm run db:seed

Write-Step "완료"
Write-Host "  npm run dev  →  http://localhost:3001" -ForegroundColor Green
