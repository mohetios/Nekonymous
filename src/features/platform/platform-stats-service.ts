import type { Environment } from "../../types";

const STATS_ROW_ID = 1;

type PlatformStatField =
  | "messages_relayed"
  | "assessment_completions"
  | "match_requests";

export const incrementPlatformStat = async (
  env: Environment,
  field: PlatformStatField,
  amount = 1
): Promise<void> => {
  if (amount <= 0) {
    return;
  }

  const now = Date.now();
  const sql = `UPDATE platform_stats SET ${field} = ${field} + ?, updated_at = ? WHERE id = ?`;

  try {
    await env.DB.prepare(sql).bind(amount, now, STATS_ROW_ID).run();
  } catch {
    // Table may not exist before migration; stats are best-effort.
  }
};

export const getPlatformStats = async (
  env: Environment
): Promise<{
  usersCount: number;
  conversationsCount: number;
  assessmentProfilesCount: number;
  discoverableProfilesCount: number;
  matchRequestsCount: number;
}> => {
  const count = async (sql: string): Promise<number> => {
    try {
      const row = await env.DB.prepare(sql).first<{ count: number }>();
      return row?.count ?? 0;
    } catch {
      return 0;
    }
  };

  const [usersCount, discoverableProfilesCount, platformRow] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
    count(
      "SELECT COUNT(*) AS count FROM assessment_profiles WHERE discoverable = 1"
    ),
    env.DB.prepare(
      "SELECT messages_relayed, assessment_completions, match_requests FROM platform_stats WHERE id = ?"
    )
      .bind(STATS_ROW_ID)
      .first<{
        messages_relayed: number;
        assessment_completions: number;
        match_requests: number;
      }>()
      .catch(() => null),
  ]);

  if (platformRow) {
    return {
      usersCount,
      conversationsCount: platformRow.messages_relayed,
      assessmentProfilesCount: platformRow.assessment_completions,
      discoverableProfilesCount,
      matchRequestsCount: platformRow.match_requests,
    };
  }

  const [assessmentProfilesCount, matchRequestsCount] =
    await Promise.all([
      count(
        "SELECT COUNT(*) AS count FROM assessment_profiles WHERE status = 'completed'"
      ),
      count("SELECT COUNT(*) AS count FROM match_requests"),
    ]);

  return {
    usersCount,
    conversationsCount: 0,
    assessmentProfilesCount,
    discoverableProfilesCount,
    matchRequestsCount,
  };
};
