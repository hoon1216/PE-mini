import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";
import {
  BlobNotFoundError,
  BlobServiceRateLimited,
  get,
  head,
  put,
  type BlobAccessType,
} from "@vercel/blob";
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
const NEON_STORE_ID = "main";
const MEMORY_STORE_TTL_MS = 10 * 60 * 1000;

type SqlClient = ReturnType<typeof neon>;

let memoryStore: { data: Store; at: number } | null = null;

function rememberStore(store: Store): void {
  memoryStore = { data: cloneStore(store), at: Date.now() };
}

function recallStore(): Store | null {
  if (!memoryStore) return null;
  if (Date.now() - memoryStore.at > MEMORY_STORE_TTL_MS) {
    memoryStore = null;
    return null;
  }
  return cloneStore(memoryStore.data);
}

export const emptyStore = (): Store => ({
  surveys: [],
  sections: [],
  questions: [],
  responses: [],
  answers: [],
});

type PrimaryBackend = "neon" | "kv" | "blob" | "file";

let sqlClient: SqlClient | null = null;
let neonSchemaReady = false;
let redisClient: Redis | null = null;

function isNeonStorageEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getSql(): SqlClient | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}

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
  if (isNeonStorageEnabled()) return "neon";
  if (isKvStorageEnabled()) return "kv";
  if (isBlobStorageEnabled()) return "blob";
  return "file";
}

export type StorageStatus =
  | "neon"
  | "kv"
  | "blob"
  | "file"
  | "vercel-missing-blob";

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
      "Vercel에 영구 저장소가 연결되지 않았습니다. Vercel 대시보드 → Storage에서 Neon, Redis 또는 Blob을 연결해 주세요."
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

function blobCommandOptions(access: BlobAccessType) {
  return {
    access,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    storeId: process.env.BLOB_STORE_ID,
  };
}

function blobPutOptions(access: BlobAccessType) {
  return {
    ...blobCommandOptions(access),
    allowOverwrite: true as const,
    contentType: "application/json",
    addRandomSuffix: false as const,
    cacheControlMaxAge: 60,
  };
}

function blobGetOptions(access: BlobAccessType) {
  return {
    ...blobCommandOptions(access),
    useCache: false as const,
  };
}

async function fetchBlobJson(url: string): Promise<string | null> {
  const response = await fetch(`${url}?_=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) return null;

  const raw = await response.text();
  return raw.trim() ? raw : null;
}

async function fetchBlobJsonFromMetadata(metadata: {
  url: string;
  downloadUrl: string;
}): Promise<string | null> {
  for (const url of [metadata.downloadUrl, metadata.url]) {
    const raw = await fetchBlobJson(url);
    if (raw) return raw;
  }

  return null;
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

async function ensureNeonSchema(sql: SqlClient): Promise<void> {
  if (neonSchemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS pe_mini_store (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  neonSchemaReady = true;
}

async function readNeonStore(): Promise<Store | null> {
  const sql = getSql();
  if (!sql) return null;

  await ensureNeonSchema(sql);
  const rows = (await sql`
    SELECT data FROM pe_mini_store WHERE id = ${NEON_STORE_ID}
  `) as Array<{ data: unknown }>;

  if (rows.length === 0) return null;

  return parseStoreJson(JSON.stringify(rows[0].data));
}

async function writeNeonStore(store: Store): Promise<void> {
  const sql = getSql();
  if (!sql) {
    throw new Error("Neon DATABASE_URL이 설정되지 않았습니다.");
  }

  await ensureNeonSchema(sql);
  await sql`
    INSERT INTO pe_mini_store (id, data, updated_at)
    VALUES (${NEON_STORE_ID}, ${JSON.stringify(store)}, NOW())
    ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
  `;
  rememberStore(store);
}

async function migrateNeonFromLegacySources(): Promise<Store> {
  const kvStore = await readKvStore();
  if (kvStore) {
    await writeNeonStore(kvStore);
    return kvStore;
  }

  const blobStore = await readBlobStoreOnce();
  if (blobStore) {
    await writeNeonStore(blobStore);
    return blobStore;
  }

  const seed = readSeedStore();
  if (seed.surveys.length > 0) {
    await writeNeonStore(seed);
    return seed;
  }

  const empty = emptyStore();
  await writeNeonStore(empty);
  return empty;
}

async function writeKvStore(store: Store): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("KV 저장소가 연결되지 않았습니다.");
  }
  await redis.set(KV_STORE_KEY, store);
  rememberStore(store);
}

async function readBlobStoreOnce(): Promise<Store | null> {
  if (!isBlobStorageEnabled()) return null;

  for (const access of blobAccessModes()) {
    try {
      const metadata = await head(BLOB_PATH, blobCommandOptions(access));
      const raw = await fetchBlobJsonFromMetadata(metadata);
      if (raw) {
        return parseStoreJson(raw);
      }
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      if (!isBlobAccessMismatch(error)) {
        console.warn(`[store] Blob head/fetch read failed (${access}):`, error);
      }
    }

    try {
      const result = await get(BLOB_PATH, blobGetOptions(access));
      if (!result || result.statusCode !== 200 || !result.stream) {
        continue;
      }

      const raw = await new Response(result.stream).text();
      if (!raw.trim()) continue;

      return parseStoreJson(raw);
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      if (!isBlobAccessMismatch(error)) {
        console.warn(`[store] Blob get read failed (${access}):`, error);
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
      rememberStore(store);
      return;
    } catch (error) {
      lastError = error;

      if (error instanceof BlobServiceRateLimited) {
        await sleep(error.retryAfter * 1000);
        await put(BLOB_PATH, payload, blobPutOptions(access));
        rememberStore(store);
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
  const remembered = recallStore();
  if (remembered && primary !== "file") {
    return remembered;
  }

  if (primary === "file") {
    return readFileStore();
  }

  if (primary === "neon") {
    const neonStore = await readNeonStore();
    if (neonStore) {
      rememberStore(neonStore);
      return neonStore;
    }
    return migrateNeonFromLegacySources();
  }

  if (primary === "kv") {
    const kvStore = await readKvStore();
    if (kvStore) {
      rememberStore(kvStore);
      return kvStore;
    }
    return migrateKvFromLegacySources();
  }

  const blobStore = await readBlobStoreOnce();
  if (blobStore) {
    rememberStore(blobStore);
    return blobStore;
  }
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
    rememberStore(store);
    return;
  }

  if (primary === "neon") {
    await writeNeonStore(store);
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
    assertWritableStorage();
    const store = await readFileStore();
    const result = fn(store);
    writeFileStore(store);
    rememberStore(store);
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
  return status === "neon" || status === "kv" || status === "blob";
}
