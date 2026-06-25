import { InlineKeyboard, Keyboard } from "grammy";
import type { MatchHubMenuVariant } from "../features/matching/match-types";
import {
  encodeCapabilityCallbackData,
  type CapabilityAction,
} from "../crypto/crypto-service";
import { MENU } from "./menu-labels";

const INBOX_BUTTON = {
  block: "🚫 مسدود",
  unblock: "🔓 رفع مسدودیت",
  reply: "💬 پاسخ",
  nickname: "🏷️ نام خصوصی",
  report: "گزارش",
} as const;

const inboxCallback = (action: CapabilityAction, capability: string): string =>
  encodeCapabilityCallbackData(action, capability);

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
    .text(MENU.matchAssessment);

  if (variant === "can_enable") {
    keyboard.row().text(MENU.matchEnable);
  } else if (variant === "can_disable") {
    keyboard.row().text(MENU.matchDisable);
  }

  return keyboard.row().text(MENU.back).resized();
};

export const buildMatchProfileEmptyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchAssessment)
    .row()
    .text(MENU.matchBackToHub)
    .text(MENU.back)
    .resized();

export const buildMatchProfileReadyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchFind)
    .text(MENU.matchAssessmentRetry)
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
 * Three short labels per row to avoid overflow on mobile.
 */
export const buildSettingsMenu = (paused: boolean): Keyboard =>
  new Keyboard()
    .text(MENU.editName)
    .text(paused ? MENU.resumeInbox : MENU.pauseInbox)
    .text(MENU.clearBlockList)
    .row()
    .text(MENU.resetMatchHistory)
    .text(MENU.about)
    .text(MENU.technical)
    .row()
    .text(MENU.clearData)
    .text(MENU.cancelDraft)
    .text(MENU.back)
    .resized();

export const confirmClearBlocksMenu = new Keyboard()
  .text(MENU.confirmClearBlocks)
  .row()
  .text(MENU.cancel)
  .resized();

export const confirmResetMatchHistoryMenu = new Keyboard()
  .text(MENU.confirmResetMatchHistory)
  .row()
  .text(MENU.cancel)
  .resized();

export const confirmClearMenu = new Keyboard()
  .text(MENU.confirmClear)
  .row()
  .text(MENU.cancel)
  .resized();

export const createMessageKeyboard = (
  capability: string,
  isBlocked: boolean
): InlineKeyboard => {
  const blockData = isBlocked
    ? inboxCallback("unblock", capability)
    : inboxCallback("block", capability);
  const replyData = inboxCallback("reply", capability);
  const nicknameData = inboxCallback("nickname", capability);
  const reportData = inboxCallback("report", capability);

  return new InlineKeyboard()
    .text(isBlocked ? INBOX_BUTTON.unblock : INBOX_BUTTON.block, blockData)
    .text(INBOX_BUTTON.reply, replyData)
    .row()
    .text(INBOX_BUTTON.nickname, nicknameData)
    .text(INBOX_BUTTON.report, reportData);
};
