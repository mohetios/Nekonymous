/** Must stay in sync with ASSESSMENT_QUESTION_COUNT in question-bank.ts */
const ASSESSMENT_QUESTION_COUNT = 56;

export const ASSESSMENT_ANSWER_SCALE =
  "۱ = اصلاً شبیه من نیست\n" +
  "۲ = کمی شبیه من است\n" +
  "۳ = تا حدی شبیه من است\n" +
  "۴ = زیاد شبیه من است\n" +
  "۵ = کاملاً شبیه من است";

export const ASSESSMENT_QUESTION_NOT_FOUND = "سؤالی یافت نشد.";

export const formatAssessmentQuestionHeader = (
  current: number,
  total = ASSESSMENT_QUESTION_COUNT
): string => `سؤال ${current}/${total}`;

export const formatAssessmentSessionStatus = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${options.answeredCount} از ${ASSESSMENT_QUESTION_COUNT} سؤال`;
  }
  if (options.hasProfile) {
    return "تکمیل‌شده — نتیجه ذخیره شده است";
  }
  return "هنوز شروع نکرده‌ای";
};

export const ASSESSMENT_DASHBOARD_INTRO =
  "🧭 <b>ارزیابی سبک گفت‌وگو</b>\n\n" +
  "این ارزیابی کمک می‌کند سبک گفت‌وگو، مرزها، ریتم پاسخ‌دهی و راحتی تو با گفت‌وگوی ناشناس بهتر فهمیده شود.\n\n" +
  "نتیجه ارزیابی تشخیص روان‌شناسی نیست.\n" +
  "از آن فقط برای ساخت پروفایل گفت‌وگو و پیشنهادهای ناشناس استفاده می‌شود.";

export const ASSESSMENT_STATUS_HEADER = "وضعیت:";

export const ASSESSMENT_COMPLETION_NOTE =
  "\n\nاین نتیجه فقط برای خودت نمایش داده می‌شود.\n" +
  "اگر مچ‌یابی را فعال کنی، از همین پروفایل برای پیشنهاد گفت‌وگوهای ناشناس استفاده می‌شود.";

export const ASSESSMENT_VERSION_OUTDATED_NOTE =
  "\n\nنسخه جدید ارزیابی آماده شده است.\n" +
  "برای پیشنهادهای بهتر، بهتر است ارزیابی را یک بار دیگر کامل کنی.";

export const ASSESSMENT_RESET_CONFIRM =
  "آیا مطمئنی می‌خواهی ارزیابی را از نو شروع کنی؟\n" +
  "پیشرفت فعلی پاک می‌شود. نتیجه قبلی تا تکمیل ارزیابی جدید باقی می‌ماند.";

export const ASSESSMENT_EXIT_SAVED =
  "پیشرفت ذخیره شد. هر وقت خواستی از منوی ارزیابی ادامه بده.";

export const ASSESSMENT_RESULT_READY_TITLE =
  "✅ <b>پروفایل گفت‌وگوی تو آماده شد.</b>";

export const ASSESSMENT_RESULT_HIGHLIGHTS_HEADER = "<b>چند سیگنال اصلی:</b>";
export const ASSESSMENT_RESULT_CAUTIONS_HEADER = "<b>چند نکته برای گفت‌وگو:</b>";
export const ASSESSMENT_RESULT_SCORES_HEADER = "<b>نمای کلی:</b>";

export const ASSESSMENT_DEFAULT_TITLE = "سبک گفت‌وگو";
export const ASSESSMENT_DEFAULT_SHORT_DESCRIPTION =
  "نتیجه ارزیابی ذخیره شده است.";
