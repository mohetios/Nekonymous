import type { Context } from "grammy";
import type { BotUser } from "../types";
import {
  OWNER_PAUSED_NOTE,
  USER_LINK_MESSAGE,
} from "../i18n/messages";
import { withHtml } from "../utils/tools";
import { buildUserDeepLink } from "../utils/user";
import { mainMenu } from "./keyboards";
import { MENU } from "./menu-labels";

export { MENU, isMenuLabel, isReservedDisplayName } from "./menu-labels";

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
