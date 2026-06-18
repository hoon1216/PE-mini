import { nanoid } from "nanoid";
import type { Prisma } from "@prisma/client";
import { computeDashboardStats } from "./dashboard-stats";
import { migrateLegacyQuestions, normalizeQuestion } from "./question-utils";
import {
  normalizeDemographicFields,
  normalizeDemographicValues,
} from "./demographic-field-utils";
import {
  assertDatabaseConfigured,
  prisma,
  prismaTransaction,
  TRANSACTION_OPTIONS,
} from "./prisma";
import type {
  Answer,
  CreateSurveyInput,
  DashboardStats,
  Question,
  QuestionConfig,
  Response,
  SubmitResponseInput,
  Survey,
  SurveyDetail,
  UpdateSurveyContentInput,
} from "./types";
import { validateSubmitResponse } from "./submit-validation";
import { createDefaultQuestion } from "./types";

export class SurveyContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurveyContentError";
  }
}

type SurveyWithRelations = Prisma.SurveyGetPayload<{
  include: {
    sections: {
      include: { questions: true };
      orderBy: { sortOrder: "asc" };
    };
  };
}>;

const surveyInclude = {
  sections: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
};

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

  return base || "survey";
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let counter = 1;

  while (await prisma.survey.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
  }

  return slug;
}

function toSurvey(row: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Survey {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toQuestion(row: {
  id: string;
  sectionId: string;
  title: string;
  description: string | null;
  type: string;
  config: unknown;
  sortOrder: number;
}): Question {
  return normalizeQuestion({
    id: row.id,
    sectionId: row.sectionId,
    title: row.title,
    description: row.description,
    type: row.type as Question["type"],
    config: row.config as QuestionConfig,
    sortOrder: row.sortOrder,
  });
}

function buildSurveyDetail(survey: SurveyWithRelations): SurveyDetail {
  return {
    ...toSurvey(survey),
    demographicFields: normalizeDemographicFields(survey.demographicFields),
    sections: survey.sections.map((section) => ({
      id: section.id,
      surveyId: section.surveyId,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
      questions: migrateLegacyQuestions(
        section,
        section.questions.map(toQuestion)
      ),
    })),
  };
}

function normalizeResponse(response: {
  id: string;
  surveyId: string;
  submittedAt: Date;
  participantName: string | null;
  gender: string | null;
  ageGroup: string | null;
  demographicValues?: unknown;
}): Response {
  return {
    id: response.id,
    surveyId: response.surveyId,
    submittedAt: response.submittedAt.toISOString(),
    participantName: response.participantName?.trim() || null,
    gender: (response.gender as Response["gender"]) ?? null,
    ageGroup: (response.ageGroup as Response["ageGroup"]) ?? null,
    demographicValues: normalizeDemographicValues(response.demographicValues),
  };
}

async function fetchSurveyDetail(id: string): Promise<SurveyDetail | null> {
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: surveyInclude,
  });
  if (!survey) return null;
  return buildSurveyDetail(survey);
}

export async function listSurveys(): Promise<Survey[]> {
  assertDatabaseConfigured();
  const rows = await prisma.survey.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toSurvey);
}

export async function getSurveyById(id: string): Promise<SurveyDetail | null> {
  assertDatabaseConfigured();
  return fetchSurveyDetail(id);
}

export async function getSurveyBySlug(slug: string): Promise<SurveyDetail | null> {
  assertDatabaseConfigured();
  const survey = await prisma.survey.findUnique({
    where: { slug },
    include: surveyInclude,
  });
  if (!survey) return null;
  return buildSurveyDetail(survey);
}

export async function deleteSurvey(surveyId: string): Promise<boolean> {
  assertDatabaseConfigured();
  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return false;
  await prisma.survey.delete({ where: { id: surveyId } });
  return true;
}

