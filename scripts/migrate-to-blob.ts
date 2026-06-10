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
  JSON.parse(raw);

  await put(BLOB_PATH, raw, {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
    token,
  });

  console.log("로컬 store.json을 Vercel Blob에 업로드했습니다.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
