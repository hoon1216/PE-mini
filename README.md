# PE-mini

Preference Evaluation mini — 웹 기반 선호도 조사 도구

## 구성

- **관리자 (PC)**: `/admin` — 조사 생성, 대시보드, 평가 내용 편집
- **참가자 (모바일)**: `/s/{slug}` — 링크 접속 후 평가 제출

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3001](http://localhost:3001) 접속

로컬 개발 시 데이터는 `data/store.json`에 저장됩니다.

## 주요 화면

| 경로 | 설명 |
|------|------|
| `/admin` | 조사 생성 및 목록 |
| `/admin/surveys/{id}` | 대시보드 (제출 현황) |
| `/admin/surveys/{id}/edit` | 섹션·문항 편집 |
| `/s/{slug}` | 참가자 평가 페이지 |

## 기술 스택

- Next.js 15 (App Router)
- 로컬: `data/store.json` / Vercel: Blob Storage
- Tailwind CSS

## Vercel 배포

1. GitHub에 저장소를 푸시합니다.
2. [Vercel](https://vercel.com)에서 **Import Project**로 연결합니다.
3. Vercel 대시보드 → **Storage** → **Blob** 스토어를 생성하고 프로젝트에 연결합니다.  
   (`BLOB_READ_WRITE_TOKEN`이 자동 설정됩니다.)
4. Deploy 후 배포 URL에서 관리자·참가자 페이지를 사용합니다.

### 로컬 데이터 이전 (선택)

기존 `data/store.json`을 Vercel Blob으로 옮기려면:

```bash
# Vercel Blob 토큰 설정 후
set BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
npm run db:migrate-blob
```

## 다음 단계

상세 평가 방식(문항 유형, 선택지, 점수 체계 등)은 추후 확장 예정입니다.
