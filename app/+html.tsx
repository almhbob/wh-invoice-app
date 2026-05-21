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
          content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#14213d" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html,
              body,
              #root {
                width: 100%;
                min-width: 320px;
                min-height: 100%;
                margin: 0;
                background: #f6f8fb;
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
              }

              body {
                overscroll-behavior-y: contain;
                touch-action: manipulation;
              }

              * {
                box-sizing: border-box;
              }

              input,
              textarea,
              select,
              button {
                font: inherit;
              }

              @media (min-width: 900px) {
                body {
                  background: radial-gradient(circle at top, #ffffff 0, #f6f8fb 42%, #edf2f7 100%);
                }
              }

              @media (max-width: 420px) {
                html,
                body,
                #root {
                  min-width: 0;
                }
              }

              /* Expo / React Native Web scroll containers */
              [data-rnw-scrollview],
              div[style*="overflow: scroll"],
              div[style*="overflow-y: scroll"],
              div[style*="overflow: auto"],
              div[style*="overflow-y: auto"] {
                scroll-padding-bottom: 240px !important;
                overscroll-behavior-y: contain !important;
              }

              div[style*="padding-bottom: 34px"],
              div[style*="padding-bottom:34px"],
              div[style*="paddingBottom: 34"],
              div[style*="paddingBottom:34"] {
                padding-bottom: 240px !important;
                box-sizing: border-box !important;
              }

              div[style*="padding-bottom: 34px"]::after,
              div[style*="padding-bottom:34px"]::after,
              div[style*="paddingBottom: 34"]::after,
              div[style*="paddingBottom:34"]::after {
                content: "";
                display: block;
                height: 170px;
                min-height: 170px;
                width: 100%;
              }

              [data-rnw-scrollview] > div,
              div[style*="overflow: scroll"] > div,
              div[style*="overflow-y: scroll"] > div,
              div[style*="overflow: auto"] > div,
              div[style*="overflow-y: auto"] > div {
                padding-bottom: 240px !important;
                box-sizing: border-box !important;
              }

              [data-rnw-scrollview] > div::after,
              div[style*="overflow: scroll"] > div::after,
              div[style*="overflow-y: scroll"] > div::after,
              div[style*="overflow: auto"] > div::after,
              div[style*="overflow-y: auto"] > div::after {
                content: "";
                display: block;
                width: 100%;
                height: 170px;
                min-height: 170px;
                flex: 0 0 170px;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
