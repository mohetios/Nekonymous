import type { Environment } from "../types/runtime.env";
import {
  getProfileDashboardMeta,
  isProfileSearchReady,
  loadRequesterProfileContext,
} from "../profile/profile-service.ts";
import type { SuggestionHubMenuOptions } from "./suggestion-types.ts";
import { SUGGESTION_HUB_STATUS } from "../i18n/conversation-suggestions-ui.ts";
import { ASSESSMENT_BUTTON } from "../i18n/labels.ts";
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
    ? SUGGESTION_HUB_STATUS.assessmentInProgress
    : meta.hasProfile
      ? SUGGESTION_HUB_STATUS.assessmentCompleted
      : SUGGESTION_HUB_STATUS.assessmentNotStarted;

  let discoverabilityLine: string = SUGGESTION_HUB_STATUS.discoverabilityNeedsAssessment;
  let discoverabilityVariant: SuggestionHubMenuOptions["discoverabilityVariant"] =
    "default";

  if (meta.hasProfile) {
    if (meta.discoverable && isProfileSearchReady(profileContext)) {
      discoverabilityLine = SUGGESTION_HUB_STATUS.discoverabilityActive;
      discoverabilityVariant = "can_disable";
    } else if (isProfileSearchReady(profileContext)) {
      discoverabilityLine = SUGGESTION_HUB_STATUS.discoverabilityInactive;
      discoverabilityVariant = "can_enable";
    } else {
      discoverabilityLine = SUGGESTION_HUB_STATUS.discoverabilityInactive;
    }
  }

  let eligibilityLine: string = SUGGESTION_HUB_STATUS.searchNeedsAssessment;
  if (isProfileSearchReady(profileContext)) {
    eligibilityLine = SUGGESTION_HUB_STATUS.searchReady;
  } else if (profileContext.ok) {
    eligibilityLine =
      profileContext.vaultStatus === "index_failed"
        ? SUGGESTION_HUB_STATUS.searchUnavailable
        : SUGGESTION_HUB_STATUS.searchVectorPending;
  } else if (!profileContext.ok && profileContext.reason === "profile_failed") {
    eligibilityLine = SUGGESTION_HUB_STATUS.searchUnavailable;
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
    pendingLine: SUGGESTION_HUB_STATUS.pendingNone,
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
