export const AboutPageContent = () => `
  <div class="max-w-4xl mx-auto p-4">
    <p class="text-lg leading-relaxed mb-4">
      نِکونیموس ربات پیام ناشناس برای تلگرامه.
      لینک شخصی می‌گیری؛ کسی که از لینکت می‌نویسه، یوزرنیم تلگرامت رو نمی‌بینه.
    </p>

    <h2 class="text-2xl font-semibold mt-8 mb-4">چطور کار می‌کنه</h2>
    <p class="text-lg leading-relaxed mb-4">
      توی ربات لینکت رو می‌گیری و می‌ذاری دست بقیه.
      وقتی کسی از لینک پیام می‌ده، تو با /inbox می‌خونی.
      می‌تونی پاسخ بدی، بلاک کنی، یا براش اسم مستعار بذاری.
    </p>
    <p class="text-lg leading-relaxed mb-4">
      هر پیام با کلید جدا رمزنگاری می‌شه.
      بعد از تحویل، متن پیام از حافظهٔ موقت پاک می‌شه.
    </p>

    <h2 class="text-2xl font-semibold mt-8 mb-4">حریم خصوصی</h2>
    <p class="text-lg leading-relaxed mb-4">
      نِکونیموس میزبان پیامه — E2E سرتاسری نیست.
      امنیت و حریم خصوصی مهمه؛ مثل هر سرویس ابری، درست کار کردن سیستم هم همین‌قدر.
    </p>
    <p class="text-lg leading-relaxed mb-4">
      می‌تونی دریافت رو قطع کنی، بلاک‌ها رو مدیریت کنی، یا از تنظیمات همهٔ داده‌ها رو پاک کنی و لینک تازه بگیری.
    </p>

    <h2 class="text-2xl font-semibold mt-8 mb-4">زیرساخت</h2>
    <p class="text-lg leading-relaxed mb-4">
      روی Cloudflare Workers اجرا می‌شه.
      داده‌ها در KV و Durable Objects نگه‌داری می‌شن؛ پیام‌ها در حالت رمزشده.
    </p>

    <div class="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-6 mb-6">
      <h3 class="text-lg font-semibold mb-2">برای کاربران پیشرفته</h3>
      <p class="leading-relaxed mb-3">
        معماری، جریان داده، قرارداد KV/DO، چرخهٔ رمزنگاری و محدودیت‌های عملیاتی
        در راهنمای فنی آمده است.
      </p>
      <a
        href="/about/technical"
        class="inline-block bg-slate-800 text-white text-sm font-medium py-2 px-4 rounded-md hover:bg-slate-900 transition"
      >
        📐 راهنمای معماری فنی
      </a>
      <p class="text-sm text-gray-500 mt-3">
        در ربات: <strong>تنظیمات → 📐 معماری فنی</strong>
      </p>
    </div>

    <h2 class="text-2xl font-semibold mt-8 mb-4">متن‌باز</h2>
    <p class="text-lg leading-relaxed mb-4">
      کد منبع روی
      <a href="https://github.com/mehotkhan/Nekonymous" class="text-blue-600 hover:text-blue-800">گیت‌هاب</a>
      هست. اگر دوست داری ببینی پشتش چه خبره، می‌تونی خودت نگاه کنی.
    </p>
  </div>
`;
