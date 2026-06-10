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

### 로컬 평가 내용 그대로 배포하기

로컬 `data/store.json`에 있는 조사·문항·제출 응답을 Vercel에 그대로 옮기는 방법입니다.

**순서:** GitHub 푸시 → Vercel 배포 → Blob 연결 → 데이터 업로드

1. Vercel에서 프로젝트를 배포하고 **Blob 스토어를 연결**합니다.
2. Vercel 프로젝트 → **Storage** → 연결된 Blob → **`.env.local` 탭** 또는 **Settings → Environment Variables**에서 `BLOB_READ_WRITE_TOKEN` 값을 복사합니다.
3. 로컬 PC에서 한 번만 실행합니다 (PowerShell):

```powershell
cd C:\Users\user\Projects\PE-mini
$env:BLOB_READ_WRITE_TOKEN="vercel_blob_rw_여기에_토큰_붙여넣기"
npm run db:migrate-blob
```

4. 배포 URL을 새로고침하면 로컬과 동일한 조사 목록·대시보드가 보입니다.
5. 참가자 링크도 slug가 같으므로 `/s/{slug}` 경로가 그대로 유지됩니다.

> 주의: `data/` 폴더는 Git에 올라가지 않으므로, **반드시 위 migrate 명령으로 별도 업로드**해야 합니다.

## 다음 단계

상세 평가 방식(문항 유형, 선택지, 점수 체계 등)은 추후 확장 예정입니다.
