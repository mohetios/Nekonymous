const RATE_LIMIT_SECONDS = 5;

export const escapeMarkdownV2 = (text: string): string =>
  text.replace(/[_*[\]()~`>#+-=|{}.!\\]/g, "\\$&");

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
