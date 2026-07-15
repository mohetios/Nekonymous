import { PROFILE_QUESTION_COUNT } from "../features/conversation/profile/constants.ts";
import type { ConversationDimension } from "../contracts/conversation/profile.ts";
import { convertToPersianNumbers } from "../utils/text.ts";

export type ProfileAnswerChoice = {
  value: number;
  label: string;
};

const guideLine = (value: number, label: string): string =>
  `${convertToPersianNumbers(value)} — ${label}`;

export const PROFILE_ANSWER_SCALE =
  "این جمله چقدر شبیه توئه؟\n\n" +
  "۱ — اصلاً شبیه من نیست\n" +
  "۲ — کمی\n" +
  "۳ — تا حدی\n" +
  "۴ — خیلی\n" +
  "۵ — کاملاً شبیه منه";

export const PROFILE_SELF_ANSWER_CHOICES: ProfileAnswerChoice[] = [1, 2, 3, 4, 5].map(
  (value) => ({
    value,
    label: convertToPersianNumbers(value),
  })
);

export const PROFILE_DESIRED_GUIDES: Record<ConversationDimension, string> = {
  depth: [
    guideLine(1, "خیلی سبک"),
    guideLine(2, "سبک"),
    guideLine(3, "متعادل"),
    guideLine(4, "عمیق"),
    guideLine(5, "خیلی عمیق"),
  ].join("\n"),
  replyPace: [
    guideLine(1, "خیلی آرام"),
    guideLine(2, "آرام"),
    guideLine(3, "متعادل"),
    guideLine(4, "سریع"),
    guideLine(5, "خیلی سریع"),
  ].join("\n"),
  directness: [
    guideLine(1, "خیلی غیرمستقیم"),
    guideLine(2, "غیرمستقیم"),
    guideLine(3, "متعادل"),
    guideLine(4, "مستقیم"),
    guideLine(5, "خیلی مستقیم"),
  ].join("\n"),
  energy: [
    guideLine(1, "خیلی آرام"),
    guideLine(2, "آرام"),
    guideLine(3, "متعادل"),
    guideLine(4, "پرانرژی"),
    guideLine(5, "خیلی پرانرژی"),
  ].join("\n"),
  playfulness: [
    guideLine(1, "خیلی جدی"),
    guideLine(2, "جدی"),
    guideLine(3, "متعادل"),
    guideLine(4, "شوخ"),
    guideLine(5, "خیلی شوخ"),
  ].join("\n"),
  supportStyle: [
    guideLine(1, "شنیدن بیشتر"),
    guideLine(2, "کمی شنیدن"),
    guideLine(3, "متعادل"),
    guideLine(4, "کمی راه‌حل"),
    guideLine(5, "راه‌حل بیشتر"),
  ].join("\n"),
  disclosurePace: [
    guideLine(1, "خیلی آهسته"),
    guideLine(2, "آهسته"),
    guideLine(3, "متعادل"),
    guideLine(4, "زود"),
    guideLine(5, "خیلی زود"),
  ].join("\n"),
  repairStyle: [
    guideLine(1, "فاصله‌ی بیشتر"),
    guideLine(2, "آرام"),
    guideLine(3, "متعادل"),
    guideLine(4, "زود"),
    guideLine(5, "خیلی زود"),
  ].join("\n"),
};

export const formatProfileQuestionHeader = (
  current: number,
  total = PROFILE_QUESTION_COUNT,
): string =>
  `سؤال ${convertToPersianNumbers(current)} از ${convertToPersianNumbers(total)}`;

export const formatProfileSessionStatus = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${convertToPersianNumbers(options.answeredCount)} از ${convertToPersianNumbers(PROFILE_QUESTION_COUNT)} سؤال`;
  }

  if (options.hasProfile) {
    return "آماده — پروفایل گفت‌وگوت ذخیره شده";
  }

  return "هنوز شروع نشده";
};

export const PROFILE_DASHBOARD_INTRO =
  "ارزیابی سبک گفت‌وگو\n\n" +
  "میو، بیا ببینیم معمولاً چطور گفت‌وگو می‌کنی 🐾\n\n" +
  "چند جمله‌ی کوتاه می‌بینی.\n" +
  "برای هرکدوم بگو چقدر شبیه توئه.\n\n" +
  "جواب درست یا غلطی وجود نداره.\n\n" +
  "این ارزیابی تست شخصیت یا تشخیص روان‌شناختی نیست؛\n" +
  "فقط ترجیحات گفت‌وگوت رو خلاصه می‌کنه تا پیشنهادهای مناسب‌تری ببینی.";

export const PROFILE_DASHBOARD_READY_INTRO = "ارزیابی سبک گفت‌وگو";

export const PROFILE_STATUS_HEADER = "وضعیت:";

export const PROFILE_COMPLETION_NOTE =
  "\n\nتموم شد 🐾\n\n" +
  "پروفایل گفت‌وگوت آماده‌ست.\n\n" +
  "اگه خواستی، حالا می‌تونی نمایش در پیشنهادها رو فعال کنی.";

export const PROFILE_RESET_CONFIRM =
  "می‌خوای ارزیابی رو از اول شروع کنی؟\n\n" +
  "پیشرفت فعلیت پاک می‌شه.\n" +
  "اگه پروفایل قبلی داشته باشی، تا کامل‌شدن ارزیابی تازه در پیشنهادها نمایش داده نمی‌شی.";

export const PROFILE_EXIT_SAVED =
  "پیشرفتت ذخیره شد.\n\nهر وقت خواستی از همین‌جا ادامه بده.";

export const PROFILE_RESULT_READY_TITLE = "خلاصه‌ی پروفایل گفت‌وگو";

export const PROFILE_INTENT_OPTIONS = {
  light: "گفت‌وگوی سبک و روزمره",
  deep: "گفت‌وگوی عمیق‌تر",
  support: "شنیده‌شدن و همراهی",
  exploration: "کشف موضوع‌های تازه",
  open: "بدون ترجیح مشخص",
} as const;

export const PROFILE_SUBMIT_READY =
  "به همه‌ی سؤال‌ها جواب دادی.\n\n" +
  "برای ساخت پروفایل گفت‌وگوت، دکمه‌ی «ثبت پروفایل» رو بزن.";

export const PROFILE_SUBMIT_BUTTON = "✅ ثبت پروفایل";
