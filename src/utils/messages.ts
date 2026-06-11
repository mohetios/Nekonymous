export const WelcomeMessage = `✨ سلام!

به <b>نِکونیموس</b> خوش اومدی — جایی برای پیام ناشناس و امن.

🔗 <b>لینک تو:</b>
<code>UUID_USER_URL</code>

همین لینک رو بفرست برای بقیه. هر کسی بازش کنه می‌تونه <b>بدون لو رفتن یوزرنیم تلگرامش</b> بهت پیام بده.

📨 پیام‌های جدید → /inbox
⚙️ تنظیمات → /settings`;

export const USER_LINK_MESSAGE = `🔗 <b>لینک ناشناس تو</b>

<code>UUID_USER_URL</code>

کپی کن و هر جا خواستی بذار.
فرستنده فقط همین صفحهٔ ناشناس رو می‌بینه — نه اسم تلگرامت.

📨 خوندن پیام‌ها → /inbox`;

const DRAFT_KEYBOARD_HINT = `👇 گیر کردی؟ <b>↩️ لغو</b> · <b>⚙️ تنظیمات</b> · <b>🏠 بازگشت</b>`;

export const StartConversationMessage = `✍️ داری به <b>USER_NAME</b> پیام ناشناس می‌فرستی.

همین الان بنویس و بفرست.
🔐 پیام رمزنگاری می‌شه؛ هویت واقعی‌ات لو نمی‌ره.

${DRAFT_KEYBOARD_HINT}`;

export const HuhMessage = `😕 یه چیزی درست پیش نرفت.

دوباره امتحان کن یا از دکمه‌های منو کمک بگیر.
گیر کردی؟ /start رو بزن.`;

export const NoUserFoundMessage = `🔗❌ این لینک دیگه فعال نیست.

شاید اشتباه کپی شده یا صاحب لینک حسابش رو پاک کرده.
ازش یه لینک تازه بخواه.`;

export const NoConversationFoundMessage = `⏳ این پیام دیگه قابل پاسخ نیست.

شاید خیلی وقت گذشته یا قبلاً تحویل داده شده.
📨 /inbox رو بزن و از پیام‌های تازه‌تر استفاده کن.`;

export const MESSAGE_SENT_MESSAGE = `✨ فرستاده شد!

گیرنده با /inbox پیامت رو می‌بینه.`;

export const USER_BLOCKED_MESSAGE = `🚫 بلاک شد.

این فرستنده دیگه نمی‌تونه بهت پیام ناشناس بده.`;

export const USER_UNBLOCKED_MESSAGE = `🔓 آنبلاک شد.

این فرستنده دوباره می‌تونه از لینکت بهت پیام بده.`;

export const REPLAY_TO_MESSAGE = `💬 <b>پاسخ ناشناس</b>

پیامت رو بنویس و بفرست — مستقیم به همون فرستنده می‌رسه.

${DRAFT_KEYBOARD_HINT}`;

export const REPLAY_TO_NICKNAME_MESSAGE = `💬 داری به <b>NICKNAME</b> پاسخ می‌دی.

بنویس و بفرست — هویتت مخفی می‌مونه.

${DRAFT_KEYBOARD_HINT}`;

export const NICKNAME_PROMPT_MESSAGE = `🏷️ <b>نام مستعار</b> برای این فرستنده

الان: <b>CURRENT_NICK</b>

یه اسم کوتاه بفرست تا پیام‌هاش باهاش بیاد.
🗑️ برای حذف: <code>حذف</code> یا <code>−</code>

${DRAFT_KEYBOARD_HINT}`;

export const NICKNAME_SAVED_MESSAGE = `🏷️✨ ذخیره شد: <b>NAME</b>

از این به بعد پیام‌های این فرستنده با این اسم میان.`;

export const NICKNAME_REMOVED_MESSAGE = `🏷️ نام مستعار حذف شد.

این فرستنده دوباره بدون برچسب نمایش داده می‌شه.`;

export const NICKNAME_LIMIT_MESSAGE = `🏷️📋 ظرفیت نام‌های مستعار پر شده.

از ⚙️ تنظیمات چند تا رو حذف کن، بعد دوباره امتحان کن.`;

export const NICKNAME_TEXT_ONLY_MESSAGE = `✏️ برای نام مستعار فقط <b>متن</b> بفرست.

📎 عکس، ویس و فایل قبول نمی‌شه.`;

export const RECIPIENT_PAUSED_MESSAGE = `💤 <b>USER_NAME</b> فعلاً پیام ناشناس نمی‌گیره.

بعداً دوباره از همین لینک امتحان کن.`;

export const OWNER_PAUSED_NOTE = `💤 <b>دریافت پیام خاموشه.</b>

برای روشن کردن: ⚙️ تنظیمات → <b>🔔 فعال‌سازی دریافت</b>`;

export const USER_IS_BLOCKED_MESSAGE = `🚫 دسترسی نداری.

صاحب این لینک تو رو بلاک کرده — پیامت قبول نمی‌شه.`;

export const ABOUT_PRIVACY_COMMAND_MESSAGE = `<b>🛡️ نِکونیموس چیه؟</b>

ربات پیام <b>ناشناس</b> برای تلگرام — لینک شخصی، بدون لو رفتن یوزرنیم.

<b>⚡ چطور کار می‌کنه؟</b>
• 🔗 لینک بگیر و بده به بقیه
• 🔐 پیام‌ها رمزنگاری می‌شن (AES-GCM)
• 📨 با /inbox می‌خونی · 💬 پاسخ · 🚫 بلاک

<b>🔒 حریم خصوصی</b>
• فرستنده یوزرنیم تلگرامت رو نمی‌بینه
• بعد از تحویل، متن پیام از حافظهٔ موقت پاک می‌شه
• 🗑️ «پاک کردن حساب» لینک قبلی رو از کار می‌ندازه

<b>🎛️ کنترل با خودته</b>
• 🔕 توقف دریافت · 🚫 بلاک · 🏷️ نام مستعار
• 🗑️ حذف همهٔ داده‌ها هر وقت بخوای

<i>نِکونیموس میزبان پیامه، نه E2E سرتاسری.</i> امنیت و حریم خصوصی مهمه؛ با این حال مثل هر سرویس میزبانی‌شده‌ای به اجرای درست سیستم هم وابسته‌ای.`;

export const UnsupportedMessageTypeMessage = `📎 این فرمت رو پشتیبانی نمی‌کنیم.

✍️ متن · 🖼 عکس · 🎬 ویدیو · 🎤 ویس · استیکر — یه فرمت دیگه امتحان کن.`;

export const NEW_INBOX_MESSAGE = `📨 <b>COUNT</b> پیام ناشناس جدید!

برای دیدنشون /inbox رو بزن 👇`;

export const EMPTY_INBOX_MESSAGE = `📭 صندوق خالیه.

فعلاً پیام نخونده‌ای نداری — 🔗 لینکت رو بفرست تا پیام بیاد!`;

export const YOUR_MESSAGE_SEEN_MESSAGE = `👁️ گیرنده پیامت رو دید.`;

export const RATE_LIMIT_MESSAGE = `🐢 یه کم آروم‌تر!

چند ثانیه صبر کن و دوباره بفرست.`;

export const INBOX_FULL_MESSAGE = `📦 صندوق ورودی این نفر پره.

الان نمی‌تونی پیام بدی — کمی بعد دوباره امتحان کن.`;

export const SELF_MESSAGE_DISABLE_MESSAGE = `😄 به خودت نمی‌تونی پیام ناشناس بفرستی!

🔗 لینک بقیه رو باز کن.`;
