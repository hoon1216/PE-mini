# PE-mini

Preference Evaluation mini — 웹 기반 선호도 조사 도구

## 구성

- **관리자 (PC)**: `/` — 조사 생성, 대시보드, 평가 내용 편집
- **참가자 (모바일)**: `/s/{slug}` — 링크 접속 후 평가 제출

## 시작하기 (로컬)

### 방법 A — Docker (권장)

[Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 후:

```bash
npm install
npm run db:setup    # .env 생성 + DB 시작 + push + seed
npm run dev
```

또는 단계별:

```bash
copy .env.example .env
npm run db:up
npm run db:push
npm run db:seed
npm run dev
```

- 로컬 DB: `postgresql://pepmini:pepmini@localhost:5433/pepmini` (포트 5433)
- DB 중지: `npm run db:down`

### 방법 B — Docker 없이 (Neon 무료 DB)

1. [neon.tech](https://neon.tech)에서 프로젝트 생성
2. Connection string을 `.env`의 `DATABASE_URL`에 붙여넣기
3. `npm run db:push && npm run db:seed && npm run dev`

브라우저에서 [http://localhost:3001](http://localhost:3001) 접속

## 주요 화면

| 경로 | 설명 |
|------|------|
| `/` | 조사 생성 및 목록 |
| `/admin/surveys/{id}` | 대시보드 (제출 현황) |
| `/admin/surveys/{id}/edit` | 섹션·문항 편집 |
| `/s/{slug}` | 참가자 평가 페이지 |

## 기술 스택

- Next.js 15 (App Router)
- Prisma + PostgreSQL (Neon)
- Tailwind CSS

## Vercel 배포

1. GitHub에 저장소를 푸시합니다.
2. [Vercel](https://vercel.com)에서 **Import Project**로 연결합니다.
3. Vercel 대시보드 → **Storage** → **Neon (Postgres)** 생성 후 프로젝트에 연결합니다.  
   (`DATABASE_URL`이 자동 설정됩니다.)
4. Redeploy 후 터미널에서 스키마 적용:

```bash
npx prisma db push
npm run db:seed
```

5. 배포 URL에서 관리자·참가자 페이지를 사용합니다.

### 평가자 공개 접속

모바일에서 평가 링크(`/s/{slug}`) 접속 시 Vercel 로그인이 뜨면 **Settings → Deployment Protection**에서 Production을 공개로 설정하세요.

## DB 명령어

| 명령 | 설명 |
|------|------|
| `npm run db:push` | 스키마를 DB에 반영 |
| `npm run db:seed` | 시드 조사 데이터 삽입 |
| `npm run db:reset:seed` | 전체 삭제 후 시드 재삽입 |
