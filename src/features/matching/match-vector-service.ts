import type { Environment } from "../../types";
import { logBotError } from "../../utils/logs";
import { buildProfileVectorId } from "../assessment/profile-vector-service";
import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { ASSESSMENT_VERSION } from "../assessment/question-bank";
import { MATCH_SEARCH_TOP_K } from "./constants";

type VectorMatch = {
  userId: string;
  vectorScore: number;
};

const extractUserIdFromVectorId = (id: string | undefined): string | null => {
  if (!id?.startsWith("profile:") || !id.endsWith(`:${ASSESSMENT_VERSION}`)) {
    return null;
  }
  const userId = id.slice("profile:".length, -(`:${ASSESSMENT_VERSION}`.length));
  return userId || null;
};

export const queryVectorCandidates = async (
  requesterProfile: AssessmentProfileRow,
  locale: string,
  env: Environment
): Promise<VectorMatch[]> => {
  const vectorId =
    requesterProfile.vector_id ??
    buildProfileVectorId(requesterProfile.user_id, requesterProfile.version);

  const stored = await env.PROFILE_VECTORS.getByIds([vectorId]);
  const vector = stored[0];
  if (!vector?.values?.length) {
    return [];
  }

  const filter: Record<string, string | boolean> = {
    discoverable: true,
    locale: locale === "en" ? "en" : "fa",
    matchEligible: true,
    profileVersion: ASSESSMENT_VERSION,
  };

  let result: Awaited<ReturnType<Environment["PROFILE_VECTORS"]["query"]>>;
  try {
    result = await env.PROFILE_VECTORS.query(vector.values, {
      topK: MATCH_SEARCH_TOP_K,
      returnValues: false,
      returnMetadata: "all",
      filter,
    });
  } catch (error) {
    logBotError("queryVectorCandidates", error);
    return [];
  }

  const matches: VectorMatch[] = [];
  for (const match of result.matches) {
    const userId = extractUserIdFromVectorId(match.id);
    if (!userId || userId === requesterProfile.user_id) {
      continue;
    }
    matches.push({
      userId,
      vectorScore: match.score,
    });
  }

  return matches;
};
