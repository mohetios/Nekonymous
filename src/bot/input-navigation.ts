import { Keyboard, type Context } from "grammy";
import type { Environment } from "../types";
import { INPUT_CANCELLED_MESSAGE } from "../i18n/messages";
import { withHtml } from "../utils/tools";
import { clearDraft } from "../storage/user-state-client";
import { mainMenu } from "./keyboards";

export const DRAFT_CANCEL_LABEL = "↩️ لغو";

export const INPUT_PLACEHOLDERS = {
  compose: "پیامت را بنویس…",
  reply: "پاسخت را بنویس…",
  nickname: "نام خصوصی را وارد کن…",
  display_name: "نام نمایشی را وارد کن…",
  match_intro: "پیام شروع گفت‌وگو را بنویس…",
} as const;

export type InputPlaceholderKey = keyof typeof INPUT_PLACEHOLDERS;

export const draftPlaceholder = (mode: InputPlaceholderKey): string =>
  INPUT_PLACEHOLDERS[mode];

export const buildDraftCancelKeyboard = (
  placeholder?: string
): Keyboard => {
  const keyboard = new Keyboard()
    .text(DRAFT_CANCEL_LABEL)
    .resized()
    .oneTime();

  if (placeholder) {
    keyboard.placeholder(placeholder);
  }

  return keyboard;
};

export const restoreMainMenu = async (
  ctx: Context,
  text?: string
): Promise<void> => {
  await ctx.reply(text ?? INPUT_CANCELLED_MESSAGE, withHtml({ reply_markup: mainMenu }));
};

export const cancelActiveInput = async (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => {
  await clearDraft(env, userId);
  await restoreMainMenu(ctx);
};
