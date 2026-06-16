import type { Environment } from "../../types";
import { buildProfileEmbeddingText } from "./profile-summary";
import { indexCompletedProfileSafe } from "./profile-vector-service";
import {
  TEST_QUESTIONS,
  TEST_QUESTION_COUNT,
  TEST_VERSION,
} from "./question-bank";
import {
  buildResultSummary,
  computePrimaryIntent,
  computeProfileBucket,
  computeSafetyTier,
  computeTestScores,
} from "./scoring";
import {
  completeTestAttempt,
  saveTestProfile,
  saveTestAnswer as persistTestAnswer,
} from "./test-profile-service";
import {
  completeTestSession,
  getTestSession,
  type TestSession,
} from "../../services/user-state-service";

const allQuestionsAnswered = (answers: Record<string, number>): boolean =>
  TEST_QUESTIONS.every(
    (q) => answers[q.id] !== undefined && answers[q.id] >= 1 && answers[q.id] <= 5
  );

export const completeTestFlow = async (
  userId: string,
  locale: string,
  env: Environment
): Promise<{
  summary: ReturnType<typeof buildResultSummary>;
  scores: ReturnType<typeof computeTestScores>;
  profileSummaryText: string;
  version: string;
}> => {
  const session = await getTestSession(userId, env);
  if (!session || !session.attemptId) {
    throw new Error("No active test session");
  }

  if (!allQuestionsAnswered(session.answers)) {
    throw new Error("Incomplete test answers");
  }

  const scores = computeTestScores(session.answers);
  const summary = buildResultSummary(scores);
  const profileSummaryText = buildProfileEmbeddingText(
    scores,
    summary,
    locale === "en" ? "en" : "fa"
  );

  await finalizeTestFromSession(
    userId,
    locale,
    session,
    env,
    scores,
    summary,
    profileSummaryText
  );

  return {
    summary,
    scores,
    profileSummaryText,
    version: session.version || TEST_VERSION,
  };
};

export const finalizeTestFromSession = async (
  userId: string,
  locale: string,
  session: TestSession,
  env: Environment,
  scores?: ReturnType<typeof computeTestScores>,
  summary?: ReturnType<typeof buildResultSummary>,
  profileSummaryText?: string
): Promise<void> => {
  if (!session.attemptId) {
    throw new Error("Missing attempt id");
  }

  for (const question of TEST_QUESTIONS) {
    const value = session.answers[question.id];
    if (value !== undefined) {
      await persistTestAnswer(
        session.attemptId,
        userId,
        question.id,
        value,
        env
      );
    }
  }

  const resolvedScores = scores ?? computeTestScores(session.answers);
  const resolvedSummary = summary ?? buildResultSummary(resolvedScores);
  const resolvedProfileText =
    profileSummaryText ??
    buildProfileEmbeddingText(
      resolvedScores,
      resolvedSummary,
      locale === "en" ? "en" : "fa"
    );

  await saveTestProfile(
    userId,
    session.version || TEST_VERSION,
    resolvedScores,
    resolvedSummary,
    resolvedProfileText,
    env
  );
  await completeTestAttempt(session.attemptId, userId, env);
  await completeTestSession(userId, env);
};

export const scheduleProfileIndexing = (
  params: {
    userId: string;
    version: string;
    locale: "fa" | "en";
    scores: ReturnType<typeof computeTestScores>;
    summary: ReturnType<typeof buildResultSummary>;
    profileSummaryText: string;
    env: Environment;
  },
  defer?: (promise: Promise<unknown>) => void
): void => {
  const job = indexCompletedProfileSafe({
    userId: params.userId,
    version: params.version,
    locale: params.locale,
    scores: params.scores,
    resultSummary: params.summary,
    profileSummaryText: params.profileSummaryText,
    discoverable: false,
    safetyTier: computeSafetyTier(params.scores),
    primaryIntent: computePrimaryIntent(params.scores),
    profileBucket: computeProfileBucket(params.scores),
    env: params.env,
  });

  if (defer) {
    defer(job);
  } else {
    void job;
  }
};

export const firstUnansweredIndex = (session: TestSession): number => {
  for (let i = 0; i < TEST_QUESTION_COUNT; i++) {
    const q = TEST_QUESTIONS[i];
    if (session.answers[q.id] === undefined) {
      return i;
    }
  }
  return Math.min(session.currentIndex, TEST_QUESTION_COUNT - 1);
};

export const resumeQuestionIndex = (session: TestSession): number => {
  const unanswered = firstUnansweredIndex(session);
  if (session.answers[TEST_QUESTIONS[unanswered]?.id ?? ""] === undefined) {
    return unanswered;
  }
  return Math.min(session.currentIndex, TEST_QUESTION_COUNT - 1);
};
