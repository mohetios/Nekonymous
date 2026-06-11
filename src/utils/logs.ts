import type { KVModel } from "./kv-storage";
import { convertToPersianNumbers } from "./tools";

const TOTAL_STAT_BASES = new Set(["newUser", "newConversation"]);

const totalStatKey = (statKey: string): string => `total:${statKey}`;

export const logBotError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, error);
};

const sumDailyPrefix = async (
  statsModel: KVModel<number>,
  prefix: string
): Promise<number> => {
  const { values } = await statsModel.list({ prefix });
  let total = 0;
  for (const value of values) {
    if (value) {
      total += value;
    }
  }
  return total;
};

const readOrBackfillTotal = async (
  statsModel: KVModel<number>,
  totalKey: string,
  dailyPrefix: string
): Promise<number> => {
  const cached = await statsModel.get(totalKey);
  if (cached !== null) {
    return cached;
  }

  const total = await sumDailyPrefix(statsModel, dailyPrefix);
  await statsModel.save(totalKey, total);
  return total;
};

/**
 * Increments a daily stat and, for homepage totals, the matching running total key.
 */
export const incrementStat = async (
  statsModel: KVModel<number>,
  statKey: string,
  amount: number = 1
): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const dailyKey = `${statKey}:${today}`;

  if (!TOTAL_STAT_BASES.has(statKey)) {
    const currentValue = (await statsModel.get(dailyKey)) || 0;
    await statsModel.save(dailyKey, currentValue + amount);
    return;
  }

  const runningKey = totalStatKey(statKey);
  const [dailyValue, runningValue] = await Promise.all([
    statsModel.get(dailyKey),
    statsModel.get(runningKey),
  ]);

  await Promise.all([
    statsModel.save(dailyKey, (dailyValue || 0) + amount),
    statsModel.save(runningKey, (runningValue || 0) + amount),
  ]);
};

export const getTotalStats = async (
  statsModel: KVModel<number>
): Promise<{
  conversationsCount: string;
  usersCount: string;
}> => {
  const [usersCount, conversationsCount] = await Promise.all([
    readOrBackfillTotal(statsModel, totalStatKey("newUser"), "newUser:"),
    readOrBackfillTotal(
      statsModel,
      totalStatKey("newConversation"),
      "newConversation:"
    ),
  ]);

  return {
    conversationsCount: convertToPersianNumbers(conversationsCount),
    usersCount: convertToPersianNumbers(usersCount),
  };
};
