/** Must stay in sync with ASSESSMENT_QUESTION_COUNT in question-bank.ts */
const ASSESSMENT_QUESTION_COUNT = 56;

export const ASSESSMENT_ANSWER_SCALE =
  "۱ = اصلاً به من نزدیک نیست\n" +
  "۲ = کمی به من نزدیک است\n" +
  "۳ = تا حدی به من نزدیک است\n" +
  "۴ = زیاد به من نزدیک است\n" +
  "۵ = کاملاً به من نزدیک است";

export const ASSESSMENT_QUESTION_NOT_FOUND = "این سؤال در دسترس نیست.";

export const formatAssessmentQuestionHeader = (
  current: number,
  total = ASSESSMENT_QUESTION_COUNT
): string => `سؤال ${current} از ${total}`;

export const formatAssessmentSessionStatus = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${options.answeredCount} از ${ASSESSMENT_QUESTION_COUNT} سؤال پاسخ داده شده`;
  }
  if (options.hasProfile) {
    return "تکمیل‌شده — پروفایل گفت‌وگو ذخیره شده است";
  }
  return "هنوز شروع نشده";
};

export const ASSESSMENT_DASHBOARD_INTRO =
  "📝 <b>ارزیابی سبک گفت‌وگو</b>\n\n" +
  "این ارزیابی به نِکونیموس کمک می‌کند سبک گفت‌وگوی تو را بهتر بفهمد و پیشنهادهای گفت‌وگوی نزدیک‌تری نشان دهد.\n\n" +
  "این ارزیابی تشخیص روان‌شناختی نیست و نتیجه‌ی آن را نباید حقیقت قطعی درباره‌ی شخصیتت در نظر گرفت.";

export const ASSESSMENT_STATUS_HEADER = "وضعیت:";

export const ASSESSMENT_COMPLETION_NOTE =
  "\n\nارزیابی کامل شد.\n" +
  "حالا اگر خواستی، می‌توانی نمایش در پیشنهادهای گفت‌وگو را فعال کنی.";

export const ASSESSMENT_VERSION_OUTDATED_NOTE =
  "\n\nنسخه‌ی تازه‌ای از ارزیابی آماده شده است.\n" +
  "برای پیشنهادهای دقیق‌تر، بهتر است ارزیابی را یک بار دیگر کامل کنی.";

export const ASSESSMENT_RESET_CONFIRM =
  "می‌خواهی ارزیابی را از نو شروع کنی؟\n" +
  "پیشرفت فعلی پاک می‌شود. نتیجه‌ی قبلی تا وقتی ارزیابی جدید را کامل نکنی باقی می‌ماند.";

export const ASSESSMENT_EXIT_SAVED =
  "پیشرفت ذخیره شد. هر وقت خواستی از منوی ارزیابی ادامه بده.";

export const ASSESSMENT_RESULT_READY_TITLE =
  "✅ <b>ارزیابی کامل شد.</b>";

export const ASSESSMENT_RESULT_HIGHLIGHTS_HEADER = "<b>چند سیگنال اصلی:</b>";
export const ASSESSMENT_RESULT_CAUTIONS_HEADER = "<b>چند نکته برای گفت‌وگو:</b>";
export const ASSESSMENT_RESULT_SCORES_HEADER = "<b>نمای کلی:</b>";

export const ASSESSMENT_DEFAULT_TITLE = "سبک گفت‌وگو";
export const ASSESSMENT_DEFAULT_SHORT_DESCRIPTION =
  "پروفایل گفت‌وگوی تو ذخیره شده است.";
