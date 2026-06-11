import { Bot, type Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment, User } from "../types";
import { KVModel } from "../utils/kv-storage";
import {
  handleBlockAction,
  handleNicknameAction,
  handleReplyAction,
  handleUnblockAction,
} from "./actions";
import {
  handleInboxCommand,
  handleMessage,
  handleStartCommand,
} from "./commands";
import { handleSettingsCommand } from "./settings";

type BotConfig = NonNullable<ConstructorParameters<typeof Bot>[1]>;

const isCommandMessage = (message: Message): boolean =>
  message.text?.startsWith("/") === true ||
  message.entities?.some(
    (entity) => entity.type === "bot_command" && entity.offset === 0
  ) === true;

export const createBot = (env: Environment) => {
  const {
    SECRET_TELEGRAM_API_TOKEN,
    NekonymousKV,
    BOT_INFO,
    APP_SECURE_KEY,
    INBOX_DO,
  } = env;

  const bot = new Bot(SECRET_TELEGRAM_API_TOKEN, {
    botInfo: JSON.parse(BOT_INFO) as BotConfig["botInfo"],
  });

  const userModel = new KVModel<User>("user", NekonymousKV);
  const conversationModel = new KVModel<string>("conversation", NekonymousKV);
  const userUUIDtoId = new KVModel<string>("userUUIDtoId", NekonymousKV);
  const statsModel = new KVModel<number>("stats", NekonymousKV);

  bot.command("start", (ctx) =>
    handleStartCommand(ctx, userModel, userUUIDtoId, statsModel)
  );

  bot.command("inbox", (ctx) =>
    handleInboxCommand(
      ctx,
      userModel,
      conversationModel,
      INBOX_DO,
      APP_SECURE_KEY
    )
  );

  bot.command("settings", (ctx) =>
    handleSettingsCommand(ctx, {
      userModel,
      userUUIDtoId,
      statsModel,
      inbox: INBOX_DO,
    })
  );

  bot.on("message", (ctx) => {
    if (ctx.message && isCommandMessage(ctx.message)) {
      return;
    }

    return handleMessage(
      ctx,
      userModel,
      conversationModel,
      userUUIDtoId,
      INBOX_DO,
      statsModel,
      APP_SECURE_KEY
    );
  });

  const onInboxCallback =
    (
      handler: (
        ctx: Context,
        userModel: KVModel<User>,
        conversationModel: KVModel<string>,
        statsModel: KVModel<number>,
        inbox: Environment["INBOX_DO"],
        appSecureKey: string
      ) => Promise<void>
    ) =>
    (ctx: Context) =>
      handler(
        ctx,
        userModel,
        conversationModel,
        statsModel,
        INBOX_DO,
        APP_SECURE_KEY
      );

  bot.callbackQuery(/^rpl:([a-f0-9]{8})$/, onInboxCallback(handleReplyAction));
  bot.callbackQuery(/^blk:([a-f0-9]{8})$/, onInboxCallback(handleBlockAction));
  bot.callbackQuery(/^ubl:([a-f0-9]{8})$/, onInboxCallback(handleUnblockAction));
  bot.callbackQuery(/^nnk:([a-f0-9]{8})$/, onInboxCallback(handleNicknameAction));

  return bot;
};