export async function createSurvey(input: CreateSurveyInput): Promise<SurveyDetail> {
  assertDatabaseConfigured();
  const id = nanoid(12);
  const slug = await uniqueSlug(input.title);
  const sectionId = nanoid(12);
  const questionId = nanoid(12);
  const defaultQuestion = createDefaultQuestion(0);

  await prisma.survey.create({
    data: {
      id,
      title: input.title,
      slug,
      description: input.description ?? null,
      sections: {
        create: [
          {
            id: sectionId,
            title: "선호도 섹션",
            description: null,
            sortOrder: 0,
            questions: {
              create: [
                {
                  id: questionId,
                  title: defaultQuestion.title,
                  description: defaultQuestion.description,
                  type: defaultQuestion.type,
                  config: defaultQuestion.config as unknown as Prisma.InputJsonValue,
                  sortOrder: defaultQuestion.sortOrder,
                },
              ],
            },
          },
        ],
      },
    },
  });

  const created = await fetchSurveyDetail(id);
  if (!created) {
    throw new Error("조사 생성 후 데이터를 불러오지 못했습니다.");
  }
  return created;
}

export async function updateSurveyContent(
  surveyId: string,
  input: UpdateSurveyContentInput
): Promise<SurveyDetail | null> {
  assertDatabaseConfigured();
  const existing = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!existing) return null;

  await prismaTransaction.$transaction(async (tx) => {
    await tx.survey.update({
      where: { id: surveyId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description ?? null }
          : {}),
        ...(input.demographicFields !== undefined
          ? {
              demographicFields: normalizeDemographicFields(
                input.demographicFields
              ) as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    const existingSections = await tx.section.findMany({
      where: { surveyId },
      select: { id: true },
    });
    const existingSectionIds = new Set(existingSections.map((s) => s.id));
    const incomingSectionIds = new Set<string>();

    for (const sectionInput of input.sections) {
      const sectionId = sectionInput.id ?? nanoid(12);
      incomingSectionIds.add(sectionId);

      const existingSection = await tx.section.findUnique({
        where: { id: sectionId },
        select: { surveyId: true },
      });

      if (existingSection) {
        if (existingSection.surveyId !== surveyId) {
          throw new SurveyContentError(
            "다른 조사의 섹션은 수정할 수 없습니다."
          );
        }
        await tx.section.update({
          where: { id: sectionId },
          data: {
            title: sectionInput.title,
            description: sectionInput.description ?? null,
            sortOrder: sectionInput.sortOrder,
          },
        });
      } else {
        await tx.section.create({
          data: {
            id: sectionId,
            surveyId,
            title: sectionInput.title,
            description: sectionInput.description ?? null,
            sortOrder: sectionInput.sortOrder,
          },
        });
      }

      const existingQuestions = await tx.question.findMany({
        where: { sectionId },
        select: { id: true },
      });
      const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));
      const incomingQuestionIds = new Set<string>();

      for (const questionInput of sectionInput.questions) {
        const questionId = questionInput.id ?? nanoid(12);
        incomingQuestionIds.add(questionId);
        const normalized = normalizeQuestion({
          id: questionId,
          sectionId,
          title: questionInput.title ?? "",
          description: questionInput.description ?? null,
          type: questionInput.type,
          config: questionInput.config as QuestionConfig,
          sortOrder: questionInput.sortOrder,
        });

        const existingQuestion = await tx.question.findUnique({
          where: { id: questionId },
          select: { sectionId: true },
        });

        if (existingQuestion) {
          if (existingQuestion.sectionId !== sectionId) {
            throw new SurveyContentError(
              "다른 섹션의 문항은 수정할 수 없습니다."
            );
          }
          await tx.question.update({
            where: { id: questionId },
            data: {
              title: normalized.title,
              description: normalized.description,
              type: normalized.type,
              config: normalized.config as unknown as Prisma.InputJsonValue,
              sortOrder: normalized.sortOrder,
            },
          });
        } else {
          await tx.question.create({
            data: {
              id: questionId,
              sectionId,
              title: normalized.title,
              description: normalized.description,
              type: normalized.type,
              config: normalized.config as unknown as Prisma.InputJsonValue,
              sortOrder: normalized.sortOrder,
            },
          });
        }
      }

      const removedQuestionIds = [...existingQuestionIds].filter(
        (id) => !incomingQuestionIds.has(id)
      );
      if (removedQuestionIds.length > 0) {
        await tx.answer.deleteMany({
          where: { questionId: { in: removedQuestionIds } },
        });
        await tx.question.deleteMany({
          where: { id: { in: removedQuestionIds } },
        });
      }
    }

    const removedSectionIds = [...existingSectionIds].filter(
      (id) => !incomingSectionIds.has(id)
    );
    if (removedSectionIds.length > 0) {
      const removedQuestions = await tx.question.findMany({
        where: { sectionId: { in: removedSectionIds } },
        select: { id: true },
      });
      const removedQuestionIds = removedQuestions.map((q) => q.id);
      if (removedQuestionIds.length > 0) {
        await tx.answer.deleteMany({
          where: { questionId: { in: removedQuestionIds } },
        });
        await tx.question.deleteMany({
          where: { id: { in: removedQuestionIds } },
        });
      }
      await tx.section.deleteMany({ where: { id: { in: removedSectionIds } } });
    }
  }, TRANSACTION_OPTIONS);

  return fetchSurveyDetail(surveyId);
}

