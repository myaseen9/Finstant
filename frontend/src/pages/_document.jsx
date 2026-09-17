import Document, { Html, Head, Main, NextScript } from 'next/document';
import { fontVariables } from '@/lib/fonts';

/**
 * Runs before first paint, synchronously, in <head>.
 *
 * Without it the theme can only be applied from an effect, which means the
 * first frame is always the SSR default. A user whose preference is Light
 * would see a dark flash on every navigation — the classic theme flash.
 *
 * Kept as a hand-written string rather than imported from a module because
 * it must execute before any bundle has loaded. It is deliberately tiny and
 * fully wrapped in try/catch: localStorage throws in private browsing modes,
 * and a theme is never worth breaking the page over.
 *
 * Also migrates the two historical keys — `finance_engine_theme` from the
 * old _app.jsx toggle and `finstant_theme` from the unused ThemeContext — so
 * an existing preference survives the rename instead of silently resetting.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var KEY = 'finstant-theme';
    var FONT_KEY = 'finstant-font';
    var LEGACY = ['finance_engine_theme', 'finstant_theme'];
    var mode = localStorage.getItem(KEY);
    var font = localStorage.getItem(FONT_KEY) || 'roboto';

    if (!mode) {
      for (var i = 0; i < LEGACY.length; i++) {
        var old = localStorage.getItem(LEGACY[i]);
        if (old === 'light' || old === 'dark') { mode = old; break; }
      }
      if (!mode) mode = 'light';
      localStorage.setItem(KEY, mode);
    }

    if (mode !== 'light' && mode !== 'dark') mode = 'light';

    var root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-font', font);
  } catch (e) {
    /* Leave the SSR default in place. */
  }
})();
`;

export default function FinstantDocument() {
  return (
    <Html
      lang="en"
      className={fontVariables}
      data-theme="light"
      data-theme-mode="light"
      data-font="roboto"
      suppressHydrationWarning
    >
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
