import { InlineKeyboard, Keyboard, type Context } from "grammy";
import type { BotUser } from "../types";
import type { MatchHubMenuVariant } from "../features/matching/match-types";
import {
  OWNER_PAUSED_NOTE,
  USER_LINK_MESSAGE,
} from "./messages";
import { assertCallbackData } from "./telegram-limits";
import { withHtml } from "./tools";
import { buildUserDeepLink } from "./user";

export const MENU = {
  about: "🛡️ درباره و حریم خصوصی",
  privacy: "🔒 حریم خصوصی",
  link: "🔗 لینک من",
  matchSystem: "🧭 مچ‌یابی",
  matchProfile: "👤 پروفایل من",
  matchFind: "🔎 پیدا کردن مچ",
  matchPending: "📥 درخواست‌های در انتظار",
  matchEnable: "✅ فعال کردن مچ‌یابی",
  matchDisable: "⏸️ توقف مچ‌یابی",
  matchTest: "📝 اجرای تست",
  matchRetest: "📝 اجرای دوباره تست",
  matchBackToHub: "↩️ مچ‌یابی",
  settings: "⚙️ تنظیمات",
  editName: "✏️ نام نمایشی",
  cancelDraft: "↩️ لغو پیام ناتمام",
  pauseInbox: "🔕 توقف دریافت",
  resumeInbox: "🔔 فعال‌سازی دریافت",
  clearBlockList: "🔓 حذف بلاک‌ها",
  clearData: "🗑️ پاک کردن حساب",
  technical: "📐 معماری فنی",
  back: "🏠 بازگشت",
  confirmClear: "🗑️ بله، پاک کن",
  confirmClearBlocks: "🔓 بله، آنبلاک همه",
  cancel: "❌ انصراف",
} as const;

const INBOX_BUTTON = {
  block: "🚫 بلاک",
  unblock: "🔓 آنبلاک",
  reply: "💬 پاسخ",
  nickname: "🏷️ نام مستعار",
} as const;

const MENU_LABELS = new Set<string>(Object.values(MENU));

export const isMenuLabel = (text: string): boolean => MENU_LABELS.has(text);

/** Strip emoji/symbols so "تنظیمات" matches "⚙️ تنظیمات". */
const plainMenuLabel = (text: string): string =>
  text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "").trim();

export const isReservedDisplayName = (text: string): boolean => {
  if (isMenuLabel(text)) {
    return true;
  }

  const plain = plainMenuLabel(text);
  if (!plain) {
    return false;
  }

  for (const label of MENU_LABELS) {
    if (plainMenuLabel(label) === plain) {
      return true;
    }
  }

  return false;
};

const INBOX_CALLBACK = {
  reply: (ref: string) => `r:${ref}`,
  block: (ref: string) => `b:${ref}`,
  unblock: (ref: string) => `u:${ref}`,
  nickname: (ref: string) => `n:${ref}`,
} as const;

// Main menu keyboard used across various commands
export const mainMenu = new Keyboard()
  .text(MENU.link)
  .text(MENU.matchSystem)
  .row()
  .text(MENU.settings)
  .resized();

/** Match-system submenu on the reply keyboard (not inline under messages). */
export const buildMatchSystemMenu = (
  variant: MatchHubMenuVariant = "default"
): Keyboard => {
  const keyboard = new Keyboard()
    .text(MENU.matchProfile)
    .text(MENU.matchFind)
    .row()
    .text(MENU.matchPending)
    .text(MENU.matchTest);

  if (variant === "can_enable") {
    keyboard.row().text(MENU.matchEnable);
  } else if (variant === "can_disable") {
    keyboard.row().text(MENU.matchDisable);
  }

  return keyboard.row().text(MENU.back).resized();
};

export const buildMatchProfileEmptyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchTest)
    .row()
    .text(MENU.matchBackToHub)
    .text(MENU.back)
    .resized();

export const buildMatchProfileReadyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchFind)
    .text(MENU.matchRetest)
    .row()
    .text(MENU.matchBackToHub)
    .text(MENU.back)
    .resized();

/** Shown while composing, replying, or naming — always offers a way out. */
export const buildDraftMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.cancelDraft)
    .text(MENU.settings)
    .row()
    .text(MENU.back)
    .resized();

/**
 * Settings keyboard (RTL: first button on each row = right on screen).
 * حساب → مخاطبین → اطلاعات → خطر → خروج
 */
export const buildSettingsMenu = (paused: boolean): Keyboard =>
  new Keyboard()
    .text(MENU.editName)
    .text(paused ? MENU.resumeInbox : MENU.pauseInbox)
    .row()
    .text(MENU.clearBlockList)
    .row()
    .text(MENU.about)
    .text(MENU.technical)
    .row()
    .text(MENU.clearData)
    .row()
    .text(MENU.cancelDraft)
    .text(MENU.back)
    .resized();

export const confirmClearBlocksMenu = new Keyboard()
  .text(MENU.confirmClearBlocks)
  .row()
  .text(MENU.cancel)
  .resized();

export const confirmClearMenu = new Keyboard()
  .text(MENU.confirmClear)
  .row()
  .text(MENU.cancel)
  .resized();

export const handleMenuCommand = async (
  ctx: Context,
  user: BotUser,
  botUsername: string
): Promise<boolean> => {
  const msgPayload = ctx.message?.text;

  switch (msgPayload) {
    case MENU.link: {
      const linkText = USER_LINK_MESSAGE.replace(
        "UUID_USER_URL",
        buildUserDeepLink(botUsername, user.slug)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${linkText}` : linkText,
        withHtml({ reply_markup: mainMenu })
      );
      break;
    }
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
    .text(isBlocked ? INBOX_BUTTON.unblock : INBOX_BUTTON.block, blockData)
    .text(INBOX_BUTTON.reply, replyData)
    .row()
    .text(INBOX_BUTTON.nickname, nicknameData);
};
