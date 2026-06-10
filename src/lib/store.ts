import fs from "fs";
import path from "path";
import {
  BlobPreconditionFailedError,
  get,
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
const MUTATE_MAX_RETRIES = 10;
const READ_RETRY_ATTEMPTS = 5;
const VERIFY_RETRY_ATTEMPTS = 8;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPreconditionFailed(error: unknown): boolean {
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error && error.name === "BlobPreconditionFailedError")
  );
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
  const access = blobAccessMode();
  let lastError: unknown;

  for (let attempt = 0; attempt < READ_RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await get(BLOB_PATH, { access, useCache: false });

      if (!result) {
        return { store: emptyStore(), etag: null };
      }

      if (result.statusCode !== 200 || !result.stream) {
        await sleep(40 * (attempt + 1));
        continue;
      }

      const raw = await new Response(result.stream).text();
      const store = raw.trim() ? parseStoreJson(raw) : emptyStore();
      return { store, etag: result.blob.etag };
    } catch (error) {
      lastError = error;
      console.warn(`[store] Blob read attempt ${attempt + 1} failed:`, error);
      await sleep(40 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Blob read failed after retries");
}

async function readBlobStore(): Promise<Store> {
  const { store } = await readBlobStoreWithEtag();
  return store;
}

async function writeBlobStore(store: Store, etag: string | null): Promise<void> {
  const payload = JSON.stringify(store, null, 2);
  const access = blobAccessMode();

  await put(BLOB_PATH, payload, {
    access,
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

async function verifyBlobWrite(expected: Store): Promise<boolean> {
  const expectedJson = JSON.stringify(expected);

  for (let attempt = 0; attempt < VERIFY_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(60 * attempt);
    }

    const { store: current } = await readBlobStoreWithEtag();
    if (JSON.stringify(current) === expectedJson) {
      return true;
    }
  }

  return false;
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
    for (let attempt = 0; attempt < MUTATE_MAX_RETRIES; attempt++) {
      const { etag } = await readBlobStoreWithEtag();
      try {
        await writeBlobStore(store, etag);
        if (await verifyBlobWrite(store)) {
          return;
        }
      } catch (error) {
        if (isPreconditionFailed(error) && attempt < MUTATE_MAX_RETRIES - 1) {
          await sleep(40 * (attempt + 1));
          continue;
        }
        throw error;
      }

      console.warn(
        `[store] writeStore verification failed (attempt ${attempt + 1}), retrying...`
      );
    }

    throw new Error("Blob write failed verification after retries");
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
      if (await verifyBlobWrite(store)) {
        return result;
      }
    } catch (error) {
      if (isPreconditionFailed(error) && attempt < MUTATE_MAX_RETRIES - 1) {
        await sleep(40 * (attempt + 1));
        continue;
      }
      throw error;
    }

    console.warn(
      `[store] mutateStore verification failed (attempt ${attempt + 1}), retrying...`
    );
  }

  throw new Error("Store mutation failed verification after retries");
}

export async function replaceStore(store: Store): Promise<Store> {
  await writeStore(store);
  return store;
}

export function isCloudStorage(): boolean {
  return getStorageStatus() === "blob";
}
