-- Anonymous aggregate counters (no user ids). Survives account deletion.

CREATE TABLE IF NOT EXISTS platform_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  messages_relayed INTEGER NOT NULL DEFAULT 0,
  assessment_completions INTEGER NOT NULL DEFAULT 0,
  match_requests INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO platform_stats (id, updated_at) VALUES (1, 0);

UPDATE platform_stats
SET
  messages_relayed = COALESCE((SELECT SUM(message_count) FROM conversations), 0),
  assessment_completions = COALESCE(
    (SELECT COUNT(*) FROM assessment_profiles WHERE status = 'completed'),
    0
  ),
  match_requests = COALESCE((SELECT COUNT(*) FROM match_requests), 0),
  updated_at = CAST((strftime('%s', 'now') * 1000) AS INTEGER)
WHERE id = 1;