export async function submitResponse(
  surveyId: string,
  input: SubmitResponseInput
): Promise<Response | null> {
  assertDatabaseConfigured();
  const survey = await fetchSurveyDetail(surveyId);
  if (!survey) return null;

  validateSubmitResponse(survey, input);

  const responseId = nanoid(12);

  const response = await prismaTransaction.$transaction(async (tx) => {
    const created = await tx.response.create({
      data: {
        id: responseId,
        surveyId,
        participantName: input.participantName.trim(),
        gender: input.gender,
        ageGroup: input.ageGroup,
        demographicValues: normalizeDemographicValues(
          input.demographicValues
        ) as unknown as Prisma.InputJsonValue,
        answers: {
          create: input.answers.map((answer) => ({
            id: nanoid(12),
            questionId: answer.questionId,
            value: answer.value,
          })),
        },
      },
    });

    await tx.survey.update({
      where: { id: surveyId },
      data: { updatedAt: new Date() },
    });

    return created;
  }, TRANSACTION_OPTIONS);

  return normalizeResponse(response);
}

export async function getDashboardStats(
  surveyId: string
): Promise<DashboardStats | null> {
  assertDatabaseConfigured();
  const survey = await getSurveyById(surveyId);
  if (!survey) return null;

  const rows = await prisma.response.findMany({
    where: { surveyId },
    include: { answers: true },
    orderBy: { submittedAt: "desc" },
  });

  const responses = rows.map(normalizeResponse);
  const answerList: Answer[] = rows.flatMap((row) =>
    row.answers.map((answer) => ({
      id: answer.id,
      responseId: answer.responseId,
      questionId: answer.questionId,
      value: answer.value,
    }))
  );

  return computeDashboardStats(survey, responses, answerList);
}

export async function listResponses(surveyId: string): Promise<Response[]> {
  assertDatabaseConfigured();
  const rows = await prisma.response.findMany({
    where: { surveyId },
    orderBy: { submittedAt: "desc" },
  });
  return rows.map(normalizeResponse);
}

export async function listResponsesWithAnswers(surveyId: string): Promise<
  (Response & { answers: Answer[] })[]
> {
  assertDatabaseConfigured();
  const rows = await prisma.response.findMany({
    where: { surveyId },
    include: { answers: true },
    orderBy: { submittedAt: "asc" },
  });

  return rows.map((row) => ({
    ...normalizeResponse(row),
    answers: row.answers.map((answer) => ({
      id: answer.id,
      responseId: answer.responseId,
      questionId: answer.questionId,
      value: answer.value,
    })),
  }));
}

export async function deleteResponse(
  surveyId: string,
  responseId: string
): Promise<boolean> {
  assertDatabaseConfigured();
  const response = await prisma.response.findFirst({
    where: { id: responseId, surveyId },
  });
  if (!response) return false;

  await prismaTransaction.$transaction([
    prismaTransaction.response.delete({ where: { id: responseId } }),
    prismaTransaction.survey.update({
      where: { id: surveyId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return true;
}

export async function deleteAllResponses(surveyId: string): Promise<number> {
  assertDatabaseConfigured();
  const count = await prisma.response.count({ where: { surveyId } });
  if (count === 0) return 0;

  await prismaTransaction.$transaction([
    prismaTransaction.response.deleteMany({ where: { surveyId } }),
    prismaTransaction.survey.update({
      where: { id: surveyId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return count;
}

export async function getAnswersForResponse(responseId: string): Promise<Answer[]> {
  assertDatabaseConfigured();
  const rows = await prisma.answer.findMany({ where: { responseId } });
  return rows.map((answer) => ({
    id: answer.id,
    responseId: answer.responseId,
    questionId: answer.questionId,
    value: answer.value,
  }));
}
