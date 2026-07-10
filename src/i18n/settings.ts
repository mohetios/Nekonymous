/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */

import { DISPLAY_NAME_UNSET } from "./defaults";

export const SETTINGS_NAME_UNSET = DISPLAY_NAME_UNSET;

export const SETTINGS_HOME_MESSAGE = `<b>تنظیمات</b>

نام نمایشی: <b>USER_NAME</b>
وضعیت دریافت پیام: <b>PAUSE_STATUS</b>

از دکمه‌های زیر برای مدیریت حساب استفاده کن.`;

export const SETTINGS_PAUSE_ACTIVE = "متوقف";
export const SETTINGS_PAUSE_INACTIVE = "فعال";

export const SETTINGS_EDIT_NAME_MESSAGE = `<b>تغییر نام نمایشی</b>

یک نام کوتاه بفرست.
این نام در صفحه‌ی ارسال پیام نمایش داده می‌شود و <b>نام کاربری تلگرام تو نیست</b>.`;

export const SETTINGS_NAME_SAVED_MESSAGE = `<b>نام نمایشی ذخیره شد:</b> <b>NAME</b>

از این به بعد فرستندگان این نام را می‌بینند.`;

export const SETTINGS_NAME_INVALID_MESSAGE = `این نام قابل قبول نیست.

لطفاً یک متن کوتاه بفرست؛ بدون خط خالی و بدون Enter.`;

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE = `برای نام نمایشی فقط <b>متن</b> قابل قبول است.

عکس، فایل، پیام صوتی یا استیکر پشتیبانی نمی‌شود.`;

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE = `<b>پاک کردن حساب</b>

با پاک کردن حساب، لینک فعلی از کار می‌افتد و داده‌های وابسته به حساب در حد پیاده‌سازی فعلی حذف می‌شوند.

این کار قابل بازگشت نیست. اگر دوباره بات را شروع کنی، یک لینک و شناسه‌ی تازه ساخته می‌شود.

برای ادامه، دکمه‌ی تأیید را بزن.`;

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE = `حساب پاک شد و لینک جدید برایت ساخته شد.

<code>UUID_USER_URL</code>

لینک قبلی دیگر فعال نیست. از این به بعد همین لینک جدید را به اشتراک بگذار.`;

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE = `عملیات لغو شد.

هیچ داده‌ای حذف نشد.`;

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE = `<b>رفع همه‌ی مسدودی‌ها</b>

در حال حاضر <b>COUNT</b> فرستنده مسدود شده‌اند.
اگر تأیید کنی، همه‌ی آن‌ها دوباره می‌توانند از لینک تو پیام بفرستند.

لینک و نام‌های خصوصی بدون تغییر باقی می‌مانند.`;

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE = `<b>همه‌ی مسدودی‌ها رفع شدند</b>

فرستنده‌های قبلاً مسدودشده دوباره می‌توانند پیام بفرستند.`;

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE = `عملیات لغو شد.

فهرست مسدودی‌ها بدون تغییر باقی ماند.`;

export const SETTINGS_RESET_MATCH_WARNING_MESSAGE = `<b>بازنشانی پیشنهادهای گفت‌وگو</b>

در حال حاضر <b>REQUEST_COUNT</b> درخواست گفت‌وگو و <b>BLOCK_COUNT</b> بلاک پیشنهاد گفت‌وگو ثبت شده است.

اگر تأیید کنی، این تاریخچه پاک می‌شود و ممکن است دوباره همان افراد را در جست‌وجو ببینی.

پروفایل ارزیابی، وضعیت نمایش در پیشنهادها و پیام‌های ناشناس تو بدون تغییر می‌مانند.`;

export const SETTINGS_RESET_MATCH_DONE_MESSAGE = `<b>تاریخچه‌ی پیشنهادهای گفت‌وگو پاک شد</b>

DETAIL_LINES

حالا می‌توانی دوباره از مسیر پیشنهاد گفت‌وگو → «🔎 پیدا کردن گزینه‌ها» استفاده کنی.`;

export const SETTINGS_RESET_MATCH_CANCELLED_MESSAGE = `عملیات لغو شد.

تاریخچه‌ی پیشنهادهای گفت‌وگو بدون تغییر باقی ماند.`;

export const SETTINGS_RESET_MATCH_REQUESTS_CLEARED =
  "— COUNT درخواست گفت‌وگو حذف شد";
export const SETTINGS_RESET_MATCH_BLOCKS_CLEARED =
  "— COUNT بلاک پیشنهاد گفت‌وگو حذف شد";
