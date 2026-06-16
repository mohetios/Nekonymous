CREATE TABLE IF NOT EXISTS test_profiles (
  user_id TEXT PRIMARY KEY,

  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',

  honesty_boundary_respect REAL NOT NULL,
  emotional_reactivity REAL NOT NULL,
  social_energy REAL NOT NULL,
  warmth_cooperation REAL NOT NULL,
  reliability_consistency REAL NOT NULL,
  curiosity_depth REAL NOT NULL,

  depth_preference REAL NOT NULL,
  reply_pace REAL NOT NULL,
  directness REAL NOT NULL,
  conflict_reflectiveness REAL NOT NULL,
  support_need REAL NOT NULL,
  anonymity_comfort REAL NOT NULL,

  values_json TEXT NOT NULL DEFAULT '[]',
  interests_json TEXT NOT NULL DEFAULT '[]',
  boundaries_json TEXT NOT NULL DEFAULT '{}',
  intents_json TEXT NOT NULL DEFAULT '[]',

  result_summary_json TEXT NOT NULL DEFAULT '{}',
  profile_summary_text TEXT,
  vector_id TEXT,
  vector_status TEXT NOT NULL DEFAULT 'not_indexed',
  vector_updated_at INTEGER,

  discoverable INTEGER NOT NULL DEFAULT 0,
  safety_tier TEXT NOT NULL DEFAULT 'normal',
  primary_intent TEXT NOT NULL DEFAULT 'deep-talk',
  profile_bucket INTEGER NOT NULL DEFAULT 0,

  completed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_test_profiles_status_updated
ON test_profiles(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_test_profiles_discoverable_locale
ON test_profiles(discoverable, updated_at);

CREATE INDEX IF NOT EXISTS idx_test_profiles_vector_status
ON test_profiles(vector_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_test_profiles_matching_filters
ON test_profiles(discoverable, safety_tier, primary_intent, profile_bucket);

CREATE TABLE IF NOT EXISTS test_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',

  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  abandoned_at INTEGER,

  total_questions INTEGER NOT NULL,
  answered_questions INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_test_attempts_user_started
ON test_attempts(user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_test_attempts_status_started
ON test_attempts(status, started_at);

CREATE TABLE IF NOT EXISTS test_answers (
  attempt_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  question_id TEXT NOT NULL,
  answer_value INTEGER NOT NULL,

  answered_at INTEGER NOT NULL,

  PRIMARY KEY(attempt_id, question_id),

  FOREIGN KEY(attempt_id) REFERENCES test_attempts(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_test_answers_user
ON test_answers(user_id, attempt_id);

CREATE TABLE IF NOT EXISTS profile_vector_index_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  vector_id TEXT NOT NULL,
  profile_version TEXT NOT NULL,
  status TEXT NOT NULL,

  model TEXT NOT NULL,
  dimension INTEGER,
  error_message TEXT,

  created_at INTEGER NOT NULL,
  completed_at INTEGER,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_profile_vector_events_user_created
ON profile_vector_index_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_profile_vector_events_status_created
ON profile_vector_index_events(status, created_at);
