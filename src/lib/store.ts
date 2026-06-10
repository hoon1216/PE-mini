import fs from "fs";
import path from "path";
import { get, list, put, type BlobAccessType } from "@vercel/blob";
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
  for (const access of blobAccessModes()) {
    try {
      const result = await get(BLOB_PATH, { access, useCache: false });
      if (!result?.stream) continue;

      const raw = await new Response(result.stream).text();
      if (!raw.trim()) continue;
      return JSON.parse(raw) as Store;
    } catch (error) {
      console.warn(`[store] Blob read failed (${access}):`, error);
    }
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    const blob = blobs.find((item) => item.pathname === BLOB_PATH);
    if (!blob) return emptyStore();

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const response = await fetch(blob.downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });

    if (!response.ok) return emptyStore();
    const raw = await response.text();
    if (!raw.trim()) return emptyStore();
    return JSON.parse(raw) as Store;
  } catch (error) {
    console.warn("[store] Blob list/fetch fallback failed:", error);
    return emptyStore();
  }
}

async function writeBlobStore(store: Store): Promise<void> {
  const payload = JSON.stringify(store, null, 2);
  let lastError: unknown;

  for (const access of blobAccessModes()) {
    try {
      await put(BLOB_PATH, payload, {
        access,
        allowOverwrite: true,
        contentType: "application/json",
        addRandomSuffix: false,
      });
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[store] Blob write failed (${access}):`, error);
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

export async function replaceStore(store: Store): Promise<Store> {
  await writeStore(store);
  return store;
}

export function isCloudStorage(): boolean {
  return getStorageStatus() === "blob";
}
