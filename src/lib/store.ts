import fs from "fs";
import path from "path";
import { get, put, type BlobAccessType } from "@vercel/blob";
import seedData from "../../scripts/seed-store.json";
import type { Answer, Question, Response, Section, Survey } from "./types";

export interface Store {
  surveys: Survey[];
  sections: Section[];
  questions: Question[];
  responses: Response[];
  answers: Answer[];
}

type MetaStore = Pick<Store, "surveys" | "sections" | "questions">;
type ResponseStore = Pick<Store, "responses" | "answers">;

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const LEGACY_BLOB_PATH = "pe-mini/store.json";
const META_BLOB_PATH = "pe-mini/meta.json";
const RESPONSES_BLOB_PATH = "pe-mini/responses.json";
const MUTATE_MAX_RETRIES = 4;

export const emptyStore = (): Store => ({
  surveys: [],
  sections: [],
  questions: [],
  responses: [],
  answers: [],
});

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export type StorageStatus = "blob" | "file" | "vercel-missing-blob";

export function getStorageStatus(): StorageStatus {
  if (isBlobStorageEnabled()) return "blob";
  if (process.env.VERCEL === "1") return "vercel-missing-blob";
  return "file";
}

function blobAccessMode(): BlobAccessType {
  const configured = process.env.BLOB_STORE_ACCESS;
  if (configured === "public") return "public";
  return "private";
}

function blobPutOptions() {
  return {
    access: blobAccessMode(),
    allowOverwrite: true as const,
    contentType: "application/json",
    addRandomSuffix: false as const,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    storeId: process.env.BLOB_STORE_ID,
  };
}

function blobGetOptions() {
  return {
    access: blobAccessMode(),
    useCache: false as const,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    storeId: process.env.BLOB_STORE_ID,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneStore(store: Store): Store {
  return parseStoreJson(JSON.stringify(store));
}

function ensureFileStore(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(emptyStore(), null, 2), "utf8");
  }
}

function readSeedStore(): Store {
  return parseStoreJson(JSON.stringify(seedData));
}

async function readFileStore(): Promise<Store> {
  ensureFileStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  return parseStoreJson(raw);
}

function writeFileStore(store: Store): void {
  ensureFileStore();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tempPath, STORE_PATH);
}

