
const pageLayout = (title: string, BOT_NAME: string, content: string) => `
  <!doctype html>
  <html lang="fa">
    <head>
      <meta charset="utf-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, user-scalable=no"
      />
      <link
        href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
        rel="stylesheet"
      />
      <link
        href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        rel="stylesheet"
      />
      <title>${title}</title>
      <meta name="description" content="${BOT_NAME} — ربات پیام ناشناس برای تلگرام. لینک شخصی، بدون لو رفتن یوزرنیم." />
      <meta name="keywords" content="ربات ناشناس, امنیت, پیام ناشناس, حریم خصوصی, ${BOT_NAME}" />
      <meta name="robots" content="index, follow" />
      <meta name="author" content="ربات ${BOT_NAME}" />
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${BOT_NAME} — پیام ناشناس برای تلگرام. لینک شخصی، بدون لو رفتن یوزرنیم." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://example.com" />
      <meta property="og:image" content="https://example.com/path-to-your-image.jpg" />
      <meta property="og:locale" content="fa_IR" />
      <meta property="og:site_name" content="${BOT_NAME}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${BOT_NAME} — پیام ناشناس برای تلگرام. لینک شخصی، بدون لو رفتن یوزرنیم." />
      <meta name="twitter:image" content="https://example.com/path-to-your-image.jpg" />
      <meta name="twitter:site" content="@YourTwitterHandle" />
      <link rel="canonical" href="https://example.com" />
      <link rel="icon" href="/favicon.ico" />
      <meta name="theme-color" content="#317EFB"/>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "${BOT_NAME}",
          "url": "https://example.com",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://example.com/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }
      </script>
      <style>
        body {
          direction: rtl;
          font-family: 
            Vazirmatn, 
            -apple-system, 
            BlinkMacSystemFont, 
            "Segoe UI", 
            "Roboto", 
            "Oxygen", 
            "Ubuntu", 
            "Cantarell", 
            "Fira Sans", 
            "Droid Sans", 
            "Helvetica Neue", 
            Arial, 
            sans-serif;
          background-color: #f0f4f8;
        }

        a {
          color: #3182ce;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body class="bg-gray-100 antialiased">

      <main class="bg-white shadow-md rounded-lg p-6 max-w-3xl mx-auto mt-2">
      <nav class="bg-gray-200 p-4 rounded-md mb-4 flex justify-between items-center ">
      <div  >
        <a
          href="/"
          class="text-xl font-bold nav-link text-blue-600 hover:text-blue-800"
        >
        ${BOT_NAME}
        </a>
        <span class="text-sm font-normal nav-link text-blue-600 hover:text-blue-800">
        ، ${title}
        </span>
      </div>
      <div>
        <a href="/about" class="nav-link text-blue-600 hover:text-blue-800 mx-2">
          درباره
        </a>
      </div>
    </nav>  
      <div class="text-gray-700 leading-relaxed">
          ${content}
        </div>
      </main>
    </body>
  </html>
`;

export default pageLayout;
