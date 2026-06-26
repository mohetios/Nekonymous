import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import {
  getProfileConfidence,
  isMatchEligibleProfile,
} from "../assessment/assessment-profile-service";
import { scoresFromJson } from "../assessment/assessment-scores";
import { ASSESSMENT_VERSION, type AssessmentDimension } from "../assessment/question-bank";
import type { AssessmentScores } from "../assessment/scoring";
import { clamp01 } from "../assessment/scoring";
import { getMatchQualityLabel } from "./match-quality";
import {
  MATCH_CAUTION_DIRECTNESS,
  MATCH_CAUTION_REPLY_PACE,
  MATCH_EXPLANATION_FALLBACK_REASON,
  MATCH_EXPLANATION_TITLE,
  MATCH_REASON_BOUNDARY,
  MATCH_REASON_CONFLICT_REPAIR,
  MATCH_REASON_DEPTH,
  MATCH_REASON_WARMTH,
} from "../../i18n/matching";
import type { MatchCandidate, MatchExplanation } from "./match-types";
type TraitMetric = "closeness" | "floor" | "mixed";

export const V1_TRAIT_WEIGHTS = {
  boundaryRespect: { weight: 0.12, metric: "floor" },
  honestyTransparency: { weight: 0.08, metric: "floor" },
  emotionalRegulation: { weight: 0.09, metric: "floor" },
  conflictRepair: { weight: 0.08, metric: "floor" },
  reliabilityConsistency: { weight: 0.07, metric: "floor" },

  depthPreference: { weight: 0.09, metric: "closeness" },
  replyPacePreference: { weight: 0.08, metric: "closeness" },
  directnessPreference: { weight: 0.07, metric: "closeness" },
  anonymityComfort: { weight: 0.06, metric: "closeness" },
  curiosityDepth: { weight: 0.06, metric: "closeness" },
  socialEnergy: { weight: 0.03, metric: "closeness" },

  warmthEmpathy: { weight: 0.07, metric: "mixed" },
  emotionalSensitivity: { weight: 0.05, metric: "mixed" },
  supportPreference: { weight: 0.05, metric: "mixed" },
} as const satisfies Record<
  AssessmentDimension,
  { weight: number; metric: TraitMetric }
>;

export type MatchPenalties = {
  lowConfidence: number;
  staleProfile: number;
  repeatedExposure: number;
  dismissedRecently: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const closeness = (a: number, b: number): number =>
  1 - Math.abs(clamp01(a) - clamp01(b));

export const floorFit = (a: number, b: number): number =>
  Math.min(clamp01(a), clamp01(b));

export const mixedFit = (a: number, b: number): number =>
  0.65 * closeness(a, b) + 0.35 * floorFit(a, b);

const metricScore = (metric: TraitMetric, a: number, b: number): number => {
  if (metric === "floor") {
    return floorFit(a, b);
  }
  if (metric === "mixed") {
    return mixedFit(a, b);
  }
  return closeness(a, b);
};

const daysBetween = (a: Date, b: Date): number =>
  Math.max(0, Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY);

export const freshnessFit = (updatedAt: Date, now = new Date()): number => {
  const ageDays = daysBetween(updatedAt, now);
  if (ageDays <= 30) {
    return 1;
  }
  if (ageDays >= 180) {
    return 0;
  }
  return 1 - (ageDays - 30) / 150;
};

const staleProfilePenalty = (updatedAt: Date, now = new Date()): number => {
  const ageDays = daysBetween(updatedAt, now);
  if (ageDays <= 90) {
    return 0;
  }
  if (ageDays >= 180) {
    return 0.05;
  }
  return ((ageDays - 90) / 90) * 0.05;
};

export const normalizeVectorScore = (score: number | undefined): number => {
  if (score === undefined || Number.isNaN(score)) {
    return 0.5;
  }
  return clamp01(score);
};

export const traitFit = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): number => {
  let score = 0;
  for (const key of Object.keys(V1_TRAIT_WEIGHTS) as AssessmentDimension[]) {
    const config = V1_TRAIT_WEIGHTS[key];
    score += config.weight * metricScore(config.metric, requester[key], candidate[key]);
  }
  return clamp01(score);
};

