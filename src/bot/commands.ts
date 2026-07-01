/** Slash commands registered in register-handlers and recognized as valid. */
export const BOT_COMMANDS = [
  "start",
  "inbox",
  "settings",
  "assessment",
  "match",
  "match_system",
] as const;

export const isBotCommand = (value: string): value is (typeof BOT_COMMANDS)[number] =>
  (BOT_COMMANDS as readonly string[]).includes(value);
