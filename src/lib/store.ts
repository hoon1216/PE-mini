import fs from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import { BlobServiceRateLimited, get, put, type BlobAccessType } from "@vercel/blob";
import seedData from "../../scripts/seed-store.json";
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
const KV_STORE_KEY = "pe-mini:store";

export const emptyStore = (): Store => ({
  surveys: [],
  sections: [],
  questions: [],
  responses: [],
  answers: [],
});

function isKvStorageEnabled(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL ||
      process.env.KV_URL ||
      process.env.UPSTASH_REDIS_REST_URL
  );
}

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export type StorageStatus = "kv" | "blob" | "file" | "vercel-missing-blob";

export function getStorageStatus(): StorageStatus {
  if (isKvStorageEnabled()) return "kv";
  if (isBlobStorageEnabled()) return "blob";
  if (process.env.VERCEL === "1") return "vercel-missing-blob";
  return "file";
}

function blobAccessModes(): BlobAccessType[] {
  const configured = process.env.BLOB_STORE_ACCESS;
  if (configured === "public") return ["public"];
  if (configured === "private") return ["private"];
  return ["public", "private"];
}

function isBlobAccessMismatch(error: unknown): boolean {
  return (
    error instanceof Error &&
    /private access on a public store|public access on a private store/i.test(
      error.message
    )
  );
}

function blobPutOptions(access: BlobAccessType) {
  return {
    access,
    allowOverwrite: true as const,
    contentType: "application/json",
    addRandomSuffix: false as const,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    storeId: process.env.BLOB_STORE_ID,
  };
}

function blobGetOptions(access: BlobAccessType) {
  return {
    access,
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
  const seed = parseStoreJson(JSON.stringify(seedData));
  return {
    ...seed,
    responses: [],
    answers: [],
  };
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

async function readKvStore(): Promise<Store | null> {
  if (!isKvStorageEnabled()) return null;

  try {
    const data = await kv.get<Store>(KV_STORE_KEY);
    if (!data || !Array.isArray(data.surveys) || data.surveys.length === 0) {
      return null;
    }
    return parseStoreJson(JSON.stringify(data));
  } catch (error) {
    console.warn("[store] KV read failed:", error);
    return null;
  }
}

async function writeKvStore(store: Store): Promise<void> {
  await kv.set(KV_STORE_KEY, store);
}

async function readBlobStoreOnce(): Promise<Store | null> {
  if (!isBlobStorageEnabled()) return null;

  for (const access of blobAccessModes()) {
    try {
      const result = await get(BLOB_PATH, blobGetOptions(access));
      if (!result || result.statusCode !== 200 || !result.stream) {
        continue;
      }

      const raw = await new Response(result.stream).text();
      if (!raw.trim()) continue;

      const parsed = parseStoreJson(raw);
      if (parsed.surveys.length > 0) {
        return parsed;
      }
    } catch (error) {
      if (!isBlobAccessMismatch(error)) {
        console.warn(`[store] Blob read failed (${access}):`, error);
      }
    }
  }

  return null;
}

async function writeBlobStoreOnce(store: Store): Promise<void> {
  const payload = JSON.stringify(store);
  let lastError: unknown;

  for (const access of blobAccessModes()) {
    try {
      await put(BLOB_PATH, payload, blobPutOptions(access));
      return;
    } catch (error) {
      lastError = error;

      if (error instanceof BlobServiceRateLimited) {
        await sleep(error.retryAfter * 1000);
        await put(BLOB_PATH, payload, blobPutOptions(access));
        return;
      }

      if (isBlobAccessMismatch(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("Blob write failed");
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

async function loadBestAvailableStore(): Promise<Store> {
  if (isKvStorageEnabled()) {
    const kvStore = await readKvStore();
    if (kvStore) return kvStore;
  }

  const blobStore = await readBlobStoreOnce();
  if (blobStore) return blobStore;

  const seed = readSeedStore();
  if (seed.surveys.length > 0) return seed;

  return emptyStore();
}

export async function readStore(): Promise<Store> {
  if (!isKvStorageEnabled() && !isBlobStorageEnabled()) {
    return readFileStore();
  }

  try {
    return await loadBestAvailableStore();
  } catch (error) {
    console.error("[store] readStore failed, using seed backup:", error);
    const seed = readSeedStore();
    return seed.surveys.length > 0 ? seed : emptyStore();
  }
}

export async function restoreStoreFromSeed(): Promise<Store> {
  const seed = readSeedStore();
  if (seed.surveys.length === 0) {
    throw new Error("복구할 시드 데이터가 없습니다.");
  }

  await writeStore(seed);
  return seed;
}

export async function writeStore(store: Store): Promise<void> {
  if (!isKvStorageEnabled() && !isBlobStorageEnabled()) {
    writeFileStore(store);
    return;
  }

  if (isKvStorageEnabled()) {
    await writeKvStore(store);
  } else if (isBlobStorageEnabled()) {
    await writeBlobStoreOnce(store);
    return;
  }

  if (isBlobStorageEnabled()) {
    try {
      await writeBlobStoreOnce(store);
    } catch (error) {
      console.warn("[store] Blob mirror write failed:", error);
    }
  }
}

export async function mutateStore<T>(fn: (store: Store) => T): Promise<T> {
  if (!isKvStorageEnabled() && !isBlobStorageEnabled()) {
    const store = await readFileStore();
    const result = fn(store);
    writeFileStore(store);
    return result;
  }

  const store = cloneStore(await readStore());
  const result = fn(store);
  await writeStore(store);
  return result;
}

export async function replaceStore(store: Store): Promise<Store> {
  await writeStore(store);
  return store;
}

export function isCloudStorage(): boolean {
  const status = getStorageStatus();
  return status === "kv" || status === "blob";
}
