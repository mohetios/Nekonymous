import type { Context } from "grammy";

const RATE_LIMIT_SECONDS = 5;

type ReplyOptions = NonNullable<Parameters<Context["reply"]>[1]>;

export const escapeMarkdownV2 = (text: string): string =>
  text.replace(/[_*[\]()~`>#+-=|{}.!\\]/g, "\\$&");

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const withHtml = (
  options: Record<string, unknown> = {}
): { parse_mode: "HTML" } & Record<string, unknown> => ({
  parse_mode: "HTML",
  ...options,
});

/** Use for bot copy that contains HTML tags (`<b>`, `<i>`, `<code>`, …). */
export const replyHtml = (
  ctx: Context,
  text: string,
  options?: ReplyOptions
) => ctx.reply(text, withHtml(options));

export const convertToPersianNumbers = (input: string | number): string =>
  input.toString().replace(/\d/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 1728)
  );

export const checkRateLimit = (lastMessage?: number): boolean => {
  if (lastMessage === undefined) {
    return false;
  }
  return Date.now() - lastMessage < RATE_LIMIT_SECONDS * 1000;
};
