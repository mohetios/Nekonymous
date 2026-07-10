import type { Context } from "grammy";
import type { Environment } from "../../types";
import { renderScreen } from "../../bot/render-screen";
import { ASSESSMENT_BUTTON } from "../../i18n/labels";
import { MENU } from "../../bot/menu";
import { formatSuggestionHubMessage } from "../../i18n/matching";
import { getAssessmentSession } from "../../storage/user-state-client";
import { getLatestAssessmentProfile } from "../assessment/assessment-profile-service";
import {
  expireOldMatchRequests,
  getMatchDashboard,
  resolveMatchHubMenuOptions,
} from "./match-service";
import { listPendingMatchRequests } from "./match-request-service";
import { buildSuggestionHubKeyboard } from "./keyboards";
import { convertToPersianNumbers } from "../../utils/tools";

const assessmentStatusLine = (
  hasProfile: boolean,
  hasSession: boolean
): string => {
  if (hasSession) {
    return "ارزیابی: در حال انجام";
  }
  if (hasProfile) {
    return "ارزیابی: تکمیل‌شده";
  }
  return "ارزیابی: هنوز شروع نشده";
};

const discoverabilityStatusLine = (
  discoverable: boolean,
  hasProfile: boolean
): string => {
  if (!hasProfile) {
    return "نمایش در پیشنهادها: نیاز به ارزیابی کامل";
  }
  return discoverable
    ? "نمایش در پیشنهادها: فعال"
    : "نمایش در پیشنهادها: غیرفعال";
};

const eligibilityLineForDashboard = (
  state: Awaited<ReturnType<typeof getMatchDashboard>>["state"]
): string => {
  switch (state) {
    case "no_profile":
      return "جست‌وجو: بعد از تکمیل ارزیابی فعال می‌شود.";
    case "vector_pending":
      return "جست‌وجو: پروفایل در حال آماده‌سازی است.";
    case "vector_failed":
      return "جست‌وجو: فعلاً در دسترس نیست.";
    case "opt_in_required":
      return "جست‌وجو: نمایش در پیشنهادها را فعال کن.";
    case "ready":
      return "جست‌وجو: آماده";
  }
};

export const renderSuggestionHub = async (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => {
  await expireOldMatchRequests(env);

  const [session, profile, dashboard, menuOptions, pending] = await Promise.all([
    getAssessmentSession(userId, env),
    getLatestAssessmentProfile(userId, env),
    getMatchDashboard(userId, env),
    resolveMatchHubMenuOptions(userId, env),
    listPendingMatchRequests(userId, env),
  ]);

  const matchProfile = profile;
  const pendingCount = pending.incoming.length + pending.outgoing.length;

  const text = formatSuggestionHubMessage({
    assessmentLine: assessmentStatusLine(!!profile, !!session),
    discoverabilityLine: discoverabilityStatusLine(
      dashboard.discoverable,
      profile?.status === "completed"
    ),
    pendingLine:
      pendingCount > 0
        ? `درخواست‌های باز: ${convertToPersianNumbers(String(pendingCount))}`
        : "درخواست‌های باز: نداری",
    eligibilityLine: eligibilityLineForDashboard(dashboard.state),
  });

  const keyboard = buildSuggestionHubKeyboard({
    ...menuOptions,
    showPending: pendingCount > 0,
    assessmentLabel: session
      ? ASSESSMENT_BUTTON.continue
      : matchProfile?.status === "completed"
        ? MENU.matchAssessmentRetry
        : MENU.matchAssessment,
  });

  await renderScreen(ctx, { text, replyMarkup: keyboard });
};
