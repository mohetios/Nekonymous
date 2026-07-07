import type { Context } from "grammy";
import type { Environment } from "../../types";
import { logBotError } from "../../utils/logs";
import { HuhMessage } from "../../i18n/messages";
import { SETTINGS_BACK_MESSAGE } from "../../i18n/settings";
import {
  buildMatchProfileEmptyMenu,
  buildMatchSystemMenu,
  mainMenu,
} from "../../bot/keyboards";
import { MENU } from "../../bot/menu";
import { withHtml } from "../../utils/tools";
import { resolveOrCreateUser } from "../identity/identity-service";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS } from "../../stats/events";
import { getLatestAssessmentProfile } from "../assessment/assessment-profile-service";
import {
  MATCH_DISABLED,
  MATCH_ENABLED,
  MATCH_OPT_IN,
  MATCH_SYSTEM_INTRO,
} from "../../i18n/matching";
import { formatMatchProfileMessage } from "./match-profile-view";
import {
  disableDiscoverability,
  enableDiscoverability,
  expireOldMatchRequests,
  resolveMatchHubMenuOptions,
} from "./match-service";
import { sendAssessmentDashboard } from "../assessment/assessment-handlers";
import { sendMatchDashboard, sendPendingMatchRequests } from "./match-handlers";
import { ASSESSMENT_BUTTON } from "../../i18n/labels";

const matchHubReplyMenu = async (userId: string, env: Environment) => {
  const options = await resolveMatchHubMenuOptions(userId, env);
  return buildMatchSystemMenu(options);
};

const applyDiscoverabilityEnable = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const result = await enableDiscoverability(userId, env);
  const hubMenu = await matchHubReplyMenu(userId, env);
  if (!result.ok) {
    await ctx.reply(MATCH_OPT_IN, { reply_markup: hubMenu });
    return;
  }

  await emitStat(env, STAT_EVENTS.DISCOVERABILITY_ENABLED);
  await ctx.reply(MATCH_ENABLED, { reply_markup: hubMenu });
};

const applyDiscoverabilityDisable = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  await disableDiscoverability(userId, env);
  await emitStat(env, STAT_EVENTS.DISCOVERABILITY_DISABLED);
  await ctx.reply(MATCH_DISABLED, {
    reply_markup: await matchHubReplyMenu(userId, env),
  });
};

export const sendMatchSystemHub = async (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => {
  const replyMenu = await matchHubReplyMenu(userId, env);
  await ctx.reply(MATCH_SYSTEM_INTRO, withHtml({ reply_markup: replyMenu }));
};

const sendMatchHubIntro = (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => sendMatchSystemHub(ctx, env, userId);

export const sendMatchProfileScreen = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const profile = await getLatestAssessmentProfile(userId, env);
  const { text, hasProfile } = formatMatchProfileMessage(profile);
  const replyMenu = hasProfile
    ? await matchHubReplyMenu(userId, env)
    : buildMatchProfileEmptyMenu();

  await ctx.reply(text, withHtml({ reply_markup: replyMenu }));
};

const isAssessmentMenuLabel = (text: string): boolean =>
  text === MENU.matchAssessment ||
  text === MENU.matchAssessmentRetry ||
  text === ASSESSMENT_BUTTON.continue;

const MATCH_SYSTEM_MENU_LABELS = new Set<string>([
  MENU.matchSystem,
  MENU.matchProfile,
  MENU.matchFind,
  MENU.matchPending,
  MENU.matchEnable,
  MENU.matchDisable,
  MENU.matchAssessment,
  MENU.matchAssessmentRetry,
  ASSESSMENT_BUTTON.continue,
  MENU.hubBack,
  MENU.home,
]);

export const handleMatchSystemCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    await sendMatchSystemHub(ctx, env, d1User.id);
  } catch (error) {
    logBotError("handleMatchSystemCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleMatchSystemMenu = async (
  ctx: Context,
  env: Environment
): Promise<boolean> => {
  const text = ctx.message?.text;
  if (!text || !MATCH_SYSTEM_MENU_LABELS.has(text)) {
    return false;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const userId = d1User.id;
    const hubMenu = await matchHubReplyMenu(userId, env);

    switch (text) {
      case MENU.matchSystem:
        await sendMatchHubIntro(ctx, env, userId);
        return true;

      case MENU.hubBack:
        await sendMatchHubIntro(ctx, env, userId);
        return true;

      case MENU.home:
        await ctx.reply(SETTINGS_BACK_MESSAGE, withHtml({ reply_markup: mainMenu }));
        return true;

      case MENU.matchProfile:
        await sendMatchProfileScreen(ctx, userId, env);
        return true;

      case MENU.matchFind: {
        const options = await resolveMatchHubMenuOptions(userId, env);
        if (!options.showFind) {
          await ctx.reply(
            "برای پیدا کردن گزینه‌ها، اول ارزیابی سبک گفت‌وگو را کامل کن.",
            withHtml({ reply_markup: hubMenu })
          );
          return true;
        }
        await expireOldMatchRequests(env);
        await sendMatchDashboard(ctx, userId, env);
        return true;
      }

      case MENU.matchPending:
        await sendPendingMatchRequests(ctx, userId, env);
        return true;

      case MENU.matchEnable:
        await applyDiscoverabilityEnable(ctx, userId, env);
        return true;

      case MENU.matchDisable:
        await applyDiscoverabilityDisable(ctx, userId, env);
        return true;

      case MENU.matchAssessment:
      case MENU.matchAssessmentRetry:
        if (isAssessmentMenuLabel(text)) {
          await sendAssessmentDashboard(ctx, userId, env);
          return true;
        }
        return false;

      default:
        if (text === ASSESSMENT_BUTTON.continue) {
          await sendAssessmentDashboard(ctx, userId, env);
          return true;
        }
        return false;
    }
  } catch (error) {
    logBotError("handleMatchSystemMenu", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    return true;
  }
};
