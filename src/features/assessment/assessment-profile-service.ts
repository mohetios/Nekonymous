import type { Environment } from "../../types";
import { generateOpaqueId } from "../../ticketing/ticketing-service";
import type { AssessmentResultSummary, AssessmentScores } from "./scoring";
import {
  computePrimaryIntent,
  computeProfileBucket,
  computeSafetyTier,
} from "./scoring";
import { scoresFromJson, scoresToJson } from "./assessment-scores";
import { incrementPlatformStat } from "../platform/platform-stats-service";
import {
  ASSESSMENT_DEFAULT_SHORT_DESCRIPTION,
  ASSESSMENT_DEFAULT_TITLE,
} from "../../i18n/assessment-ui";

export type AssessmentProfileRow = {
  user_id: string;
  version: string;
  status: string;
  dimension_scores_json: string;
  result_summary_json: string;
  profile_summary_text: string | null;
  vector_id: string | null;
  vector_status: string;
  discoverable: number;
  safety_tier: string;
  primary_intent: string;
  profile_bucket: number;
  completed_at: number;
  updated_at?: number;
};

export { scoresToJson, parseDimensionScores } from "./assessment-scores";

export const getProfileConfidence = (row: AssessmentProfileRow): number => {
  try {
    const parsed = JSON.parse(row.result_summary_json) as {
      quality?: { confidence?: unknown };
    };
    const confidence = parsed.quality?.confidence;
    return typeof confidence === "number" && Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0.75;
  } catch {
    return 0.75;
  }
};

export const isMatchEligibleProfile = (row: AssessmentProfileRow): boolean =>
  row.status === "completed" && getProfileConfidence(row) >= 0.5;

export const createAssessmentAttempt = async (
  userId: string,
  version: string,
  totalQuestions: number,
  env: Environment
): Promise<string> => {
  const id = generateOpaqueId(16);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO assessment_attempts (
      id, user_id, version, status, started_at, total_questions, answered_questions
    ) VALUES (?, ?, ?, 'started', ?, ?, 0)`
  )
    .bind(id, userId, version, now, totalQuestions)
    .run();

  return id;
};

export const abandonActiveAssessmentAttempts = async (
  userId: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE assessment_attempts
     SET status = 'abandoned', abandoned_at = ?
     WHERE user_id = ? AND status = 'started'`
  )
    .bind(now, userId)
    .run();
};

export const saveAssessmentAnswer = async (
  attemptId: string,
  userId: string,
  questionId: string,
  answerValue: number,
  env: Environment
): Promise<void> => {
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO assessment_answers (attempt_id, user_id, question_id, answer_value, answered_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id) DO UPDATE SET
         answer_value = excluded.answer_value,
         answered_at = excluded.answered_at`
    ).bind(attemptId, userId, questionId, answerValue, now),
    env.DB.prepare(
      `UPDATE assessment_attempts
       SET answered_questions = (
         SELECT COUNT(*) FROM assessment_answers WHERE attempt_id = ?
       )
       WHERE id = ?`
    ).bind(attemptId, attemptId),
  ]);
};

export const completeAssessmentAttempt = async (
  attemptId: string,
  userId: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE assessment_attempts
     SET status = 'completed', completed_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(now, attemptId, userId)
    .run();
};

export const saveAssessmentProfile = async (
  userId: string,
  version: string,
  scores: AssessmentScores,
  summary: AssessmentResultSummary,
  profileSummaryText: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  const primaryIntent = computePrimaryIntent(scores);
  const safetyTier = computeSafetyTier(scores);
  const profileBucket = computeProfileBucket(scores);

  await env.DB.prepare(
    `INSERT INTO assessment_profiles (
      user_id, version, status,
      dimension_scores_json, result_summary_json, profile_summary_text,
      vector_status, discoverable, safety_tier, primary_intent, profile_bucket,
      completed_at, updated_at
    ) VALUES (
      ?, ?, 'completed',
      ?, ?, ?,
      'not_indexed', 0, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(user_id) DO UPDATE SET
      version = excluded.version,
      status = excluded.status,
      dimension_scores_json = excluded.dimension_scores_json,
      result_summary_json = excluded.result_summary_json,
      profile_summary_text = excluded.profile_summary_text,
      vector_status = 'not_indexed',
      vector_id = NULL,
      vector_updated_at = NULL,
      safety_tier = excluded.safety_tier,
      primary_intent = excluded.primary_intent,
      profile_bucket = excluded.profile_bucket,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at`
  )
    .bind(
      userId,
      version,
      scoresToJson(scores),
      JSON.stringify(summary),
      profileSummaryText,
      safetyTier,
      primaryIntent,
      profileBucket,
      now,
      now
    )
    .run();

  await incrementPlatformStat(env, "assessment_completions");
};

export const updateProfileVectorStatus = async (
  userId: string,
  vectorId: string,
  status: "indexed" | "failed" | "not_indexed",
  profileSummaryText: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE assessment_profiles
     SET vector_id = ?, vector_status = ?, vector_updated_at = ?,
         profile_summary_text = COALESCE(?, profile_summary_text),
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(vectorId, status, now, profileSummaryText, now, userId)
    .run();
};

export const getLatestAssessmentProfile = async (
  userId: string,
  env: Environment
): Promise<AssessmentProfileRow | null> => {
  return env.DB.prepare("SELECT * FROM assessment_profiles WHERE user_id = ?")
    .bind(userId)
    .first<AssessmentProfileRow>();
};

export const getMatchProfile = async (
  userId: string,
  env: Environment
): Promise<AssessmentProfileRow | null> => getLatestAssessmentProfile(userId, env);

export const setDiscoverable = async (
  userId: string,
  enabled: boolean,
  env: Environment
): Promise<void> => {
  if (enabled) {
    const profile = await getLatestAssessmentProfile(userId, env);
    if (!profile || !isMatchEligibleProfile(profile)) {
      return;
    }
  }

  const now = Date.now();
  await env.DB.prepare(
    `UPDATE assessment_profiles
     SET discoverable = ?, updated_at = ?
     WHERE user_id = ? AND status = 'completed'`
  )
    .bind(enabled ? 1 : 0, now, userId)
    .run();
};

export const parseResultSummary = (
  row: AssessmentProfileRow
): AssessmentResultSummary => {
  try {
    const parsed = JSON.parse(row.result_summary_json) as AssessmentResultSummary;
    return {
      title: parsed.title ?? ASSESSMENT_DEFAULT_TITLE,
      shortDescription:
        parsed.shortDescription ?? ASSESSMENT_DEFAULT_SHORT_DESCRIPTION,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions : [],
      matchNotes: Array.isArray(parsed.matchNotes) ? parsed.matchNotes : [],
      quality: parsed.quality,
    };
  } catch {
    return {
      title: ASSESSMENT_DEFAULT_TITLE,
      shortDescription: ASSESSMENT_DEFAULT_SHORT_DESCRIPTION,
      highlights: [],
      cautions: [],
      matchNotes: [],
    };
  }
};

export const profileScoresFromRow = (row: AssessmentProfileRow): AssessmentScores =>
  scoresFromJson(row.dimension_scores_json, row.user_id);
