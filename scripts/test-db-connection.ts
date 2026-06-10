import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
  console.log("CONNECTION_OK", result[0]?.ok);

  const count = await prisma.survey.count();
  console.log("SURVEY_COUNT", count);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("CONNECTION_FAIL", message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
