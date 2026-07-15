import type { Environment } from "../../../contracts/runtime";
import {
  getProfileDashboardMeta,
  isProfileSearchReady,
  loadRequesterProfileContext,
} from "../profile/profile-service.ts";
import type { SuggestionHubMenuOptions } from "./types.ts";
import { MATCH_HUB_STATUS } from "../../../i18n/matching.ts";
import { ASSESSMENT_BUTTON } from "../../../i18n/labels.ts";
import { buildProfileHubSummaryHtml } from "../profile/profile-summary.ts";

export type SuggestionHubView = {
  assessmentLine: string;
  discoverabilityLine: string;
  pendingLine: string;
  eligibilityLine: string;
  profileSummaryHtml: string | null;
  keyboard: SuggestionHubMenuOptions & { showPending: boolean };
};

export const buildSuggestionHubView = async (
  env: Environment,
  userId: string
): Promise<SuggestionHubView> => {
  const [meta, profileContext] = await Promise.all([
    getProfileDashboardMeta(env, userId),
    loadRequesterProfileContext(env, userId),
  ]);

  const assessmentLine = meta.hasActiveSession
    ? MATCH_HUB_STATUS.assessmentInProgress
    : meta.hasProfile
      ? MATCH_HUB_STATUS.assessmentCompleted
      : MATCH_HUB_STATUS.assessmentNotStarted;

  let discoverabilityLine: string = MATCH_HUB_STATUS.discoverabilityNeedsAssessment;
  let discoverabilityVariant: SuggestionHubMenuOptions["discoverabilityVariant"] =
    "default";

  if (meta.hasProfile) {
    if (meta.discoverable && isProfileSearchReady(profileContext)) {
      discoverabilityLine = MATCH_HUB_STATUS.discoverabilityActive;
      discoverabilityVariant = "can_disable";
    } else if (isProfileSearchReady(profileContext)) {
      discoverabilityLine = MATCH_HUB_STATUS.discoverabilityInactive;
      discoverabilityVariant = "can_enable";
    } else {
      discoverabilityLine = MATCH_HUB_STATUS.discoverabilityInactive;
    }
  }

  let eligibilityLine: string = MATCH_HUB_STATUS.searchNeedsAssessment;
  if (isProfileSearchReady(profileContext)) {
    eligibilityLine = MATCH_HUB_STATUS.searchReady;
  } else if (profileContext.ok) {
    eligibilityLine =
      profileContext.vaultStatus === "index_failed"
        ? MATCH_HUB_STATUS.searchUnavailable
        : MATCH_HUB_STATUS.searchVectorPending;
  } else if (!profileContext.ok && profileContext.reason === "profile_failed") {
    eligibilityLine = MATCH_HUB_STATUS.searchUnavailable;
  }

  const showFind = isProfileSearchReady(profileContext);
  const assessmentLabel = meta.hasActiveSession
    ? ASSESSMENT_BUTTON.continue
    : meta.hasProfile
      ? ASSESSMENT_BUTTON.restart
      : ASSESSMENT_BUTTON.start;

  return {
    assessmentLine,
    discoverabilityLine,
    pendingLine: MATCH_HUB_STATUS.pendingNone,
    eligibilityLine,
    profileSummaryHtml: profileContext.ok
      ? buildProfileHubSummaryHtml(profileContext.profile, "fa")
      : null,
    keyboard: {
      assessmentLabel,
      showFind,
      showPending: false,
      discoverabilityVariant,
    },
  };
};
