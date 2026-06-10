import { nanoid } from "nanoid";
import { computeDashboardStats } from "./dashboard-stats";
import { migrateLegacyQuestions, normalizeQuestion } from "./question-utils";
import { mutateStore, readStore, type Store } from "./store";
import type {
  Answer,
  CreateSurveyInput,
  DashboardStats,
  Question,
  QuestionConfig,
  Response,
  Section,
  SubmitResponseInput,
  Survey,
  SurveyDetail,
  UpdateSurveyContentInput,
} from "./types";
import { createDefaultQuestion } from "./types";

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

function uniqueSlug(store: Store, title: string): string {
  const surveys = store.surveys as Survey[];
  const base = slugify(title);
  let slug = base;
  let counter = 1;

  while (surveys.some((survey) => survey.slug === slug)) {
    slug = `${base}-${counter++}`;
  }

  return slug;
}

function normalizeResponse(response: Response): Response {
  return {
    ...response,
    participantName: response.participantName?.trim() || null,
    gender: response.gender ?? null,
    ageGroup: response.ageGroup ?? null,
  };
}

function buildSurveyDetail(store: Store, survey: Survey): SurveyDetail {
  const sections = (store.sections as Section[])
    .filter((section) => section.surveyId === survey.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => {
      const storedQuestions = (store.questions as Question[])
        .filter((question) => question.sectionId === section.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      return {
        id: section.id,
        surveyId: section.surveyId,
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        questions: migrateLegacyQuestions(section, storedQuestions),
      };
    });

  return { ...survey, sections };
}

export async function listSurveys(): Promise<Survey[]> {
  const store = await readStore();
  return [...(store.surveys as Survey[])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export async function getSurveyById(id: string): Promise<SurveyDetail | null> {
  const store = await readStore();
  const survey = (store.surveys as Survey[]).find((item) => item.id === id);
  if (!survey) return null;
  return buildSurveyDetail(store, survey);
}

export async function getSurveyBySlug(slug: string): Promise<SurveyDetail | null> {
  const store = await readStore();
  const survey = (store.surveys as Survey[]).find((item) => item.slug === slug);
  if (!survey) return null;
  return buildSurveyDetail(store, survey);
}

export async function deleteSurvey(surveyId: string): Promise<boolean> {
  return mutateStore((store) => {
    const surveys = store.surveys as Survey[];
    const sections = store.sections as Section[];
    const questions = store.questions as Question[];
    const responses = store.responses as Response[];
    const answers = store.answers as Answer[];

    const survey = surveys.find((item) => item.id === surveyId);
    if (!survey) return false;

    const sectionIds = new Set(
      sections
        .filter((section) => section.surveyId === surveyId)
        .map((section) => section.id)
    );
    const questionIds = new Set(
      questions
        .filter((question) => sectionIds.has(question.sectionId))
        .map((question) => question.id)
    );
    const responseIds = new Set(
      responses
        .filter((response) => response.surveyId === surveyId)
        .map((response) => response.id)
    );

    store.surveys = surveys.filter((item) => item.id !== surveyId);
    store.sections = sections.filter((section) => section.surveyId !== surveyId);
    store.questions = questions.filter(
      (question) => !sectionIds.has(question.sectionId)
    );
    store.responses = responses.filter(
      (response) => response.surveyId !== surveyId
    );
    store.answers = answers.filter(
      (answer) =>
        !responseIds.has(answer.responseId) &&
        !questionIds.has(answer.questionId)
    );

    return true;
  });
}

export async function createSurvey(input: CreateSurveyInput): Promise<SurveyDetail> {
  return mutateStore((store) => {
    const now = new Date().toISOString();
    const id = nanoid(12);
    const slug = uniqueSlug(store, input.title);

    const survey: Survey = {
      id,
      title: input.title,
      slug,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const sectionId = nanoid(12);
    const section: Section = {
      id: sectionId,
      surveyId: id,
      title: "선호도 섹션",
      description: null,
      sortOrder: 0,
    };

    const defaultQuestion = createDefaultQuestion(0);
    const question: Question = {
      id: nanoid(12),
      sectionId,
      ...defaultQuestion,
    };

    (store.surveys as Survey[]).push(survey);
    (store.sections as Section[]).push(section);
    (store.questions as Question[]).push(question);

    return buildSurveyDetail(store, survey);
  });
}

export async function updateSurveyContent(
  surveyId: string,
  input: UpdateSurveyContentInput
): Promise<SurveyDetail | null> {
  return mutateStore((store) => {
    const surveyIndex = store.surveys.findIndex((item) => item.id === surveyId);
    if (surveyIndex === -1) return null;

    const now = new Date().toISOString();
    const survey = store.surveys[surveyIndex];

    if (input.title !== undefined) survey.title = input.title;
    if (input.description !== undefined) {
      survey.description = input.description ?? null;
    }
    survey.updatedAt = now;

    const existingSectionIds = new Set(
      store.sections
        .filter((section) => section.surveyId === surveyId)
        .map((section) => section.id)
    );
    const incomingSectionIds = new Set<string>();

    for (const sectionInput of input.sections) {
      const sectionId = sectionInput.id ?? nanoid(12);
      incomingSectionIds.add(sectionId);

      const existingSection = store.sections.find((item) => item.id === sectionId);
      if (existingSection && existingSection.surveyId === surveyId) {
        existingSection.title = sectionInput.title;
        existingSection.description = sectionInput.description ?? null;
        existingSection.sortOrder = sectionInput.sortOrder;
      } else {
        store.sections.push({
          id: sectionId,
          surveyId,
          title: sectionInput.title,
          description: sectionInput.description ?? null,
          sortOrder: sectionInput.sortOrder,
        });
      }

      const existingQuestionIds = new Set(
        store.questions
          .filter((question) => question.sectionId === sectionId)
          .map((question) => question.id)
      );
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

        const existingQuestion = store.questions.find(
          (item) => item.id === questionId
        );

        if (existingQuestion && existingQuestion.sectionId === sectionId) {
          Object.assign(existingQuestion, normalized);
        } else {
          store.questions.push(normalized);
        }
      }

      for (const questionId of existingQuestionIds) {
        if (!incomingQuestionIds.has(questionId)) {
          store.questions = store.questions.filter(
            (question) => question.id !== questionId
          );
          store.answers = store.answers.filter(
            (answer) => answer.questionId !== questionId
          );
        }
      }
    }

    for (const sectionId of existingSectionIds) {
      if (!incomingSectionIds.has(sectionId)) {
        const removedQuestionIds = new Set(
          store.questions
            .filter((question) => question.sectionId === sectionId)
            .map((question) => question.id)
        );

        store.sections = store.sections.filter(
          (section) => section.id !== sectionId
        );
        store.questions = store.questions.filter(
          (question) => question.sectionId !== sectionId
        );
        store.answers = store.answers.filter(
          (answer) => !removedQuestionIds.has(answer.questionId)
        );
      }
    }

    return buildSurveyDetail(store, survey);
  });
}

export async function submitResponse(
  surveyId: string,
  input: SubmitResponseInput
): Promise<Response | null> {
  return mutateStore((store) => {
    const surveys = store.surveys as Survey[];
    const responses = store.responses as Response[];
    const answers = store.answers as Answer[];

    const survey = surveys.find((item) => item.id === surveyId);
    if (!survey) return null;

    const now = new Date().toISOString();
    const response: Response = {
      id: nanoid(12),
      surveyId,
      submittedAt: now,
      participantName: input.participantName.trim(),
      gender: input.gender,
      ageGroup: input.ageGroup,
    };

    const newAnswers: Answer[] = input.answers.map((answer) => ({
      id: nanoid(12),
      responseId: response.id,
      questionId: answer.questionId,
      value: answer.value,
    }));

    responses.push(response);
    answers.push(...newAnswers);
    survey.updatedAt = now;

    return response;
  });
}

export async function getDashboardStats(
  surveyId: string
): Promise<DashboardStats | null> {
  const survey = await getSurveyById(surveyId);
  if (!survey) return null;

  const store = await readStore();
  const responses = (store.responses as Response[])
    .filter((response) => response.surveyId === surveyId)
    .map(normalizeResponse);
  const responseIds = new Set(responses.map((response) => response.id));
  const answerList = (store.answers as Answer[]).filter((answer) =>
    responseIds.has(answer.responseId)
  );

  return computeDashboardStats(survey, responses, answerList);
}

export async function listResponses(surveyId: string): Promise<Response[]> {
  const store = await readStore();
  return (store.responses as Response[])
    .filter((response) => response.surveyId === surveyId)
    .map(normalizeResponse)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function deleteResponse(
  surveyId: string,
  responseId: string
): Promise<boolean> {
  return mutateStore((store) => {
    const response = (store.responses as Response[]).find(
      (item) => item.id === responseId && item.surveyId === surveyId
    );
    if (!response) return false;

    store.responses = (store.responses as Response[]).filter(
      (item) => item.id !== responseId
    );
    store.answers = (store.answers as Answer[]).filter(
      (answer) => answer.responseId !== responseId
    );

    const survey = (store.surveys as Survey[]).find((item) => item.id === surveyId);
    if (survey) {
      survey.updatedAt = new Date().toISOString();
    }

    return true;
  });
}

export async function getAnswersForResponse(responseId: string): Promise<Answer[]> {
  const store = await readStore();
  return (store.answers as Answer[]).filter(
    (answer) => answer.responseId === responseId
  );
}