const languageFit = (
  requesterProfile: AssessmentProfileRow,
  candidateProfile: AssessmentProfileRow
): number => {
  const requesterLocale = requesterProfile.version === ASSESSMENT_VERSION ? 1 : 0;
  const candidateLocale = candidateProfile.version === ASSESSMENT_VERSION ? 1 : 0;
  return requesterLocale && candidateLocale ? 1 : 0;
};

const preferenceFit = (
  requester: AssessmentScores,
  candidate: AssessmentScores,
  requesterProfile: AssessmentProfileRow,
  candidateProfile: AssessmentProfileRow
): number => {
  const language = languageFit(requesterProfile, candidateProfile);
  const depth = closeness(requester.depthPreference, candidate.depthPreference);
  const pace = closeness(requester.replyPacePreference, candidate.replyPacePreference);
  const freshness = freshnessFit(new Date(candidateProfile.updated_at ?? candidateProfile.completed_at));
  return clamp01(0.5 * language + 0.2 * depth + 0.2 * pace + 0.1 * freshness);
};

export const computeMatchPenalties = (params: {
  confidenceFit: number;
  candidateUpdatedAt: Date;
  seenInLast14Days?: boolean;
  dismissedInLast14Days?: boolean;
  now?: Date;
}): MatchPenalties => ({
  lowConfidence: params.confidenceFit < 0.65 ? 0.04 : 0,
  staleProfile: staleProfilePenalty(params.candidateUpdatedAt, params.now),
  repeatedExposure: params.seenInLast14Days ? 0.02 : 0,
  dismissedRecently: params.dismissedInLast14Days ? 0.03 : 0,
});

const penaltyTotal = (penalties: MatchPenalties): number =>
  penalties.lowConfidence +
  penalties.staleProfile +
  penalties.repeatedExposure +
  penalties.dismissedRecently;

const buildReasons = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): string[] => {
  const scored = [
    {
      value: floorFit(requester.boundaryRespect, candidate.boundaryRespect),
      text: MATCH_REASON_BOUNDARY,
    },
    {
      value: closeness(requester.depthPreference, candidate.depthPreference),
      text: MATCH_REASON_DEPTH,
    },
    {
      value: floorFit(requester.conflictRepair, candidate.conflictRepair),
      text: MATCH_REASON_CONFLICT_REPAIR,
    },
    {
      value: mixedFit(requester.warmthEmpathy, candidate.warmthEmpathy),
      text: MATCH_REASON_WARMTH,
    },
  ];

  return scored
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((item) => item.text);
};

const buildCautions = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): string[] => {
  const cautions: string[] = [];
  if (closeness(requester.replyPacePreference, candidate.replyPacePreference) < 0.65) {
    cautions.push(MATCH_CAUTION_REPLY_PACE);
  }
  if (closeness(requester.directnessPreference, candidate.directnessPreference) < 0.6) {
    cautions.push(MATCH_CAUTION_DIRECTNESS);
  }
  return cautions.slice(0, 2);
};

export const isCurrentAssessmentProfile = (profile: AssessmentProfileRow): boolean =>
  profile.version === ASSESSMENT_VERSION;

