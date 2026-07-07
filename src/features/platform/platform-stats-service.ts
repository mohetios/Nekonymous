import type { Environment } from "../../types";
import { emitStat } from "../../stats/emit-stat";
import type { STAT_EVENTS } from "../../stats/events";

export type PlatformStatField =
  | typeof STAT_EVENTS.MESSAGE_CREATED
  | typeof STAT_EVENTS.ASSESSMENT_COMPLETED
  | typeof STAT_EVENTS.REQUEST_SENT;

export const incrementPlatformStat = async (
  env: Environment,
  field: PlatformStatField,
  amount = 1
): Promise<void> => {
  if (amount <= 0) {
    return;
  }
  for (let i = 0; i < amount; i += 1) {
    await emitStat(env, field);
  }
};
