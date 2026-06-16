import type { Environment } from "../../types";
import { generateOpaqueId } from "../../services/crypto-service";
import {
  PROFILE_EMBEDDING_DIMENSION,
  PROFILE_EMBEDDING_MODEL,
} from "./constants";
import { buildProfileEmbeddingText } from "./profile-summary";
import type { TestResultSummary, TestScores } from "./scoring";
import { updateProfileVectorStatus } from "./test-profile-service";

export type ProfileVectorMetadata = {
  userId: string;
  locale: "fa" | "en";
  discoverable: boolean;
  safetyTier: "normal" | "limited";
  profileVersion: string;
  intentPrimary: string;
  profileBucket: number;
};

export const buildProfileVectorId = (
  userId: string,
  version: string
): string => `profile:${userId}:${version}`;

const extractEmbedding = (response: unknown): number[] => {
  const data = response as { data?: number[][] | number[] };
  if (Array.isArray(data.data)) {
    const first = data.data[0];
    if (Array.isArray(first)) {
      return first;
    }
    if (typeof first === "number") {
      return data.data as number[];
    }
  }
  throw new Error("Unexpected embedding response shape");
};

export const indexCompletedProfile = async (params: {
  userId: string;
  version: string;
  locale: "fa" | "en";
  scores: TestScores;
  resultSummary: TestResultSummary;
  profileSummaryText: string;
  discoverable: boolean;
  safetyTier: "normal" | "limited";
  primaryIntent: string;
  profileBucket: number;
  env: Environment;
}): Promise<{ vectorId: string; model: string; dimension?: number }> => {
  const {
    userId,
    version,
    locale,
    scores,
    resultSummary,
    profileSummaryText,
    discoverable,
    safetyTier,
    primaryIntent,
    profileBucket,
    env,
  } = params;

  const vectorId = buildProfileVectorId(userId, version);
  const eventId = generateOpaqueId(12);
  const now = Date.now();
  const text =
    profileSummaryText ||
    buildProfileEmbeddingText(scores, resultSummary, locale);

  await env.DB.prepare(
    `INSERT INTO profile_vector_index_events (
      id, user_id, vector_id, profile_version, status, model, created_at
    ) VALUES (?, ?, ?, ?, 'started', ?, ?)`
  )
    .bind(eventId, userId, vectorId, version, PROFILE_EMBEDDING_MODEL, now)
    .run();

  try {
    const embeddingResponse = await env.AI.run(PROFILE_EMBEDDING_MODEL, {
      text: [text],
    });

    const values = extractEmbedding(embeddingResponse);
    const dimension = values.length;

    if (dimension !== PROFILE_EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension mismatch: expected ${PROFILE_EMBEDDING_DIMENSION}, got ${dimension}`
      );
    }

    const metadata: ProfileVectorMetadata = {
      userId,
      locale,
      discoverable,
      safetyTier,
      profileVersion: version,
      intentPrimary: primaryIntent,
      profileBucket,
    };

    await env.PROFILE_VECTORS.upsert([
      {
        id: vectorId,
        values,
        metadata: {
          userId: metadata.userId,
          locale: metadata.locale,
          discoverable: metadata.discoverable,
          safetyTier: metadata.safetyTier,
          profileVersion: metadata.profileVersion,
          intentPrimary: metadata.intentPrimary,
          profileBucket: metadata.profileBucket,
        },
      },
    ]);

    await updateProfileVectorStatus(
      userId,
      vectorId,
      "indexed",
      text,
      env
    );

    await env.DB.prepare(
      `UPDATE profile_vector_index_events
       SET status = 'completed', dimension = ?, completed_at = ?
       WHERE id = ?`
    )
      .bind(dimension, Date.now(), eventId)
      .run();

    return { vectorId, model: PROFILE_EMBEDDING_MODEL, dimension };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "indexing failed";

    await updateProfileVectorStatus(userId, vectorId, "failed", text, env);

    await env.DB.prepare(
      `UPDATE profile_vector_index_events
       SET status = 'failed', error_message = ?, completed_at = ?
       WHERE id = ?`
    )
      .bind(message, Date.now(), eventId)
      .run();

    throw error;
  }
};

/** Non-fatal wrapper: logs failure via D1 event row, does not throw to caller. */
export const indexCompletedProfileSafe = async (
  params: Parameters<typeof indexCompletedProfile>[0]
): Promise<void> => {
  try {
    await indexCompletedProfile(params);
  } catch {
    // Vector indexing failure is non-fatal; status recorded in D1.
  }
};
