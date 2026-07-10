export const MATCH_CALLBACK = {
  hub: "m:hub",
  search: "m:search",
  pending: "m:pending",
  profile: "m:profile",
  enableDiscover: "m:disc:on",
  disableDiscover: "m:disc:off",
  assessment: "m:assess",
  request: (suggestionId: string) => `m:req:${suggestionId}`,
  accept: (requestId: string) => `m:acc:${requestId}`,
  decline: (requestId: string) => `m:dec:${requestId}`,
  cancel: (requestId: string) => `m:can:${requestId}`,
} as const;

/** Active match inline callbacks only. */
export const matchCallbackQueryRegex = (): RegExp =>
  /^m:(?:hub|search|pending|profile|disc:(?:on|off)|assess|(?:req|acc|dec|can):[A-Za-z0-9_-]+)$/;

/** Max pending requests shown in the hub pending list. */
export const MATCH_PENDING_LIST_LIMIT = 20;

export const MATCH_INTRO_MAX_CHARS = 500;

export const MATCH_SEARCH_TOP_K = 30;

/** Max suggestions shown per search; no minimum score gate. */
export const MATCH_RESULT_COUNT = 5;

export const MATCH_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MATCH_SEARCH_LIMIT_PER_HOUR = 50;

export const MATCH_REQUEST_LIMIT_PER_DAY = 300;

export const MATCH_RECENT_DECLINE_MS = 30 * 24 * 60 * 60 * 1000;

export const MATCH_DISMISS_BLOCK_MS = 30 * 24 * 60 * 60 * 1000;
