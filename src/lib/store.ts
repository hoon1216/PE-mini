import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
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

type PrimaryBackend = "kv" | "blob" | "file";

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    return redisClient;
  }

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redisClient = Redis.fromEnv();
    return redisClient;
  }

  return null;
}

function isKvStorageEnabled(): boolean {
  return getRedis() !== null;
}

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function getPrimaryBackend(): PrimaryBackend {
  if (isKvStorageEnabled()) return "kv";
  if (isBlobStorageEnabled()) return "blob";
  return "file";
}

export type StorageStatus = "kv" | "blob" | "file" | "vercel-missing-blob";

export function getStorageStatus(): StorageStatus {
  const primary = getPrimaryBackend();
  if (primary === "file" && process.env.VERCEL === "1") {
    return "vercel-missing-blob";
  }
  return primary;
}

function assertWritableStorage(): void {
  if (getStorageStatus() === "vercel-missing-blob") {
    throw new Error(
      "Vercel에 영구 저장소(KV 또는 Blob)가 연결되지 않았습니다. Vercel 대시보드 → Storage에서 Redis 또는 Blob을 연결해 주세요."
    );
  }
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
  const redis = getRedis();
  if (!redis) return null;

  const data = await redis.get<Store>(KV_STORE_KEY);
  if (data === null || data === undefined) {
    return null;
  }

  return parseStoreJson(JSON.stringify(data));
}

async function writeKvStore(store: Store): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("KV 저장소가 연결되지 않았습니다.");
  }
  await redis.set(KV_STORE_KEY, store);
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

      return parseStoreJson(raw);
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

async function migrateKvFromLegacySources(): Promise<Store> {
  const blobStore = await readBlobStoreOnce();
  if (blobStore) {
    await writeKvStore(blobStore);
    return blobStore;
  }

  const seed = readSeedStore();
  if (seed.surveys.length > 0) {
    await writeKvStore(seed);
    return seed;
  }

  const empty = emptyStore();
  await writeKvStore(empty);
  return empty;
}

async function migrateBlobFromLegacySources(): Promise<Store> {
  const seed = readSeedStore();
  if (seed.surveys.length > 0) {
    await writeBlobStoreOnce(seed);
    return seed;
  }

  const empty = emptyStore();
  await writeBlobStoreOnce(empty);
  return empty;
}

async function readPrimaryStore(): Promise<Store> {
  const primary = getPrimaryBackend();

  if (primary === "file") {
    return readFileStore();
  }

  if (primary === "kv") {
    const kvStore = await readKvStore();
    if (kvStore) return kvStore;
    return migrateKvFromLegacySources();
  }

  const blobStore = await readBlobStoreOnce();
  if (blobStore) return blobStore;
  return migrateBlobFromLegacySources();
}

export async function readStore(): Promise<Store> {
  return readPrimaryStore();
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
  assertWritableStorage();
  const primary = getPrimaryBackend();

  if (primary === "file") {
    writeFileStore(store);
    return;
  }

  if (primary === "kv") {
    await writeKvStore(store);
    return;
  }

  await writeBlobStoreOnce(store);
}

export async function mutateStore<T>(fn: (store: Store) => T): Promise<T> {
  const primary = getPrimaryBackend();

  if (primary === "file") {
    const store = await readFileStore();
    const result = fn(store);
    writeFileStore(store);
    return result;
  }

  const store = cloneStore(await readPrimaryStore());
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
