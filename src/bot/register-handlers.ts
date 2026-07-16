import type { Bot, Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment } from "../types/runtime.env";
import { EXPIRED_CALLBACK_MESSAGE, UNKNOWN_COMMAND_MESSAGE } from "../i18n/messages";
import { mainMenu } from "./keyboards";
import {
  handleBlockAction,
  handleNicknameAction,
  handleReportAction,
  handleReplyAction,
  handleUnblockAction,
} from "../ticketing/actions";
import {
  handleInboxCommand,
  handleMessage,
  handleStartCommand,
} from "../ticketing/handlers";
import {
  handleInboxDeliverCallback,
} from "../ticketing/inbox";
import { handleSettingsCommand, handleSettingsCallback } from "../settings/settings-handlers";
import {
  handleAssessmentCallback,
  handleAssessmentCommand,
} from "../profile/profile-handlers";
import {
  handleMatchCallback,
  handleMatchCommand,
  handleSuggestionCallback,
} from "../suggestions/suggestion-handlers";
import { handleRequestCallback } from "../suggestions/request-handlers";
import {
  requestCallbackQueryRegex,
  suggestionCallbackQueryRegex,
  suggestionHubCallbackQueryRegex,
} from "../suggestions/suggestion-constants";
import { isBotCommand } from "./commands";
import {
  INBOX_MENU_CALLBACK,
  inboxCallbackQueryRegex,
} from "../bot/callback-data";
import { answerCallbackSafely } from "./context";

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

const isRegisteredBotCommand = (command: string): boolean => isBotCommand(command);

export const registerHandlers = (bot: Bot, env: Environment): void => {
  const { BOT_USERNAME } = env;

  bot.command("start", (ctx) => handleStartCommand(ctx, env, BOT_USERNAME));

  bot.command("inbox", (ctx) => handleInboxCommand(ctx, env));

  bot.command("settings", (ctx) => handleSettingsCommand(ctx, env));

  bot.command("assessment", (ctx) => handleAssessmentCommand(ctx, env));

  bot.command("match", (ctx) => handleMatchCommand(ctx, env));

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
    if (!command || isRegisteredBotCommand(command)) {
      return;
    }

    await ctx.reply(UNKNOWN_COMMAND_MESSAGE, { reply_markup: mainMenu });
  });

  const onInboxCallback =
    (handler: (ctx: Context, env: Environment) => Promise<void>) =>
    (ctx: Context) =>
      handler(ctx, env);

  bot.callbackQuery(inboxCallbackQueryRegex("reply"), onInboxCallback(handleReplyAction));
  bot.callbackQuery(inboxCallbackQueryRegex("block"), onInboxCallback(handleBlockAction));
  bot.callbackQuery(inboxCallbackQueryRegex("unblock"), onInboxCallback(handleUnblockAction));
  bot.callbackQuery(inboxCallbackQueryRegex("nickname"), onInboxCallback(handleNicknameAction));
  bot.callbackQuery(inboxCallbackQueryRegex("report"), onInboxCallback(handleReportAction));

  bot.callbackQuery(INBOX_MENU_CALLBACK.deliver, onInboxCallback(handleInboxDeliverCallback));

  bot.callbackQuery(/^t:/, (ctx) => handleAssessmentCallback(ctx, env));

  bot.callbackQuery(suggestionHubCallbackQueryRegex(), (ctx) => handleMatchCallback(ctx, env));

  bot.callbackQuery(suggestionCallbackQueryRegex(), (ctx) =>
    handleSuggestionCallback(ctx, env)
  );

  bot.callbackQuery(requestCallbackQueryRegex(), (ctx) =>
    handleRequestCallback(ctx, env)
  );

  bot.callbackQuery(/^st:/, (ctx) =>
    handleSettingsCallback(ctx, env, BOT_USERNAME)
  );

  bot.callbackQuery(/.+/, async (ctx) => {
    await answerCallbackSafely(ctx);
    await ctx.reply(EXPIRED_CALLBACK_MESSAGE, { reply_markup: mainMenu });
  });
};
