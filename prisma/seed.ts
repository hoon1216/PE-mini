import { PrismaClient, type Prisma } from "@prisma/client";
import seedData from "./seed-data.json";

const prisma = new PrismaClient();

type SeedStore = {
  surveys: Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  sections: Array<{
    id: string;
    surveyId: string;
    title: string;
    description: string | null;
    sortOrder: number;
  }>;
  questions: Array<{
    id: string;
    sectionId: string;
    title: string;
    description: string | null;
    type: string;
    config: unknown;
    sortOrder: number;
  }>;
};

async function main() {
  const data = seedData as SeedStore;

  for (const survey of data.surveys) {
    await prisma.survey.upsert({
      where: { id: survey.id },
      create: {
        id: survey.id,
        title: survey.title,
        slug: survey.slug,
        description: survey.description,
        createdAt: new Date(survey.createdAt),
        updatedAt: new Date(survey.updatedAt),
      },
      update: {
        title: survey.title,
        slug: survey.slug,
        description: survey.description,
        updatedAt: new Date(survey.updatedAt),
      },
    });
  }

  for (const section of data.sections) {
    await prisma.section.upsert({
      where: { id: section.id },
      create: {
        id: section.id,
        surveyId: section.surveyId,
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
      },
      update: {
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
      },
    });
  }

  for (const question of data.questions) {
    await prisma.question.upsert({
      where: { id: question.id },
      create: {
        id: question.id,
        sectionId: question.sectionId,
        title: question.title,
        description: question.description,
        type: question.type,
        config: question.config as Prisma.InputJsonValue,
        sortOrder: question.sortOrder,
      },
      update: {
        title: question.title,
        description: question.description,
        type: question.type,
        config: question.config as Prisma.InputJsonValue,
        sortOrder: question.sortOrder,
      },
    });
  }

  console.log(
    `Seeded ${data.surveys.length} surveys, ${data.sections.length} sections, ${data.questions.length} questions`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
