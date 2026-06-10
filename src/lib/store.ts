import fs from "fs";
import path from "path";
import {
  BlobPreconditionFailedError,
  get,
  list,
  put,
  type BlobAccessType,
} from "@vercel/blob";
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
const MUTATE_MAX_RETRIES = 8;

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

function blobAccessModes(): BlobAccessType[] {
  const configured = process.env.BLOB_STORE_ACCESS;
  if (configured === "public") return ["public"];
  if (configured === "private") return ["private"];
  return ["private", "public"];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

interface BlobStoreSnapshot {
  store: Store;
  etag: string | null;
}

async function readBlobStoreWithEtag(): Promise<BlobStoreSnapshot> {
  for (const access of blobAccessModes()) {
    try {
      const result = await get(BLOB_PATH, { access, useCache: false });
      if (!result) continue;

      if (result.statusCode === 304 || !result.stream) {
        return { store: emptyStore(), etag: result.blob.etag };
      }

      const raw = await new Response(result.stream).text();
      const store = raw.trim() ? parseStoreJson(raw) : emptyStore();
      return { store, etag: result.blob.etag };
    } catch (error) {
      console.warn(`[store] Blob read failed (${access}):`, error);
    }
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    const blob = blobs.find((item) => item.pathname === BLOB_PATH);
    if (!blob) return { store: emptyStore(), etag: null };

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const response = await fetch(blob.downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });

    if (!response.ok) return { store: emptyStore(), etag: blob.etag };
    const raw = await response.text();
    const store = raw.trim() ? parseStoreJson(raw) : emptyStore();
    return { store, etag: blob.etag };
  } catch (error) {
    console.warn("[store] Blob list/fetch fallback failed:", error);
    return { store: emptyStore(), etag: null };
  }
}

async function readBlobStore(): Promise<Store> {
  const { store } = await readBlobStoreWithEtag();
  return store;
}

async function writeBlobStore(store: Store, etag: string | null): Promise<void> {
  const payload = JSON.stringify(store, null, 2);
  let lastError: unknown;

  for (const access of blobAccessModes()) {
    try {
      await put(BLOB_PATH, payload, {
        access,
        allowOverwrite: true,
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof BlobPreconditionFailedError) {
        throw error;
      }
      console.warn(`[store] Blob write failed (${access}):`, error);
    }
  }

  throw lastError ?? new Error("Blob write failed");
}

async function writeBlobStoreWithRetry(store: Store): Promise<void> {
  for (let attempt = 0; attempt < MUTATE_MAX_RETRIES; attempt++) {
    const { etag } = await readBlobStoreWithEtag();
    try {
      await writeBlobStore(store, etag);
      return;
    } catch (error) {
      if (
        error instanceof BlobPreconditionFailedError &&
        attempt < MUTATE_MAX_RETRIES - 1
      ) {
        await sleep(25 * (attempt + 1) + Math.random() * 25);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Blob write failed after retries");
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

export async function readStore(): Promise<Store> {
  if (isBlobStorageEnabled()) {
    return readBlobStore();
  }
  return readFileStore();
}

export async function writeStore(store: Store): Promise<void> {
  if (isBlobStorageEnabled()) {
    await writeBlobStoreWithRetry(store);
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

  for (let attempt = 0; attempt < MUTATE_MAX_RETRIES; attempt++) {
    const { store, etag } = await readBlobStoreWithEtag();
    const result = fn(store);

    try {
      await writeBlobStore(store, etag);
      return result;
    } catch (error) {
      if (
        error instanceof BlobPreconditionFailedError &&
        attempt < MUTATE_MAX_RETRIES - 1
      ) {
        await sleep(25 * (attempt + 1) + Math.random() * 25);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Store mutation failed after retries");
}

export async function replaceStore(store: Store): Promise<Store> {
  await writeStore(store);
  return store;
}

export function isCloudStorage(): boolean {
  return getStorageStatus() === "blob";
}
