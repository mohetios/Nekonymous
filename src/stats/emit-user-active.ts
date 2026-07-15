import type { Environment } from "../types/runtime.env";
import { hmacBase64Url } from "../ticketing/hmac";
import { STAT_EVENTS } from "../types/stats.events";
import { emitStat } from "./emit-stat";

export const emitUserActive = async (
  env: Environment,
  actorHash: string,
  at?: number
): Promise<void> => {
  const ts = at ?? Date.now();
  const day = new Date(ts).toISOString().slice(0, 10);
  const uniqueHash = await hmacBase64Url(
    env.APP_HMAC_PEPPER,
    `stats:active:${day}:${actorHash}`
  );
  await emitStat(env, STAT_EVENTS.USER_ACTIVE, { uniqueHash, at: ts });
};
