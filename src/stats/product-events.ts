import type { Environment } from "../types";
import { emitStat } from "./emit-stat";
import { STAT_EVENTS } from "./events";

/** Product-level stat recordings used across features. */

export const recordUserCreated = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.USER_CREATED);

export const recordLinkCreated = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.LINK_CREATED);

export const recordInboxOpened = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.INBOX_OPENED);

export const recordMessageDelivered = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.MESSAGE_DELIVERED);

export const recordReplySent = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.REPLY_SENT);
