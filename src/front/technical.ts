export const TechnicalPageContent = () => `
  <div class="space-y-10 text-gray-800">
    <p class="text-sm text-gray-500">
      <a href="/about" class="text-blue-600 hover:text-blue-800">← بازگشت به راهنمای ساده</a>
    </p>

    <section>
      <p class="text-sm text-blue-700 mb-2">معماری فنی، با زبان قابل خواندن</p>
      <h1 class="text-3xl font-bold mb-4">نِکونیموس روی یک Worker کوچک</h1>
      <p class="text-lg leading-9 mb-4">
        نِکونیموس یک Cloudflare Worker واحد است: همان Worker هم صفحات سبک HTML را سرو می‌کند،
        هم webhook تلگرام را می‌گیرد، هم queue خروجی Telegram را مصرف می‌کند.
      </p>
      <p class="text-lg leading-9">
        مسیرهای اصلی محصول سه بخش دارند: پیام ناشناس، تست سبک گفت‌وگو، و مچ‌یابی ناشناس opt-in.
        طراحی سیستم عمداً کوچک مانده است: D1 برای رکوردهای رابطه‌ای، Durable Object برای state داغ هر کاربر،
        KV فقط برای cache مسیر‌یابی، و Vectorize فقط برای کشف اولیه candidateها.
      </p>
    </section>

    <section class="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <h2 class="text-2xl font-semibold mb-4">نقشه کوتاه</h2>
      <pre class="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto leading-7" dir="ltr">Telegram / Browser
  -> Cloudflare Worker
  -> Grammy handlers
  -> D1 source-of-truth records
  -> KV routing cache
  -> per-user UserState Durable Object
  -> Queue + TelegramOutbox Durable Object
  -> Workers AI embeddings + Vectorize candidate search</pre>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">جریان پیام ناشناس</h2>
      <ol class="space-y-4">
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۱. /start:</strong>
          ربات کاربر تلگرام را resolve یا create می‌کند، Telegram ID را HMAC می‌کند، chat id را encrypt می‌کند،
          public link را در D1 می‌سازد و lookupهای <span dir="ltr">tg:{hash}</span> و <span dir="ltr">link:{slug}</span> را در KV cache می‌کند.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۲. /start با slug:</strong>
          slug از KV و در صورت نیاز از D1 resolve می‌شود. سپس self-message، pause، block و امکان دریافت توسط UserState Durable Object بررسی می‌شود.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۳. ارسال پیام:</strong>
          پیام پشتیبانی‌شده به payload استاندارد تبدیل می‌شود. برای هر پیام ticket id و ref کوتاه ساخته می‌شود،
          payload و connection metadata جداگانه encrypt می‌شوند و ticket در inbox گیرنده داخل UserStateDO ذخیره می‌شود.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۴. /inbox:</strong>
          ticketهای pending از UserStateDO خوانده می‌شوند، payload decrypt و به تلگرام تحویل داده می‌شود،
          سپس status delivered می‌شود و payload_ciphertext پاک می‌شود.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۵. callbackها:</strong>
          reply، block، unblock، report و nickname فقط با ref کوتاه شروع می‌شوند.
          handler باید ref را در UserStateDO همان کاربر resolve کند و به callback data اعتماد نمی‌کند.
        </li>
      </ol>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">مسئولیت هر storage</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm border border-gray-200 rounded-lg">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-right border-b">بخش</th>
              <th class="p-3 text-right border-b">کجا؟</th>
              <th class="p-3 text-right border-b">نقش</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-3 border-b">کاربران، لینک‌ها، گفتگوها، گزارش‌ها، consentها</td>
              <td class="p-3 border-b">D1</td>
              <td class="p-3 border-b">source of truth رابطه‌ای؛ بدون متن plaintext پیام</td>
            </tr>
            <tr>
              <td class="p-3 border-b">draft، pause، block، nickname، inbox، test session</td>
              <td class="p-3 border-b">UserState Durable Object + SQLite</td>
              <td class="p-3 border-b">state داغ و recipient-scoped با ordering و cap مشخص</td>
            </tr>
            <tr>
              <td class="p-3 border-b">lookupهای تلگرام و لینک</td>
              <td class="p-3 border-b">KV</td>
              <td class="p-3 border-b">cache مسیر‌یابی فقط؛ نه inbox، نه profile، نه ciphertext پیام</td>
            </tr>
            <tr>
              <td class="p-3 border-b">ارسال‌های غیرضروری برای پاسخ فوری webhook</td>
              <td class="p-3 border-b">Cloudflare Queue + TelegramOutboxDO</td>
              <td class="p-3 border-b">تحویل idempotent اعلان‌ها و پیام‌های غیرحیاتی</td>
            </tr>
            <tr>
              <td class="p-3 border-b">پروفایل تست و match records</td>
              <td class="p-3 border-b">D1</td>
              <td class="p-3 border-b">attemptها، answerها، profileها، suggestionها و requestها</td>
            </tr>
            <tr>
              <td class="p-3">کشف candidateهای مچ‌یابی</td>
              <td class="p-3">Workers AI + Vectorize</td>
              <td class="p-3">embedding summary کنترل‌شده و جست‌وجوی تقریبی؛ تصمیم نهایی نیست</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">تست و مچ‌یابی</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-xl border border-gray-200 p-5">
          <h3 class="font-semibold mb-2">تست سبک گفت‌وگو</h3>
          <p class="leading-8">
            پیشرفت فعال تست داخل UserStateDO نگه‌داری می‌شود. بعد از تکمیل، attempt و answerها در D1 ثبت می‌شوند،
            scoreهای deterministic ساخته می‌شوند، و یک summary کنترل‌شده برای profile ذخیره می‌شود.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-5">
          <h3 class="font-semibold mb-2">مچ‌یابی ناشناس</h3>
          <p class="leading-8">
            discoverability پیش‌فرض خاموش است. وقتی کاربر فعال کند، Vectorize فقط candidateهای احتمالی را پیدا می‌کند؛
            سپس D1 profileها با filter و scoring قطعی بررسی می‌شوند و حداکثر چند پیشنهاد ناشناس نمایش داده می‌شود.
          </p>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 class="text-xl font-semibold mb-3">سیستم چه چیزی را کم می‌کند؟</h2>
        <ul class="list-disc list-inside space-y-2 leading-8">
          <li>نمایش username تلگرام دو طرف در رابط ربات</li>
          <li>ذخیره plaintext پیام در D1، KV یا Durable Object</li>
          <li>باقی ماندن payload پیام بعد از /inbox</li>
          <li>اعتماد به callback_data بدون resolve کردن ref داخلی</li>
          <li>نمایش هویت، لینک شخصی یا نتیجه کامل تست در مچ‌یابی</li>
        </ul>
      </div>
      <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
        <h2 class="text-xl font-semibold mb-3">سیستم چه چیزی را حذف نمی‌کند؟</h2>
        <ul class="list-disc list-inside space-y-2 leading-8">
          <li>Telegram همچنان پیام‌های bot را دریافت می‌کند.</li>
          <li>Worker هنگام پردازش پیام، plaintext را می‌بیند.</li>
          <li>secretهای runtime و اپراتور Worker بخشی از مدل اعتماد هستند.</li>
          <li>metadata رمزنگاری‌شده برای reply، block، report و nickname باقی می‌ماند.</li>
          <li>شباهت مچ‌یابی تقریبی است و تضمین رابطه یا سازگاری نیست.</li>
        </ul>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">رمزنگاری</h2>
      <p class="leading-8 mb-3">
        Telegram user id با HMAC-SHA-256 به hash داخلی تبدیل می‌شود. chat id، payload پیام، connection metadata،
        nickname و intro مچ‌یابی با Web Crypto و AES-GCM رمزنگاری می‌شوند.
      </p>
      <p class="leading-8 mb-3">
        برای هر پیام ticket id تصادفی ساخته می‌شود و با HKDF-SHA-256 کلیدهای جدا برای payload و connection metadata مشتق می‌شود.
        ciphertextها در envelope نسخه‌دار ذخیره می‌شوند: <span dir="ltr">{ v, kid, iv, ct }</span>.
      </p>
      <p class="leading-8">
        ticket id، secretها، payload decryptشده و token تلگرام نباید log شوند. callbackها فقط ref کوتاه دارند و ref بدون state داخلی معنایی ندارد.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">محدودیت‌های عملی</h2>
      <ul class="list-disc list-inside space-y-2 leading-8">
        <li>inbox هر کاربر سقف ۵۰ ticket دارد.</li>
        <li>rate limit ارسال در UserStateDO اعمال می‌شود.</li>
        <li>KV eventually consistent است و فقط cache است.</li>
        <li>Queue at-least-once است؛ Outbox Durable Object باید ارسال را idempotent کند.</li>
        <li>صفحات public فقط HTML سبک هستند و SPA جداگانه‌ای وجود ندارد.</li>
        <li>تست، تشخیص روان‌شناسی یا ابزار درمان نیست.</li>
      </ul>
    </section>

    <section class="border-t border-gray-200 pt-5">
      <h2 class="text-2xl font-semibold mb-4">منبع</h2>
      <p class="leading-8">
        کد و README فنی پروژه در
        <a href="https://github.com/mehotkhan/Nekonymous" class="text-blue-600 hover:text-blue-800 font-medium">GitHub</a>
        در دسترس است. اگر فقط می‌خواهی استفاده کنی، صفحهٔ <a href="/about" class="text-blue-600 hover:text-blue-800">راهنمای ساده</a>
        کافی است.
      </p>
    </section>
  </div>
`;
