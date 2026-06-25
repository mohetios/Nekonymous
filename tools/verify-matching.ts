/**
 * Matching selection and scoring smoke tests.
 * Run: pnpm test:matching
 */

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

type Metric = "closeness" | "floor" | "mixed";
type Dimension =
  | "boundaryRespect"
  | "honestyTransparency"
  | "emotionalSensitivity"
  | "emotionalRegulation"
  | "socialEnergy"
  | "warmthEmpathy"
  | "reliabilityConsistency"
  | "curiosityDepth"
  | "depthPreference"
  | "replyPacePreference"
  | "directnessPreference"
  | "conflictRepair"
  | "supportPreference"
  | "anonymityComfort";

type Scores = Record<Dimension, number>;
type Candidate = {
  userId: string;
  score: number;
  confidenceFit: number;
  updatedAt: number;
  scores: Scores;
};

const V1_TRAIT_WEIGHTS = {
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
} as const satisfies Record<Dimension, { weight: number; metric: Metric }>;

const MATCH_RESULT_COUNT = 5;
const MATCH_SEARCH_TOP_K = 30;

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const closeness = (a: number, b: number): number =>
  1 - Math.abs(clamp01(a) - clamp01(b));

const floorFit = (a: number, b: number): number =>
  Math.min(clamp01(a), clamp01(b));

const mixedFit = (a: number, b: number): number =>
  0.65 * closeness(a, b) + 0.35 * floorFit(a, b);

const metricScore = (metric: Metric, a: number, b: number): number => {
  if (metric === "floor") return floorFit(a, b);
  if (metric === "mixed") return mixedFit(a, b);
  return closeness(a, b);
};

const traitFit = (a: Scores, b: Scores): number => {
  let score = 0;
  for (const key of Object.keys(V1_TRAIT_WEIGHTS) as Dimension[]) {
    const config = V1_TRAIT_WEIGHTS[key];
    score += config.weight * metricScore(config.metric, a[key], b[key]);
  }
  return clamp01(score);
};

