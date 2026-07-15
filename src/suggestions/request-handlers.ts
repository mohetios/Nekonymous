import type { Context } from "grammy";
import type { Environment } from "../types/runtime.env";
import { mainMenu } from "../bot/keyboards";
import {
  SUGGESTION_ACCEPTED_CANDIDATE,
  SUGGESTION_DECLINED_CANDIDATE,
  SUGGESTION_REQUEST_CANCEL_FAILED,
  SUGGESTION_REQUEST_CANCELLED,
  SUGGESTION_INVALID,
} from "../i18n/conversation-suggestions-ui";
import { hmacTelegramUserId } from "../ticketing/ticketing-service";
import { withHtml } from "../utils/text";
import { getUserByTelegramHash } from "../identity/identity-service";
import {
  acceptConversationRequest,
  cancelConversationRequest,
  declineConversationRequest,
  parseRequestCallback,
} from "./request-service";

export const handleRequestCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from) {
    await ctx.answerCallbackQuery();
    return;
  }

  const parsed = parseRequestCallback(data);
  if (!parsed) {
    await ctx.answerCallbackQuery();
    return;
  }

  const actorHash = await hmacTelegramUserId(env.APP_HMAC_PEPPER, from.id);
  let result: { ok: true } | { ok: false; reason: string };

  if (parsed.kind === "cancel") {
    result = await cancelConversationRequest(env, actorHash, parsed.requestRef);
    await ctx.answerCallbackQuery();
    if (result.ok) {
      await ctx.reply(SUGGESTION_REQUEST_CANCELLED, withHtml({ reply_markup: mainMenu }));
    } else {
      await ctx.reply(SUGGESTION_REQUEST_CANCEL_FAILED, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  if (parsed.kind === "decline") {
    result = await declineConversationRequest(env, actorHash, parsed.requestRef);
    await ctx.answerCallbackQuery();
    if (result.ok) {
      await ctx.reply(SUGGESTION_DECLINED_CANDIDATE, withHtml({ reply_markup: mainMenu }));
    } else {
      await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  if (parsed.kind === "accept") {
    const candidateUser = await getUserByTelegramHash(actorHash, env);
    if (!candidateUser) {
      await ctx.answerCallbackQuery();
      await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
      return;
    }
    result = await acceptConversationRequest(
      env,
      candidateUser,
      actorHash,
      parsed.requestRef
    );
    await ctx.answerCallbackQuery();
    if (result.ok) {
      await ctx.reply(SUGGESTION_ACCEPTED_CANDIDATE, withHtml({ reply_markup: mainMenu }));
    } else {
      await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  await ctx.answerCallbackQuery();
};
