/** Reply-keyboard and inline button labels shown in Telegram UI. */

export const MENU = {
  about: "🛡️ درباره",
  privacy: "🔒 حریم خصوصی",
  link: "🔗 لینک من",
  matchSystem: "🧭 مچ‌یابی",
  matchProfile: "👤 پروفایل من",
  matchFind: "🔎 پیدا کردن مچ",
  matchPending: "📥 درخواست‌های در انتظار",
  matchEnable: "✅ فعال کردن مچ‌یابی",
  matchDisable: "⏸️ توقف مچ‌یابی",
  matchAssessment: "📝 شروع ارزیابی",
  matchAssessmentRetry: "📝 ارزیابی دوباره",
  matchBackToHub: "↩️ مچ‌یابی",
  settings: "⚙️ تنظیمات",
  editName: "✏️ نام",
  cancelDraft: "↩️ لغو",
  pauseInbox: "🔕 توقف",
  resumeInbox: "🔔 فعال",
  clearBlockList: "🔓 آنبلاک",
  resetMatchHistory: "🔄 ریست مچ",
  clearData: "🗑️ پاک کردن حساب",
  technical: "📐 فنی",
  back: "🏠 بازگشت",
  confirmClear: "🗑️ بله، پاک کن",
  confirmClearBlocks: "🔓 بله، آنبلاک همه",
  confirmResetMatchHistory: "🔄 بله، ریست کن",
  cancel: "❌ انصراف",
} as const;

export const INBOX_BUTTON = {
  block: "🚫 مسدود",
  unblock: "🔓 رفع مسدودیت",
  reply: "💬 پاسخ",
  nickname: "🏷️ نام خصوصی",
  report: "گزارش",
} as const;

export const OPEN_INBOX_TICKET_BUTTON = "باز کردن پیام";

/** Prefix for delivered anonymous messages (nickname inserted). */
export const DELIVERY_HEADER_FROM = (nickname: string): string =>
  `💬 از ${nickname}:`;

const MENU_LABELS = new Set<string>(Object.values(MENU));

export const isMenuLabel = (text: string): boolean => MENU_LABELS.has(text);

/** Strip emoji/symbols so "تنظیمات" matches "⚙️ تنظیمات". */
const plainMenuLabel = (text: string): string =>
  text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "").trim();

export const MATCH_BUTTON = {
  search: "نزدیک‌ترین گزینه‌های فعلی",
  accept: "قبول می‌کنم",
  decline: "رد می‌کنم",
  cancelRequest: "لغو درخواست",
  requestConversation: (index: number) => `درخواست گفت‌وگو با ${index + 1}`,
} as const;

export const ASSESSMENT_BUTTON = {
  start: "شروع ارزیابی",
  continue: "ادامه ارزیابی",
  restart: "شروع دوباره",
  viewResult: "دیدن نتیجه",
  viewResultAgain: "دیدن دوباره نتیجه",
  resetYes: "بله، از نو",
  resetNo: "انصراف",
  previous: "قبلی",
  exit: "خروج",
  backToMenu: "بازگشت به منو",
} as const;

export const isReservedDisplayName = (text: string): boolean => {
  if (isMenuLabel(text)) {
    return true;
  }

  const plain = plainMenuLabel(text);
  if (!plain) {
    return false;
  }

  for (const label of MENU_LABELS) {
    if (plainMenuLabel(label) === plain) {
      return true;
    }
  }

  return false;
};
