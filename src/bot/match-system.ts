import type { Context } from "grammy";
import type { Environment } from "../types";
import { logBotError } from "../utils/logs";
import { HuhMessage } from "../utils/messages";
import {
  buildMatchProfileEmptyMenu,
  buildMatchProfileReadyMenu,
  buildMatchSystemMenu,
  mainMenu,
  MENU,
} from "../utils/constant";
import { withHtml } from "../utils/tools";
import { resolveOrCreateUser } from "../services/identity-service";
import { getLatestTestProfile } from "../features/test/test-profile-service";
import { MATCH_SYSTEM_CALLBACK, MATCH_SYSTEM_INTRO } from "../features/matching/match-system-callbacks";
import { MATCH_DISABLED, MATCH_ENABLED } from "../features/matching/match-copy";
import { formatMatchProfileMessage } from "../features/matching/match-profile-view";
import {
  disableDiscoverability,
  enableDiscoverability,
  expireOldMatchRequests,
  resolveMatchHubMenuVariant,
} from "../features/matching/match-service";
import { sendTestDashboard } from "./test";
import { sendMatchDashboard, sendPendingMatchRequests } from "./match";

const MATCH_SYSTEM_MENU_LABELS = new Set<string>([
  MENU.matchSystem,
  MENU.matchProfile,
  MENU.matchFind,
  MENU.matchPending,
  MENU.matchEnable,
  MENU.matchDisable,
  MENU.matchTest,
  MENU.matchRetest,
  MENU.matchBackToHub,
]);

export const sendMatchSystemHub = async (
  ctx: Context,
  env: Environment,
  userId?: string
): Promise<void> => {
  const variant =
    userId !== undefined
      ? await resolveMatchHubMenuVariant(userId, env)
      : "default";

  await ctx.reply(
    MATCH_SYSTEM_INTRO,
    withHtml({ reply_markup: buildMatchSystemMenu(variant) })
  );
};

export const sendMatchProfileScreen = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const profile = await getLatestTestProfile(userId, env);
  const { text, hasProfile } = formatMatchProfileMessage(profile);
  const keyboard = hasProfile
    ? buildMatchProfileReadyMenu()
    : buildMatchProfileEmptyMenu();

  await ctx.reply(text, withHtml({ reply_markup: keyboard }));
};

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

    switch (text) {
      case MENU.matchSystem:
      case MENU.matchBackToHub:
        await sendMatchSystemHub(ctx, env, userId);
        return true;

      case MENU.matchProfile:
        await sendMatchProfileScreen(ctx, userId, env);
        return true;

      case MENU.matchFind:
        await expireOldMatchRequests(env);
        await sendMatchDashboard(ctx, userId, env);
        return true;

      case MENU.matchPending:
        await sendPendingMatchRequests(ctx, userId, env);
        return true;

      case MENU.matchEnable: {
        const result = await enableDiscoverability(userId, env);
        if (!result.ok) {
          await sendMatchDashboard(ctx, userId, env);
          return true;
        }
        const variant = await resolveMatchHubMenuVariant(userId, env);
        await ctx.reply(MATCH_ENABLED, {
          reply_markup: buildMatchSystemMenu(variant),
        });
        return true;
      }

      case MENU.matchDisable: {
        await disableDiscoverability(userId, env);
        const variant = await resolveMatchHubMenuVariant(userId, env);
        await ctx.reply(MATCH_DISABLED, {
          reply_markup: buildMatchSystemMenu(variant),
        });
        return true;
      }

      case MENU.matchTest:
      case MENU.matchRetest:
        await sendTestDashboard(ctx, userId, env);
        return true;

      default:
        return false;
    }
  } catch (error) {
    logBotError("handleMatchSystemMenu", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    return true;
  }
};

/** Legacy inline `ms:` callbacks on older messages. */
export const handleMatchSystemCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const userId = d1User.id;

    await ctx.answerCallbackQuery();

    if (ctx.callbackQuery.message) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    }

    switch (data) {
      case MATCH_SYSTEM_CALLBACK.hub:
      case MATCH_SYSTEM_CALLBACK.back:
        await sendMatchSystemHub(ctx, env, userId);
        return;

      case MATCH_SYSTEM_CALLBACK.profile:
        await sendMatchProfileScreen(ctx, userId, env);
        return;

      case MATCH_SYSTEM_CALLBACK.find:
        await expireOldMatchRequests(env);
        await sendMatchDashboard(ctx, userId, env);
        return;

      case MATCH_SYSTEM_CALLBACK.test:
        await sendTestDashboard(ctx, userId, env);
        return;

      default:
        await sendMatchSystemHub(ctx, env, userId);
    }
  } catch (error) {
    logBotError("handleMatchSystemCallback", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