export const scoreMatchPair = (params: {
  requesterProfile: AssessmentProfileRow;
  candidateProfile: AssessmentProfileRow;
  vectorScore?: number;
  seenInLast14Days?: boolean;
  dismissedInLast14Days?: boolean;
  now?: Date;
}): MatchCandidate | null => {
  if (
    !isCurrentAssessmentProfile(params.requesterProfile) ||
    !isCurrentAssessmentProfile(params.candidateProfile) ||
    !isMatchEligibleProfile(params.requesterProfile) ||
    !isMatchEligibleProfile(params.candidateProfile)
  ) {
    return null;
  }

  const requesterScores = scoresFromJson(
    params.requesterProfile.dimension_scores_json,
    params.requesterProfile.user_id
  );
  const candidateScores = scoresFromJson(
    params.candidateProfile.dimension_scores_json,
    params.candidateProfile.user_id
  );

  const trait = traitFit(requesterScores, candidateScores);
  const semanticSimilarity = normalizeVectorScore(params.vectorScore);
  const preference = preferenceFit(
    requesterScores,
    candidateScores,
    params.requesterProfile,
    params.candidateProfile
  );
  const requesterConfidence = getProfileConfidence(params.requesterProfile);
  const candidateConfidence = getProfileConfidence(params.candidateProfile);
  const confidence = Math.sqrt(requesterConfidence * candidateConfidence);
  const candidateUpdatedAt = new Date(
    params.candidateProfile.updated_at ?? params.candidateProfile.completed_at
  );
  const freshness = freshnessFit(candidateUpdatedAt, params.now);
  const penalties = computeMatchPenalties({
    confidenceFit: confidence,
    candidateUpdatedAt,
    seenInLast14Days: params.seenInLast14Days,
    dismissedInLast14Days: params.dismissedInLast14Days,
    now: params.now,
  });

  const finalScore = clamp01(
    0.72 * trait +
      0.1 * semanticSimilarity +
      0.08 * preference +
      0.06 * confidence +
      0.04 * freshness -
      penaltyTotal(penalties)
  );

  const explanation: MatchExplanation = {
    title: MATCH_EXPLANATION_TITLE,
    reasons: buildReasons(requesterScores, candidateScores),
    cautions: buildCautions(requesterScores, candidateScores),
  };

  return {
    userId: params.candidateProfile.user_id,
    score: finalScore,
    vectorScore: semanticSimilarity,
    deterministicScore: finalScore,
    traitFit: trait,
    preferenceFit: preference,
    confidenceFit: confidence,
    freshnessFit: freshness,
    penalties,
    qualityLabel: getMatchQualityLabel(finalScore),
    explanation,
  };
};

export const parseMatchExplanation = (raw: string): MatchExplanation => {
  try {
    const parsed = JSON.parse(raw) as MatchExplanation;
    if (parsed?.title && Array.isArray(parsed.reasons)) {
      return {
        title: parsed.title,
        reasons: parsed.reasons,
        cautions: Array.isArray(parsed.cautions) ? parsed.cautions : [],
      };
    }
  } catch {
    // fall through
  }
  return {
    title: MATCH_EXPLANATION_TITLE,
    reasons: [MATCH_EXPLANATION_FALLBACK_REASON],
    cautions: [],
  };
};

export const compareCandidateRanking = (
  requesterProfile: AssessmentProfileRow,
  candidateAProfile: AssessmentProfileRow,
  candidateBProfile: AssessmentProfileRow,
  candidateA: MatchCandidate,
  candidateB: MatchCandidate
): number => {
  if (candidateB.score !== candidateA.score) {
    return candidateB.score - candidateA.score;
  }

  const requesterScores = scoresFromJson(
    requesterProfile.dimension_scores_json,
    requesterProfile.user_id
  );
  const scoresA = scoresFromJson(
    candidateAProfile.dimension_scores_json,
    candidateAProfile.user_id
  );
  const scoresB = scoresFromJson(
    candidateBProfile.dimension_scores_json,
    candidateBProfile.user_id
  );
  const boundaryA = floorFit(requesterScores.boundaryRespect, scoresA.boundaryRespect);
  const boundaryB = floorFit(requesterScores.boundaryRespect, scoresB.boundaryRespect);
  if (boundaryB !== boundaryA) {
    return boundaryB - boundaryA;
  }
  const confidenceA = candidateA.confidenceFit ?? 0;
  const confidenceB = candidateB.confidenceFit ?? 0;
  if (confidenceB !== confidenceA) {
    return confidenceB - confidenceA;
  }
  const updatedA = candidateAProfile.updated_at ?? candidateAProfile.completed_at;
  const updatedB = candidateBProfile.updated_at ?? candidateBProfile.completed_at;
  if (updatedB !== updatedA) {
    return updatedB - updatedA;
  }
  return candidateA.userId.localeCompare(candidateB.userId);
};
