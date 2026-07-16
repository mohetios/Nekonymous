import type { Context } from "grammy";
import type { D1User } from "../types/identity.model";
import type { Environment } from "../types/runtime.env";
import { resolveOrCreateUser } from "../identity/identity-service";

export type DeferWork = (promise: Promise<unknown>) => void;

export type NekoContext = Context & {
  deferWork?: DeferWork;
  actor?: D1User;
  callbackAnswered?: boolean;
};

export const setResolvedUser = (ctx: Context, user: D1User): void => {
  (ctx as NekoContext).actor = user;
};

export const deferContextWork = async (
  ctx: Context,
  work: Promise<unknown>
): Promise<void> => {
  const deferWork = (ctx as NekoContext).deferWork;
  if (deferWork) {
    deferWork(work);
    return;
  }
  await work;
};

type CallbackAnswerOptions = Parameters<Context["answerCallbackQuery"]>[0];

export const answerCallbackSafely = async (
  ctx: Context,
  options?: CallbackAnswerOptions
): Promise<void> => {
  const nekoCtx = ctx as NekoContext;
  if (nekoCtx.callbackAnswered) {
    return;
  }
  nekoCtx.callbackAnswered = true;
  try {
    await ctx.answerCallbackQuery(options);
  } catch {
    // Telegram callbacks can already be answered or expire during processing.
  }
};

export const getResolvedUser = async (
  ctx: Context,
  env: Environment
): Promise<D1User> => {
  const nekoCtx = ctx as NekoContext;
  if (nekoCtx.actor) {
    return nekoCtx.actor;
  }
  const user = await resolveOrCreateUser(ctx, env);
  nekoCtx.actor = user;
  return user;
};
