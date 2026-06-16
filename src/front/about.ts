export const AboutPageContent = () => `
  <div class="space-y-10">
    <section>
      <p class="text-sm text-blue-700 mb-2">راهنمای ساده برای کاربر</p>
      <h1 class="text-3xl font-bold mb-4">نِکونیموس چیست؟</h1>
      <p class="text-lg leading-9 mb-4">
        نِکونیموس یک ربات تلگرام برای پیام ناشناس و مچ‌یابی ناشناس است. با آن یک لینک شخصی می‌گیری،
        دیگران از همان لینک پیام می‌فرستند، و گفتگو بدون نمایش username تلگرام دو طرف در رابط ربات جلو می‌رود.
      </p>
      <p class="text-lg leading-9">
        کنار پیام ناشناس، یک تست سبک گفت‌وگو هم وجود دارد. اگر خودت بخواهی، نتیجه کنترل‌شده همین تست می‌تواند برای
        پیشنهاد گفت‌وگو با افراد نزدیک‌تر استفاده شود؛ بدون نمایش هویت تلگرام، لینک شخصی، پاسخ‌های خام یا نتیجه کامل تست.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">سه بخش اصلی</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">پیام ناشناس</h3>
          <p class="leading-8">
            لینک شخصی را به اشتراک می‌گذاری. پیام‌ها در inbox منتظر می‌مانند و با /inbox خوانده می‌شوند.
            بعد از خواندن می‌توانی پاسخ بدهی، block کنی، report بدهی یا nickname خصوصی بگذاری.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">تست سبک گفت‌وگو</h3>
          <p class="leading-8">
            تست درباره مرزها، عمق گفت‌وگو، انرژی اجتماعی، واکنش احساسی و ترجیح‌های ارتباطی است.
            نتیجه برای شناخت سبک گفت‌وگوست؛ تشخیص روان‌شناسی، درمان یا ارزیابی پزشکی نیست.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">مچ‌یابی ناشناس</h3>
          <p class="leading-8">
            مچ‌یابی پیش‌فرض خاموش است. اگر فعالش کنی، سیستم چند پیشنهاد ناشناس می‌دهد.
            درخواست گفتگو فقط وقتی تبدیل به پیام می‌شود که طرف مقابل آن را بپذیرد.
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">جریان پیام ناشناس</h2>
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۱. لینک ساخته می‌شود</h3>
          <p class="leading-8">
            با /start یک لینک شخصی می‌گیری. لینک به حساب داخلی تو وصل است، نه به username تلگرام.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۲. فرستنده پیام می‌دهد</h3>
          <p class="leading-8">
            ربات اعتبار لینک، self-message، block، pause و rate limit را بررسی می‌کند.
            فقط پیام‌ها و mediaهای پشتیبانی‌شده پذیرفته می‌شوند.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۳. پیام رمزنگاری و صف می‌شود</h3>
          <p class="leading-8">
            بدنه پیام و اطلاعات اتصال جداگانه رمزنگاری می‌شوند و ticket پیام در Durable Object مخصوص گیرنده ذخیره می‌شود.
            آمار گفتگو فقط خلاصه و بدون متن پیام در D1 می‌ماند.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۴. بعد از /inbox payload پاک می‌شود</h3>
          <p class="leading-8">
            پیام به تلگرام تحویل داده می‌شود، سپس payload ذخیره‌شده خالی می‌شود.
            فقط metadata رمزنگاری‌شده لازم برای پاسخ، block، report و nickname باقی می‌ماند.
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
      <h2 class="text-2xl font-semibold mb-4">حریم خصوصی، صادقانه</h2>
      <p class="leading-8 mb-3">
        نِکونیموس یک hosted anonymous relay است، نه پیام‌رسان end-to-end encrypted.
        Telegram هنوز بخشی از مسیر پیام است و Worker هنگام پردازش، متن پیام را قبل از رمزنگاری می‌بیند.
      </p>
      <p class="leading-8 mb-3">
        سیستم تلاش می‌کند raw Telegram ID را public نکند، chat id و payload را رمزنگاری کند،
        متن پیام را بعد از تحویل نگه ندارد، و برای مچ‌یابی فقط summary کنترل‌شده پروفایل را index کند.
      </p>
      <p class="leading-8">
        اپراتوری که بتواند کد Worker را تغییر دهد یا به secretهای runtime برسد، داخل مدل اعتماد است.
        هدف نکونیموس کاهش plaintext ذخیره‌شده و نشت هویت قابل مشاهده است، نه وعده ناشناس‌بودن مطلق.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">کنترل‌های کاربر</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">pause و block</h3>
          <p class="leading-8">
            دریافت پیام جدید از لینک را موقتاً متوقف می‌کنی یا فرستنده مزاحم را block می‌کنی.
          </p>
        </div>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">nickname و report</h3>
          <p class="leading-8">
            برای فرستنده‌های تکراری نام خصوصی می‌گذاری یا پیام مشکل‌دار را report می‌کنی.
          </p>
        </div>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">مچ‌یابی opt-in</h3>
          <p class="leading-8">
            تا وقتی خودت فعال نکنی، پروفایل تستت در جست‌وجوی مچ‌ها ظاهر نمی‌شود.
          </p>
        </div>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">reset حساب</h3>
          <p class="leading-8">
            از تنظیمات می‌توانی لینک، inbox، block list، nicknameها و پروفایل تست را reset کنی و لینک تازه بگیری.
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">اگر جزئیات بیشتری می‌خواهی</h2>
      <p class="leading-8 mb-4">
        صفحه فنی توضیح می‌دهد Worker، D1، KV، Durable Object، Queue، Workers AI و Vectorize هر کدام چه نقشی دارند
        و چرا KV برای inbox یا پیام‌ها منبع حقیقت نیست.
      </p>
      <a
        href="/about/technical"
        class="inline-flex rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 transition"
      >
        رفتن به معماری فنی
      </a>
    </section>

    <section class="border-t border-gray-200 pt-5">
      <h2 class="text-2xl font-semibold mb-4">متن‌باز</h2>
      <p class="leading-8">
        کد منبع روی
        <a href="https://github.com/mehotkhan/Nekonymous" class="text-blue-600 hover:text-blue-800 font-medium">گیت‌هاب</a>
        است. برای جزئیات دقیق‌تر، README و کد Worker بهترین منبع هستند.
      </p>
    </section>
  </div>
`;
