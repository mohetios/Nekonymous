/** Slash commands registered in register-handlers and recognized as valid. */
export const BOT_COMMANDS = [
  "start",
  "inbox",
  "settings",
  "assessment",
  "match",
] as const;

export const BOT_COMMAND_DEFINITIONS = [
  { command: "start", description: "شروع و دریافت لینک ناشناس" },
  { command: "inbox", description: "دیدن صندوق پیام‌ها" },
  { command: "settings", description: "تنظیمات و حریم خصوصی" },
  { command: "assessment", description: "ارزیابی سبک گفت‌وگو" },
  { command: "match", description: "پیشنهادهای گفت‌وگو" },
] as const satisfies ReadonlyArray<{
  command: (typeof BOT_COMMANDS)[number];
  description: string;
}>;

export const isBotCommand = (value: string): value is (typeof BOT_COMMANDS)[number] =>
  (BOT_COMMANDS as readonly string[]).includes(value);
