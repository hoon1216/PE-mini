import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");
const BLOB_PATH = "pe-mini/store.json";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN 환경 변수가 필요합니다.");
    process.exit(1);
  }

  if (!fs.existsSync(STORE_PATH)) {
    console.error(`로컬 데이터 파일이 없습니다: ${STORE_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(STORE_PATH, "utf8");
  const store = JSON.parse(raw) as {
    surveys?: { title: string; slug: string }[];
    sections?: unknown[];
    questions?: unknown[];
    responses?: unknown[];
    answers?: unknown[];
  };

  const surveyCount = store.surveys?.length ?? 0;
  const responseCount = store.responses?.length ?? 0;

  console.log("업로드할 데이터:");
  console.log(`  - 조사: ${surveyCount}개`);
  console.log(`  - 섹션: ${store.sections?.length ?? 0}개`);
  console.log(`  - 문항: ${store.questions?.length ?? 0}개`);
  console.log(`  - 제출 응답: ${responseCount}개`);

  if (surveyCount > 0) {
    for (const survey of store.surveys ?? []) {
      console.log(`  · ${survey.title} → /s/${survey.slug}`);
    }
  }

  await put(BLOB_PATH, raw, {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
    token,
  });

  console.log("\n완료: 로컬 store.json을 Vercel Blob에 업로드했습니다.");
  console.log("Vercel 사이트를 새로고침하면 동일한 조사·응답이 표시됩니다.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
