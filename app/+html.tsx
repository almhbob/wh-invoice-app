import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#1A2744" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *, *::before, *::after { box-sizing: border-box; }

              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
              }

              body {
                background: #F5F7FA;
                overscroll-behavior-y: contain;
                touch-action: manipulation;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }

              #root {
                width: 100%;
                height: 100%;
                min-height: 100dvh;
                display: flex;
                flex-direction: column;
              }

              /* ── Desktop background ── */
              @media (min-width: 768px) {
                body {
                  background:
                    radial-gradient(ellipse at 20% 0%, rgba(26,39,68,0.07) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 100%, rgba(201,168,76,0.05) 0%, transparent 60%),
                    linear-gradient(135deg, #eef2f7 0%, #f5f7fa 50%, #edf1f8 100%);
                }
              }

              /* ── Scrollbar styling (desktop) ── */
              @media (min-width: 768px) {
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(26,39,68,0.18); border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(26,39,68,0.32); }
              }

              /* ── Hide scrollbar on mobile for cleaner look ── */
              @media (max-width: 767px) {
                ::-webkit-scrollbar { display: none; }
                * { scrollbar-width: none; }
              }

              /* ── Form elements ── */
              input, textarea, select, button { font: inherit; }

              /* ── Smooth text rendering ── */
              * { text-rendering: optimizeLegibility; }

              /* ── Prevent content from being hidden under mobile browser chrome ── */
              @supports (height: 100dvh) {
                #root { min-height: 100dvh; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
