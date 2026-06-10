import { Prisma, PrismaClient } from "@prisma/client";

type PrismaLogLevel = "error" | "warn";

const NEON_WAKE_RETRIES = 3;
const NEON_WAKE_DELAY_MS = 1500;

function isUnreachableDatabaseError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P1001"
  );
}

async function runWithNeonWakeRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < NEON_WAKE_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isUnreachableDatabaseError(error) || attempt === NEON_WAKE_RETRIES - 1) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, NEON_WAKE_DELAY_MS * (attempt + 1))
      );
    }
  }

  throw lastError;
}

function withNeonWakeRetry(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return runWithNeonWakeRetry(() => query(args));
        },
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaTransaction: PrismaClient;
};

function prismaLogLevels(): PrismaLogLevel[] {
  return process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
}

export function resolveDirectDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;

  const database = process.env.DATABASE_URL?.trim();
  if (!database) return "";

  // Neon pooler breaks interactive transactions; use direct host instead.
  if (database.includes("-pooler")) {
    return database.replace("-pooler", "");
  }

  return database;
}

function createPrismaClient(databaseUrl?: string): PrismaClient {
  const base = databaseUrl
    ? new PrismaClient({
        log: prismaLogLevels(),
        datasources: { db: { url: databaseUrl } },
      })
    : new PrismaClient({
        log: prismaLogLevels(),
      });

  return withNeonWakeRetry(base);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

const directDatabaseUrl = resolveDirectDatabaseUrl();
const usesSeparateTransactionClient =
  Boolean(directDatabaseUrl) &&
  directDatabaseUrl !== process.env.DATABASE_URL?.trim();

export const prismaTransaction = usesSeparateTransactionClient
  ? (globalForPrisma.prismaTransaction ??
    createPrismaClient(directDatabaseUrl))
  : prisma;

export const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  if (usesSeparateTransactionClient) {
    globalForPrisma.prismaTransaction = prismaTransaction;
  }
}

export function assertDatabaseConfigured(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL이 설정되지 않았습니다. Vercel Storage에서 Neon(Postgres)을 연결한 뒤 Redeploy 해주세요."
    );
  }
}
