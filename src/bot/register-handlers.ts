import type { Bot, Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment } from "../types";
import { UNKNOWN_COMMAND_MESSAGE } from "../i18n/messages";
import { mainMenu } from "./keyboards";
import {
  handleBlockAction,
  handleNicknameAction,
  handleOpenTicketAction,
  handleReportAction,
  handleReplyAction,
  handleUnblockAction,
} from "../features/messaging/messaging-actions";
import {
  handleInboxCommand,
  handleMessage,
  handleStartCommand,
} from "../features/messaging/messaging-commands";
import { handleSettingsCommand, handleSettingsCallback } from "../features/settings/settings-handlers";
import {
  handleAssessmentCallback,
  handleAssessmentCommand,
} from "../features/assessment/assessment-handlers";
import {
  handleMatchCallback,
  handleMatchCommand,
} from "../features/matching/match-handlers";
import {
  handleMatchSystemCallback,
  handleMatchSystemCommand,
} from "../features/matching/match-system-handlers";
import { isBotCommand } from "./commands";
import {
  INBOX_MENU_CALLBACK,
  inboxCallbackQueryRegex,
} from "../utils/telegram-callbacks";

const isCommandMessage = (message: Message): boolean =>
  message.text?.startsWith("/") === true ||
  message.entities?.some(
    (entity) => entity.type === "bot_command" && entity.offset === 0
  ) === true;

const unknownCommandName = (text: string): string | null => {
  if (!text.startsWith("/")) {
    return null;
  }
  const token = text.split(/\s/)[0]?.slice(1);
  if (!token) {
    return null;
  }
  return token.split("@")[0]?.toLowerCase() ?? null;
};

export const registerHandlers = (bot: Bot, env: Environment): void => {
  const { BOT_USERNAME } = env;

  bot.command("start", (ctx) => handleStartCommand(ctx, env, BOT_USERNAME));

  bot.command("inbox", (ctx) => handleInboxCommand(ctx, env));

  bot.command("settings", (ctx) => handleSettingsCommand(ctx, env));

  bot.command("assessment", (ctx) => handleAssessmentCommand(ctx, env));

  bot.command("match", (ctx) => handleMatchCommand(ctx, env));

  bot.command("match_system", (ctx) => handleMatchSystemCommand(ctx, env));

  bot.on("message", (ctx) => {
    if (ctx.message && isCommandMessage(ctx.message)) {
      return;
    }

    return handleMessage(ctx, env, BOT_USERNAME);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message?.text;
    if (!text) {
      return;
    }

    const command = unknownCommandName(text);
    if (!command || isBotCommand(command)) {
      return;
    }

    await ctx.reply(UNKNOWN_COMMAND_MESSAGE, { reply_markup: mainMenu });
  });

  const onInboxCallback =
    (handler: (ctx: Context, env: Environment) => Promise<void>) =>
    (ctx: Context) =>
      handler(ctx, env);

  bot.callbackQuery(inboxCallbackQueryRegex("open"), onInboxCallback(handleOpenTicketAction));
  bot.callbackQuery(inboxCallbackQueryRegex("reply"), onInboxCallback(handleReplyAction));
  bot.callbackQuery(inboxCallbackQueryRegex("block"), onInboxCallback(handleBlockAction));
  bot.callbackQuery(inboxCallbackQueryRegex("unblock"), onInboxCallback(handleUnblockAction));
  bot.callbackQuery(inboxCallbackQueryRegex("nickname"), onInboxCallback(handleNicknameAction));
  bot.callbackQuery(inboxCallbackQueryRegex("report"), onInboxCallback(handleReportAction));

  bot.callbackQuery(INBOX_MENU_CALLBACK.open, async (ctx) => {
    try {
      await handleInboxCommand(ctx, env);
    } finally {
      await ctx.answerCallbackQuery();
    }
  });

  bot.callbackQuery(/^t:/, (ctx) => handleAssessmentCallback(ctx, env));

  bot.callbackQuery(/^m:/, (ctx) => handleMatchCallback(ctx, env));

  bot.callbackQuery(/^ms:/, (ctx) => handleMatchSystemCallback(ctx, env));

  bot.callbackQuery(/^s:/, (ctx) =>
    handleSettingsCallback(ctx, env, BOT_USERNAME)
  );
};
