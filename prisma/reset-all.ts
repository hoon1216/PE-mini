import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shouldSeed = process.argv.includes("--seed");

async function main() {
  await prisma.answer.deleteMany();
  await prisma.response.deleteMany();
  await prisma.question.deleteMany();
  await prisma.section.deleteMany();
  await prisma.survey.deleteMany();
  console.log("All survey data deleted.");

  if (shouldSeed) {
    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
