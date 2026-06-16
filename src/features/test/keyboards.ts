import { InlineKeyboard } from "grammy";
import { TEST_CALLBACK } from "./constants";
import {
  getQuestionAtIndex,
  TEST_QUESTION_COUNT,
} from "./question-bank";
import { assertCallbackData } from "../../utils/telegram-limits";

export const buildTestDashboardKeyboard = (options: {
  hasProfile: boolean;
  hasSession: boolean;
}): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (!options.hasSession && !options.hasProfile) {
    keyboard.text("شروع تست", TEST_CALLBACK.start);
    return keyboard;
  }

  if (options.hasSession) {
    keyboard.text("ادامه تست", TEST_CALLBACK.continue).row();
    keyboard.text("شروع دوباره", TEST_CALLBACK.reset);
    return keyboard;
  }

  if (options.hasProfile) {
    keyboard.text("دیدن نتیجه", TEST_CALLBACK.result).row();
    keyboard.text("شروع دوباره", TEST_CALLBACK.reset);
  }

  return keyboard;
};

export const buildResetConfirmKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("بله، از نو", TEST_CALLBACK.resetYes)
    .text("انصراف", TEST_CALLBACK.resetNo);

export const buildQuestionKeyboard = (index: number): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  for (let value = 1; value <= 5; value++) {
    const data = TEST_CALLBACK.answer(index, value);
    assertCallbackData(data);
    keyboard.text(String(value), data);
  }

  keyboard.row();

  if (index > 0) {
    keyboard.text("قبلی", TEST_CALLBACK.previous);
  }

  keyboard.text("خروج", TEST_CALLBACK.exit);

  return keyboard;
};

export const buildResultKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("دیدن دوباره نتیجه", TEST_CALLBACK.result)
    .row()
    .text("شروع دوباره", TEST_CALLBACK.reset)
    .row()
    .text("بازگشت به منو", TEST_CALLBACK.menu);

export const formatQuestionMessage = (index: number): string => {
  const question = getQuestionAtIndex(index);
  if (!question) {
    return "سؤالی یافت نشد.";
  }

  const current = index + 1;
  return (
    `سؤال ${current}/${TEST_QUESTION_COUNT}\n\n` +
    `${question.text}\n\n` +
    `۱ = اصلاً شبیه من نیست\n` +
    `۵ = کاملاً شبیه من است`
  );
};

export const dashboardStatusLine = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${options.answeredCount} از ${TEST_QUESTION_COUNT} سؤال`;
  }
  if (options.hasProfile) {
    return "تکمیل‌شده — نتیجه ذخیره شده است";
  }
  return "هنوز شروع نکرده‌ای";
};

export const TEST_DASHBOARD_INTRO =
  "🧭 <b>تست سبک گفت‌وگو</b>\n\n" +
  "این تست کمک می‌کند سبک گفت‌وگو، مرزها و ترجیح‌های ارتباطی تو بهتر شناخته شود.\n\n" +
  "فعلاً نتیجه فقط برای خودت نمایش داده می‌شود.\n" +
  "در مرحله بعدی، اگر خودت فعال کنی، می‌تواند برای پیشنهاد گفت‌وگوهای ناشناس استفاده شود.\n\n" +
  "این تست تشخیص روان‌شناسی یا درمان نیست.";

export const TEST_FUTURE_MATCHING_NOTE =
  "\n\nدر نسخه بعدی، می‌توانی انتخاب کنی که این پروفایل برای پیشنهاد گفت‌وگوی ناشناس استفاده شود.\n" +
  "فعلاً این بخش فعال نیست.";

export const TEST_RESET_CONFIRM =
  "آیا مطمئنی می‌خواهی تست را از نو شروع کنی؟\n" +
  "پیشرفت فعلی پاک می‌شود. نتیجه قبلی تا تکمیل تست جدید باقی می‌ماند.";

export const TEST_EXIT_SAVED = "پیشرفت ذخیره شد. هر وقت خواستی از منوی تست ادامه بده.";
