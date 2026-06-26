import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { parseResultSummary, profileScoresFromRow } from "../assessment/assessment-profile-service";
import { ASSESSMENT_DIMENSION_LABELS } from "../assessment/question-bank";
import type { AssessmentDimension, AssessmentScores } from "../assessment/scoring";
import { convertToPersianNumbers, escapeHtml } from "../../utils/tools";
import {
  MATCH_PROFILE_DISCOVERABLE_ACTIVE,
  MATCH_PROFILE_DISCOVERABLE_INACTIVE,
  MATCH_PROFILE_HEADER,
  MATCH_PROFILE_LABEL_DISCOVERABLE,
  MATCH_PROFILE_LABEL_PREFERENCES,
  MATCH_PROFILE_LABEL_READY,
  MATCH_PROFILE_LABEL_SCORES,
  MATCH_PROFILE_LABEL_STATUS,
  MATCH_PROFILE_LABEL_SUMMARY,
  MATCH_PROFILE_LABEL_VERSION,
  MATCH_PROFILE_NO_ASSESSMENT,
  MATCH_PROFILE_PRIVACY_NOTE,
  MATCH_PROFILE_READY_LIMITED,
  MATCH_PROFILE_READY_NEEDS_OPT_IN,
  MATCH_PROFILE_READY_NO,
  MATCH_PROFILE_READY_PENDING,
  MATCH_PROFILE_READY_YES,
  MATCH_PROFILE_STATUS_COMPLETED,
  MATCH_PROFILE_STATUS_INCOMPLETE,
  MATCH_PROFILE_VECTOR_PENDING,
} from "../../i18n/matching";

const PREFERENCE_DIMENSIONS: AssessmentDimension[] = [
  "depthPreference",
  "replyPacePreference",
  "directnessPreference",
  "conflictRepair",
  "supportPreference",
  "anonymityComfort",
];

const pct = (value: number): string =>
  convertToPersianNumbers(`${Math.round(value)}٪`);

const formatScoreBlock = (
  scores: AssessmentScores,
  keys: AssessmentDimension[]
): string =>
  keys
    .map((key) => `${ASSESSMENT_DIMENSION_LABELS[key]}: ${pct(scores[key])}`)
    .join("\n");

const discoverableLabel = (profile: AssessmentProfileRow): string => {
  if (profile.discoverable === 1) {
    return MATCH_PROFILE_DISCOVERABLE_ACTIVE;
  }
  return MATCH_PROFILE_DISCOVERABLE_INACTIVE;
};

const readyForMatchingLabel = (profile: AssessmentProfileRow): string => {
  if (profile.status !== "completed") {
    return MATCH_PROFILE_READY_NO;
  }
  if (profile.vector_status !== "indexed") {
    return MATCH_PROFILE_READY_PENDING;
  }
  if (profile.discoverable !== 1) {
    return MATCH_PROFILE_READY_NEEDS_OPT_IN;
  }
  if (profile.safety_tier !== "normal") {
    return MATCH_PROFILE_READY_LIMITED;
  }
  return MATCH_PROFILE_READY_YES;
};

const completedStatusLabel = (profile: AssessmentProfileRow): string => {
  if (profile.status === "completed") {
    return MATCH_PROFILE_STATUS_COMPLETED;
  }
  return MATCH_PROFILE_STATUS_INCOMPLETE;
};

export const formatMatchProfileMessage = (
  profile: AssessmentProfileRow | null
): { text: string; hasProfile: boolean } => {
  if (!profile || profile.status !== "completed") {
    return {
      text: MATCH_PROFILE_NO_ASSESSMENT,
      hasProfile: false,
    };
  }

  const summary = parseResultSummary(profile);
  const scores = profileScoresFromRow(profile);

  const coreKeys: AssessmentDimension[] = [
    "boundaryRespect",
    "honestyTransparency",
    "emotionalSensitivity",
    "emotionalRegulation",
    "socialEnergy",
    "warmthEmpathy",
    "reliabilityConsistency",
    "curiosityDepth",
  ];

  let text =
    `${MATCH_PROFILE_HEADER}\n\n` +
    `${MATCH_PROFILE_LABEL_VERSION}: ${escapeHtml(convertToPersianNumbers(profile.version))}\n` +
    `${MATCH_PROFILE_LABEL_STATUS}: ${escapeHtml(completedStatusLabel(profile))}\n` +
    `${MATCH_PROFILE_LABEL_READY}: ${escapeHtml(readyForMatchingLabel(profile))}\n` +
    `${MATCH_PROFILE_LABEL_DISCOVERABLE}: ${escapeHtml(discoverableLabel(profile))}\n\n` +
    `<b>${MATCH_PROFILE_LABEL_SUMMARY}:</b>\n${escapeHtml(summary.title)}\n\n` +
    `${escapeHtml(summary.shortDescription)}\n\n` +
    `<b>${MATCH_PROFILE_LABEL_SCORES}:</b>\n${escapeHtml(formatScoreBlock(scores, coreKeys))}\n\n` +
    `<b>${MATCH_PROFILE_LABEL_PREFERENCES}:</b>\n${escapeHtml(formatScoreBlock(scores, PREFERENCE_DIMENSIONS))}\n\n` +
    `<i>${escapeHtml(MATCH_PROFILE_PRIVACY_NOTE)}</i>`;

  if (
    profile.vector_status === "failed" ||
    profile.vector_status === "not_indexed"
  ) {
    text += `\n\n<i>${escapeHtml(MATCH_PROFILE_VECTOR_PENDING)}</i>`;
  }

  return { text, hasProfile: true };
};
