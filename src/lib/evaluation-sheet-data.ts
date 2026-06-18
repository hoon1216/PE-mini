import { parseChoiceAnswer } from "./choice-utils";
import { parseRankingAnswer } from "./demographic-utils";
import {
  flattenScoreReasonQuestions,
  parseScoreReasonAnswer,
  scoreFromAnswerValue,
} from "./score-reason-utils";
import {
  getRank1FromAnswerMap,
  shouldShowTextQuestion,
} from "./text-grouping-utils";
import type {
  Answer,
  ChoiceQuestionConfig,
  Question,
  RankingQuestionConfig,
  Response,
  ScoreQuestionConfig,
  ScoreCompareQuestionConfig,
  Section,
  SurveyDetail,
} from "./types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "./types";

export interface ScoreRow {
  category: string;
  combination: string;
  score: number | null;
  rank: number | null;
}

export interface GroupRankRow {
  label: string;
  rank: number | null;
}

export interface BodyColumnData {
  sectionTitle: string;
  scoreRows: ScoreRow[];
  groupRanks: GroupRankRow[];
  firstRankReason: string;
}

export interface EvaluationSheet {
  participantName: string;
  genderLabel: string;
  ageGroupLabel: string;
  demographicLines: { label: string; value: string }[];
  bodyColumns: BodyColumnData[];
  preferredGrill: { rank1: string; rank2: string; rank3: string };
  preferredReason: string;
}

export interface ResponseWithAnswers extends Response {
  answers: Answer[];
}

function computeRanksForScores(
  items: { id: string; score: number | null }[]
): Map<string, number | null> {
  const valid = items
    .filter((item) => item.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const ranks = new Map<string, number | null>();
  let rank = 1;
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i].score !== valid[i - 1].score) rank = i + 1;
    ranks.set(valid[i].id, rank);
  }
  for (const item of items) {
    if (!ranks.has(item.id)) ranks.set(item.id, null);
  }
  return ranks;
}

export function formatGroupLabel(label: string): string {
  if (label.endsWith("그룹") && !label.includes(" ")) {
    return label.replace("그룹", " 그룹");
  }
  return label;
}

function getRankingPosition(
  ranking: { rank1: string; rank2: string; rank3?: string },
  combination: string
): number | null {
  if (ranking.rank1 === combination) return 1;
  if (ranking.rank2 === combination) return 2;
  if (ranking.rank3 === combination) return 3;
  return null;
}

function collectTextReason(
  section: Section & { questions: Question[] },
  answersByQuestionId: Map<string, string>
): string {
  const rank1 = getRank1FromAnswerMap(section, answersByQuestionId);
  const parts: string[] = [];

  for (const question of section.questions.filter((q) => q.type === "text")) {
    if (!shouldShowTextQuestion(question, section, rank1)) continue;
    const value = answersByQuestionId.get(question.id)?.trim();
    if (value) parts.push(value);
  }

  if (parts.length > 0) return parts.join("\n");

  for (const question of section.questions.filter((q) => q.type === "text")) {
    const value = answersByQuestionId.get(question.id)?.trim();
    if (value) return value;
  }

  return "";
}

function collectScoreReasonText(
  section: Section & { questions: Question[] },
  answersByQuestionId: Map<string, string>
): string {
  const parts: string[] = [];

  for (const question of section.questions.filter(
    (entry) => entry.type === "score-compare"
  )) {
    const config = question.config as ScoreCompareQuestionConfig;
    const parsed = parseScoreReasonAnswer(
      answersByQuestionId.get(question.id) ?? "",
      config.combinations
    );
    if (!parsed?.reason.trim()) continue;
    parts.push(parsed.reason.trim());
  }

  return parts.join("\n");
}

const PREFERENCE_REASON_TITLE = "1순위 선호 이유";

function isPreferenceReasonQuestion(question: Question): boolean {
  const title = question.title.trim();
  return (
    title === PREFERENCE_REASON_TITLE || title.includes(PREFERENCE_REASON_TITLE)
  );
}

export function findPreferenceReasonQuestion(
  section: Section & { questions: Question[] }
): Question | null {
  const reasonQuestions = section.questions
    .filter(
      (question) =>
        (question.type === "choice" || question.type === "text") &&
        isPreferenceReasonQuestion(question)
    )
    .sort((a, b) => b.sortOrder - a.sortOrder);

  if (reasonQuestions.length > 0) return reasonQuestions[0];

  const lastChoice = section.questions
    .filter((question) => question.type === "choice")
    .sort((a, b) => b.sortOrder - a.sortOrder)[0];

  return lastChoice ?? null;
}

export function collectPreferenceReason(
  section: Section & { questions: Question[] },
  answersByQuestionId: Map<string, string>
): string {
  const question = findPreferenceReasonQuestion(section);
  if (!question) return "";

  if (question.type === "choice") {
    const config = question.config as ChoiceQuestionConfig;
    const selected = parseChoiceAnswer(
      answersByQuestionId.get(question.id),
      config
    );
    return selected.join("\n");
  }

  return answersByQuestionId.get(question.id)?.trim() ?? "";
}

