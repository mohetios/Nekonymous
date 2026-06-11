import { InlineKeyboard, Keyboard, type Context } from "grammy";
import { ABOUT_PRIVACY_COMMAND_MESSAGE, USER_LINK_MESSAGE } from "./messages";
import { assertCallbackData } from "./telegram-limits";
import { escapeMarkdownV2 } from "./tools";

const INBOX_CALLBACK = {
  reply: (ref: string) => `rpl:${ref}`,
  block: (ref: string) => `blk:${ref}`,
  unblock: (ref: string) => `ubl:${ref}`,
  nickname: (ref: string) => `nnk:${ref}`,
} as const;

// Main menu keyboard used across various commands
export const mainMenu = new Keyboard()
  .text("درباره و حریم خصوصی")
  .text("دریافت لینک")
  .resized();

export const handleMenuCommand = async (
  ctx: Context,
  userUUID: string
): Promise<boolean> => {
  const msgPayload = ctx.message?.text;

  switch (msgPayload) {
    case "دریافت لینک":
      await ctx.reply(
        USER_LINK_MESSAGE.replace(
          "UUID_USER_URL",
          `https://t.me/nekonymous_bot?start=${userUUID}`
        ),
        {
          reply_markup: mainMenu,
        }
      );
      break;
    case "درباره و حریم خصوصی":
      await ctx.reply(escapeMarkdownV2(ABOUT_PRIVACY_COMMAND_MESSAGE), {
        reply_markup: mainMenu,
        parse_mode: "MarkdownV2",
      });
      break;
    default:
      return false;
  }

  return true;
};

export const createMessageKeyboard = (
  inboxRef: string,
  isBlocked: boolean
): InlineKeyboard => {
  const blockData = isBlocked
    ? INBOX_CALLBACK.unblock(inboxRef)
    : INBOX_CALLBACK.block(inboxRef);
  const replyData = INBOX_CALLBACK.reply(inboxRef);
  const nicknameData = INBOX_CALLBACK.nickname(inboxRef);

  assertCallbackData(blockData);
  assertCallbackData(replyData);
  assertCallbackData(nicknameData);

  return new InlineKeyboard()
    .text(isBlocked ? "آنبلاک" : "بلاک", blockData)
    .text("پاسخ", replyData)
    .row()
    .text("نام مستعار", nicknameData);
};
