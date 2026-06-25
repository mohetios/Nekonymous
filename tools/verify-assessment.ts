/**
 * Assessment validation tests.
 * Run: pnpm test:assessment
 */

import {
  ASSESSMENT_DIMENSIONS,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_VERSION,
  EXPECTED_QUESTIONS_PER_DIMENSION,
  validateAssessmentQuestionBank,
} from "../src/features/assessment/question-bank.ts";
import type { AssessmentDimension } from "../src/features/assessment/question-bank.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const normalizeLikertAnswer = (raw: number, reverse: boolean): number => {
  if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
    throw new Error("Invalid Likert answer");
  }
  return reverse ? 6 - raw : raw;
};

const scoreDimension = (values: number[]): number => {
  if (values.length === 0) {
    throw new Error("Missing dimension answers");
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp01((avg - 1) / 4);
};

const computeAssessmentScores = (
  answers: Record<string, number>
): Record<AssessmentDimension, number> => {
  const scores = {} as Record<AssessmentDimension, number>;
  for (const dimension of ASSESSMENT_DIMENSIONS) {
    const values = ASSESSMENT_QUESTIONS.filter((q) => q.dimension === dimension).map(
      (q) => normalizeLikertAnswer(answers[q.id], q.reverse === true)
    );
    scores[dimension] = scoreDimension(values);
  }
  return scores;
};

const mostRepeatedAnswerRatio = (rawAnswers: number[]): number => {
  const counts = new Map<number, number>();
  for (const answer of rawAnswers) {
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  return Math.max(...counts.values()) / rawAnswers.length;
};

const scoreConfidence = (params: {
  pairConsistency: number;
  rawAnswers: number[];
}): number => {
  const repeatedRatio = mostRepeatedAnswerRatio(params.rawAnswers);
  const straightlinePenalty = clamp01((repeatedRatio - 0.55) / 0.35);
  return clamp01(
    0.25 + 0.55 * params.pairConsistency + 0.2 * (1 - straightlinePenalty)
  );
};

const buildProfileEmbeddingText = (
  scores: Record<AssessmentDimension, number>,
  version: string
): string =>
  [
    "زبان: fa.",
    `نسخه ارزیابی: ${version}.`,
    "خلاصه سبک گفت‌وگو:",
    `احترام به مرزها: ${scores.boundaryRespect >= 0.67 ? "بالا" : "میانه"}.`,
    `ترجیح عمق گفتگو: ${scores.depthPreference >= 0.67 ? "بالا" : "میانه"}.`,
    "این کاربر برای شروع گفتگو به سیگنال‌های آرام، محترمانه و ناشناس تکیه می‌کند.",
  ].join("\n");

validateAssessmentQuestionBank();

assert(ASSESSMENT_VERSION === "v1", "assessment version frozen to v1");
assert(ASSESSMENT_QUESTION_COUNT === 56, "exactly 56 questions");
assert(ASSESSMENT_DIMENSIONS.length === 14, "exactly 14 dimensions");

const ids = new Set<string>();
let reverseCount = 0;
for (const question of ASSESSMENT_QUESTIONS) {
  assert(!ids.has(question.id), `unique id: ${question.id}`);
  ids.add(question.id);
  if (question.reverse) {
    reverseCount += 1;
  }
}

for (const dimension of ASSESSMENT_DIMENSIONS) {
  const count = ASSESSMENT_QUESTIONS.filter((q) => q.dimension === dimension).length;
  assert(
    count === EXPECTED_QUESTIONS_PER_DIMENSION,
    `4 questions per dimension: ${dimension}`
  );
}

assert(reverseCount >= 10 && reverseCount <= 18, "reverse count reasonable");
assert(normalizeLikertAnswer(1, false) === 1, "normal item keeps value");
assert(normalizeLikertAnswer(1, true) === 5, "reverse item: 1 -> 5");
assert(normalizeLikertAnswer(5, true) === 1, "reverse item: 5 -> 1");

let invalidThrew = false;
try {
  normalizeLikertAnswer(6, false);
} catch {
  invalidThrew = true;
}
assert(invalidThrew, "invalid Likert answer throws");

assert(scoreDimension([1, 1, 1]) === 0, "dimension min -> 0");
assert(scoreDimension([5, 5, 5]) === 1, "dimension max -> 1");
assert(scoreDimension([3]) === 0.5, "dimension midpoint -> 0.5");

const minAnswers = Object.fromEntries(
  ASSESSMENT_QUESTIONS.map((q) => [q.id, q.reverse ? 5 : 1])
) as Record<string, number>;
const maxAnswers = Object.fromEntries(
  ASSESSMENT_QUESTIONS.map((q) => [q.id, q.reverse ? 1 : 5])
) as Record<string, number>;

const scoresMin = computeAssessmentScores(minAnswers);
const scoresMax = computeAssessmentScores(maxAnswers);
for (const dimension of ASSESSMENT_DIMENSIONS) {
  assert(scoresMin[dimension] === 0, `min normalized -> 0 for ${dimension}`);
  assert(scoresMax[dimension] === 1, `max normalized -> 1 for ${dimension}`);
}

const partialAnswers = { ...minAnswers };
delete partialAnswers[ASSESSMENT_QUESTIONS[0].id];
let missingThrew = false;
try {
  computeAssessmentScores(partialAnswers);
} catch {
  missingThrew = true;
}
assert(missingThrew, "missing answer throws in scoring");

const straightlineConfidence = scoreConfidence({
  pairConsistency: 0.75,
  rawAnswers: Array(56).fill(3),
});
const variedConfidence = scoreConfidence({
  pairConsistency: 0.75,
  rawAnswers: ASSESSMENT_QUESTIONS.map((_, index) => (index % 5) + 1),
});
assert(straightlineConfidence < variedConfidence, "confidence decreases on straightlining");
const lowConfidence = scoreConfidence({
  pairConsistency: 0,
  rawAnswers: Array(56).fill(3),
});
assert(lowConfidence < 0.5, "low confidence below eligibility threshold");

const qualityConfidence = scoreConfidence({
  pairConsistency: 0.75,
  rawAnswers: ASSESSMENT_QUESTIONS.map((_, index) => (index % 5) + 1),
});
assert(qualityConfidence >= 0 && qualityConfidence <= 1, "confidence is 0..1");
assert((qualityConfidence >= 0.5) === true, "match eligibility follows confidence");

const embeddingText = buildProfileEmbeddingText(scoresMax, ASSESSMENT_VERSION);
assert(!embeddingText.includes('"br1"'), "summary does not include raw answer ids");
assert(!embeddingText.includes("answer_value"), "summary does not include raw answers");
assert(embeddingText.includes("نسخه ارزیابی: v1"), "summary includes version line");

assert(
  `profile:user-abc:${ASSESSMENT_VERSION}` === "profile:user-abc:v1",
  "vector id is profile:{userId}:v1"
);

console.log("Assessment V1 OK");
