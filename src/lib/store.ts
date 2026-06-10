import fs from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import type { Answer, Question, Response, Section, Survey } from "./types";

export interface Store {
  surveys: Survey[];
  sections: Section[];
  questions: Question[];
  responses: Response[];
  answers: Answer[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const BLOB_PATH = "pe-mini/store.json";

export const emptyStore = (): Store => ({
  surveys: [],
  sections: [],
  questions: [],
  responses: [],
  answers: [],
});

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function ensureFileStore(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(emptyStore(), null, 2), "utf8");
  }
}

async function readFileStore(): Promise<Store> {
  ensureFileStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  return JSON.parse(raw) as Store;
}

function writeFileStore(store: Store): void {
  ensureFileStore();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tempPath, STORE_PATH);
}

async function readBlobStore(): Promise<Store> {
  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result?.stream) return emptyStore();

    const raw = await new Response(result.stream).text();
    if (!raw.trim()) return emptyStore();
    return JSON.parse(raw) as Store;
  } catch {
    return emptyStore();
  }
}

async function writeBlobStore(store: Store): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(store, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function readStore(): Promise<Store> {
  if (isBlobStorageEnabled()) {
    return readBlobStore();
  }
  return readFileStore();
}

export async function writeStore(store: Store): Promise<void> {
  if (isBlobStorageEnabled()) {
    await writeBlobStore(store);
    return;
  }
  writeFileStore(store);
}

export async function mutateStore<T>(fn: (store: Store) => T): Promise<T> {
  const store = await readStore();
  const result = fn(store);
  await writeStore(store);
  return result;
}