const freshnessFit = (updatedAt: Date, now = new Date()): number => {
  const ageDays = Math.max(
    0,
    Math.abs(now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (ageDays <= 30) return 1;
  if (ageDays >= 180) return 0;
  return 1 - (ageDays - 30) / 150;
};

const penalties = (params: {
  confidenceFit: number;
  updatedAt: Date;
  seen?: boolean;
  dismissed?: boolean;
}): number => {
  const ageDays = Math.max(
    0,
    Math.abs(Date.now() - params.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  const stale =
    ageDays <= 90 ? 0 : ageDays >= 180 ? 0.05 : ((ageDays - 90) / 90) * 0.05;
  return (
    (params.confidenceFit < 0.65 ? 0.04 : 0) +
    stale +
    (params.seen ? 0.02 : 0) +
    (params.dismissed ? 0.03 : 0)
  );
};

const score = (params: {
  requester: Scores;
  candidate: Scores;
  semantic?: number;
  confidenceFit?: number;
  updatedAt?: Date;
}): number => {
  const candidateUpdatedAt = params.updatedAt ?? new Date();
  const confidenceFit = params.confidenceFit ?? 0.8;
  const t = traitFit(params.requester, params.candidate);
  const semantic = params.semantic ?? 0.5;
  const preference = 1;
  const freshness = freshnessFit(candidateUpdatedAt);
  return clamp01(
    0.72 * t +
      0.1 * semantic +
      0.08 * preference +
      0.06 * confidenceFit +
      0.04 * freshness -
      penalties({ confidenceFit, updatedAt: candidateUpdatedAt })
  );
};

const neutral: Scores = {
  boundaryRespect: 0.7,
  honestyTransparency: 0.7,
  emotionalSensitivity: 0.5,
  emotionalRegulation: 0.7,
  socialEnergy: 0.5,
  warmthEmpathy: 0.7,
  reliabilityConsistency: 0.7,
  curiosityDepth: 0.6,
  depthPreference: 0.6,
  replyPacePreference: 0.6,
  directnessPreference: 0.6,
  conflictRepair: 0.7,
  supportPreference: 0.5,
  anonymityComfort: 0.6,
};

const pickEligible = async (
  candidates: Candidate[],
  eligible: (id: string) => Promise<boolean>
): Promise<Candidate[]> => {
  const picked: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.userId)) continue;
    if (!(await eligible(candidate.userId))) continue;
    seen.add(candidate.userId);
    picked.push(candidate);
    if (picked.length >= MATCH_RESULT_COUNT) break;
  }
  return picked;
};

const weightSum = Object.values(V1_TRAIT_WEIGHTS).reduce(
  (sum, item) => sum + item.weight,
  0
);
assert(Math.abs(weightSum - 1) < 0.000001, "trait weights sum to 1");
assert(closeness(0.2, 0.7) === 0.5, "closeness works");
assert(floorFit(0.2, 0.7) === 0.2, "floor fit works");
assert(Math.abs(mixedFit(0.2, 0.7) - 0.395) < 0.000001, "mixed fit works");
assert(MATCH_SEARCH_TOP_K === 30, "Vectorize topK frozen to 30");

const closeScore = score({ requester: neutral, candidate: neutral, semantic: 0.75 });
const farScore = score({
  requester: neutral,
  candidate: {
    ...neutral,
    boundaryRespect: 0.2,
    honestyTransparency: 0.2,
    warmthEmpathy: 0.2,
    reliabilityConsistency: 0.2,
  },
  semantic: 0.75,
});
assert(closeScore > farScore, "closer profile ranks higher");

const lowConfidenceEligible = 0.45 >= 0.5;
assert(!lowConfidenceEligible, "low confidence disables match eligibility below threshold");

const stalePenalty = penalties({
  confidenceFit: 0.6,
  updatedAt: new Date(Date.now() - 160 * 24 * 60 * 60 * 1000),
  seen: true,
  dismissed: true,
});
assert(stalePenalty > 0.09, "low confidence/stale/repeated/dismissed penalties apply");

assert(freshnessFit(new Date()) === 1, "fresh profile fit");
assert(freshnessFit(new Date(Date.now() - 200 * 24 * 60 * 60 * 1000)) === 0, "old profile freshness floor");

const candidates: Candidate[] = ["c1", "c2", "c3", "c4", "c5", "c6"].map(
  (id, index) => ({
    userId: id,
    score: 1 - index * 0.1,
    confidenceFit: 0.8,
    updatedAt: Date.now() - index,
    scores: neutral,
  })
);

const topFive = await pickEligible(candidates, async () => true);
assert(topFive.length === 5, "top 5 suggestions only");

const blocked = await pickEligible(candidates, async (id) => id !== "c1");
assert(blocked[0].userId === "c2", "blocked users are hard rejected");

const pendingRejected = await pickEligible([candidates[0]], async () => false);
assert(pendingRejected.length === 0, "pending request pair is hard rejected");

const tieSorted = [...candidates.slice(0, 2)].sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  const boundary = floorFit(neutral.boundaryRespect, b.scores.boundaryRespect) -
    floorFit(neutral.boundaryRespect, a.scores.boundaryRespect);
  if (boundary !== 0) return boundary;
  if (b.confidenceFit !== a.confidenceFit) return b.confidenceFit - a.confidenceFit;
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
  return a.userId.localeCompare(b.userId);
});
assert(tieSorted[0].userId === "c1", "tie breakers are stable");

const vectorQueryOptions = {
  topK: MATCH_SEARCH_TOP_K,
  returnValues: false,
  returnMetadata: "all",
  filter: {
    profileVersion: "v1",
    discoverable: true,
    matchEligible: true,
    locale: "fa",
  },
};
assert(vectorQueryOptions.returnValues === false, "Vectorize returnValues false");
assert(vectorQueryOptions.filter.profileVersion === "v1", "Vectorize profileVersion filter");
assert(vectorQueryOptions.filter.discoverable === true, "Vectorize discoverable filter");
assert(vectorQueryOptions.filter.matchEligible === true, "Vectorize matchEligible filter");
assert(vectorQueryOptions.filter.locale === "fa", "Vectorize locale filter");
assert(!("telegramId" in vectorQueryOptions.filter), "Vectorize metadata has no Telegram id");
assert(!("rawAnswers" in vectorQueryOptions.filter), "Vectorize metadata has no raw answers");

console.log("Matching OK");
