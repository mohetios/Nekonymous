import type { Context } from "grammy";

export type DeferFn = (promise: Promise<unknown>) => void;

export type NekoContext = Context & {
  deferWork?: DeferFn;
};

const deferByUpdate = new Map<number, DeferFn>();

export const registerUpdateDefer = (updateId: number, defer: DeferFn): void => {
  deferByUpdate.set(updateId, defer);
};

export const unregisterUpdateDefer = (updateId: number): void => {
  deferByUpdate.delete(updateId);
};

export const deferForUpdate = (updateId: number): DeferFn | undefined =>
  deferByUpdate.get(updateId);

export const scheduleWork = async (
  ctx: Context | undefined,
  promise: Promise<unknown>
): Promise<void> => {
  const defer = ctx
    ? ((ctx as NekoContext).deferWork ?? deferForUpdate(ctx.update.update_id))
    : undefined;

  if (defer) {
    defer(promise);
    return;
  }
  await promise;
};