async function readBlobJson<T>(blobPath: string): Promise<T | null> {
  try {
    const result = await get(blobPath, blobGetOptions());
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const raw = await new Response(result.stream).text();
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[store] Failed to read blob ${blobPath}:`, error);
    return null;
  }
}

async function writeBlobJson(blobPath: string, data: unknown): Promise<void> {
  const payload = JSON.stringify(data);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await put(blobPath, payload, blobPutOptions());
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `[store] Blob write failed (${blobPath}, attempt ${attempt + 1}):`,
        error
      );
      await sleep(60 * (attempt + 1));
    }
  }

  throw lastError ?? new Error(`Blob write failed: ${blobPath}`);
}

async function readBlobStore(): Promise<Store> {
  const meta = await readBlobJson<MetaStore>(META_BLOB_PATH);
  const responseData = await readBlobJson<ResponseStore>(RESPONSES_BLOB_PATH);

  if (meta?.surveys?.length) {
    return {
      surveys: meta.surveys,
      sections: meta.sections ?? [],
      questions: meta.questions ?? [],
      responses: responseData?.responses ?? [],
      answers: responseData?.answers ?? [],
    };
  }

  const legacy = await readBlobJson<Store>(LEGACY_BLOB_PATH);
  if (legacy?.surveys?.length) {
    return parseStoreJson(JSON.stringify(legacy));
  }

  return emptyStore();
}

async function writeBlobMeta(meta: MetaStore): Promise<void> {
  await writeBlobJson(META_BLOB_PATH, meta);
}

async function writeBlobResponses(responseData: ResponseStore): Promise<void> {
  await writeBlobJson(RESPONSES_BLOB_PATH, responseData);
}

async function writeFullBlobStore(store: Store): Promise<void> {
  const meta: MetaStore = {
    surveys: store.surveys,
    sections: store.sections,
    questions: store.questions,
  };
  const responseData: ResponseStore = {
    responses: store.responses,
    answers: store.answers,
  };

  await writeBlobResponses(responseData);
  await writeBlobMeta(meta);
  try {
    await writeBlobJson(LEGACY_BLOB_PATH, store);
  } catch (error) {
    console.warn("[store] Legacy blob sync skipped:", error);
  }
}

export function parseStoreJson(raw: string): Store {
  const parsed = JSON.parse(raw) as Partial<Store>;
  return {
    surveys: Array.isArray(parsed.surveys) ? parsed.surveys : [],
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    responses: Array.isArray(parsed.responses) ? parsed.responses : [],
    answers: Array.isArray(parsed.answers) ? parsed.answers : [],
  };
}

async function restoreFromSeedIfNeeded(current: Store): Promise<Store> {
  const seed = readSeedStore();
  if (seed.surveys.length === 0) {
    return current;
  }

  console.warn(
    `[store] Restoring ${seed.surveys.length} survey(s) from seed backup`
  );

  try {
    await writeFullBlobStore(seed);
  } catch (error) {
    console.error("[store] Seed restore write failed:", error);
  }

  return seed;
}

export async function readStore(): Promise<Store> {
  if (!isBlobStorageEnabled()) {
    return readFileStore();
  }

  try {
    const blobStore = await readBlobStore();
    if (blobStore.surveys.length > 0) {
      return blobStore;
    }

    return restoreFromSeedIfNeeded(blobStore);
  } catch (error) {
    console.error("[store] Blob read failed, attempting seed restore:", error);
    return restoreFromSeedIfNeeded(emptyStore());
  }
}

export async function restoreStoreFromSeed(): Promise<Store> {
  const seed = readSeedStore();
  if (seed.surveys.length === 0) {
    throw new Error("복구할 시드 데이터가 없습니다.");
  }

  if (isBlobStorageEnabled()) {
    await writeFullBlobStore(seed);
  } else {
    writeFileStore(seed);
  }

  return seed;
}

export async function writeStore(store: Store): Promise<void> {
  if (isBlobStorageEnabled()) {
    await writeFullBlobStore(store);
    return;
  }
  writeFileStore(store);
}

export async function mutateStore<T>(fn: (store: Store) => T): Promise<T> {
  if (!isBlobStorageEnabled()) {
    const store = await readFileStore();
    const result = fn(store);
    writeFileStore(store);
    return result;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < MUTATE_MAX_RETRIES; attempt++) {
    const store = cloneStore(await readStore());
    const result = fn(store);

    try {
      await writeFullBlobStore(store);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`[store] mutateStore attempt ${attempt + 1} failed:`, error);
      await sleep(80 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Store mutation failed after retries");
}

export async function mutateResponseStore<T>(
  fn: (store: Store) => T
): Promise<T> {
  if (!isBlobStorageEnabled()) {
    const store = await readFileStore();
    const result = fn(store);
    writeFileStore(store);
    return result;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < MUTATE_MAX_RETRIES; attempt++) {
    const store = cloneStore(await readStore());
    const result = fn(store);

    try {
      await writeBlobResponses({
        responses: store.responses,
        answers: store.answers,
      });
      await writeBlobMeta({
        surveys: store.surveys,
        sections: store.sections,
        questions: store.questions,
      });
      return result;
    } catch (error) {
      lastError = error;
      console.warn(
        `[store] mutateResponseStore attempt ${attempt + 1} failed:`,
        error
      );
      await sleep(80 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Response store mutation failed after retries");
}

export async function replaceStore(store: Store): Promise<Store> {
  await writeStore(store);
  return store;
}

export function isCloudStorage(): boolean {
  return getStorageStatus() === "blob";
}