export function isPreferenceSection(
  section: Section & { questions: Question[] }
): boolean {
  const scoreCount = section.questions.filter(
    (q) => q.type === "score" || q.type === "score-compare"
  ).length;
  if (scoreCount > 0) return false;

  const ranking = section.questions.find((q) => q.type === "ranking");
  if (!ranking) return false;

  const config = ranking.config as RankingQuestionConfig;
  return config.combinations.length > 3;
}

function buildBodyColumn(
  section: Section & { questions: Question[] },
  answersByQuestionId: Map<string, string>
): BodyColumnData {
  const scoreRows: ScoreRow[] = [];

  for (const question of section.questions
    .filter((q) => q.type === "score" || q.type === "score-compare")
    .sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (question.type === "score-compare") {
      const flattened = flattenScoreReasonQuestions([question]);
      const config = question.config as ScoreCompareQuestionConfig;
      const parsed = parseScoreReasonAnswer(
        answersByQuestionId.get(question.id) ?? "",
        config.combinations
      );

      for (const item of flattened) {
        scoreRows.push({
          category: item.category,
          combination: item.combination,
          score: parsed?.scores[item.combination] ?? null,
          rank: null,
        });
      }
      continue;
    }

    const config = question.config as ScoreQuestionConfig;
    const raw = answersByQuestionId.get(question.id);
    const score = raw ? scoreFromAnswerValue(raw) : null;
    scoreRows.push({
      category: config.category,
      combination: config.combination,
      score,
      rank: null,
    });
  }

  const ranks = computeRanksForScores(
    scoreRows.map((row, index) => ({
      id: String(index),
      score: row.score,
    }))
  );
  scoreRows.forEach((row, index) => {
    row.rank = ranks.get(String(index)) ?? null;
  });

  const rankingQuestion = section.questions.find((q) => q.type === "ranking");
  let groupRanks: GroupRankRow[] = [];

  if (rankingQuestion) {
    const config = rankingQuestion.config as RankingQuestionConfig;
    const parsed = parseRankingAnswer(
      answersByQuestionId.get(rankingQuestion.id) ?? ""
    );

    groupRanks = config.combinations.map((combination) => ({
      label: formatGroupLabel(combination),
      rank: parsed ? getRankingPosition(parsed, combination) : null,
    }));
  }

  return {
    sectionTitle: section.title,
    scoreRows,
    groupRanks,
    firstRankReason:
      collectTextReason(section, answersByQuestionId) ||
      collectScoreReasonText(section, answersByQuestionId),
  };
}

export function buildEvaluationSheet(
  survey: SurveyDetail,
  response: Response,
  answers: Answer[]
): EvaluationSheet {
  const answersByQuestionId = new Map(
    answers
      .filter((answer) => answer.responseId === response.id)
      .map((answer) => [answer.questionId, answer.value])
  );

  const sections = [...survey.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const bodySections = sections.filter((section) =>
    section.questions.some(
      (question) => question.type === "score" || question.type === "score-compare"
    )
  );
  const preferenceSection =
    sections.find(isPreferenceSection) ??
    [...sections].reverse().find((section) =>
      section.questions.some((question) => question.type === "ranking")
    );

  const bodyColumns = bodySections.map((section) =>
    buildBodyColumn(section, answersByQuestionId)
  );

  let preferredGrill = { rank1: "", rank2: "", rank3: "" };
  let preferredReason = "";

  if (preferenceSection) {
    const rankingQuestion = preferenceSection.questions.find(
      (question) => question.type === "ranking"
    );
    if (rankingQuestion) {
      const parsed = parseRankingAnswer(
        answersByQuestionId.get(rankingQuestion.id) ?? ""
      );
      if (parsed) {
        preferredGrill = {
          rank1: parsed.rank1,
          rank2: parsed.rank2,
          rank3: parsed.rank3 ?? "",
        };
      }
    }
    preferredReason = collectPreferenceReason(
      preferenceSection,
      answersByQuestionId
    );
  }

  return {
    participantName: response.participantName ?? "",
    genderLabel: response.gender ? GENDER_LABELS[response.gender] : "-",
    ageGroupLabel: response.ageGroup ? AGE_GROUP_LABELS[response.ageGroup] : "-",
    demographicLines: survey.demographicFields.map((field) => ({
      label: field.label,
      value: response.demographicValues[field.id] ?? "-",
    })),
    bodyColumns,
    preferredGrill,
    preferredReason,
  };
}

export function buildEvaluationSheets(
  survey: SurveyDetail,
  responses: ResponseWithAnswers[]
): EvaluationSheet[] {
  return responses.map((response) =>
    buildEvaluationSheet(survey, response, response.answers)
  );
}
