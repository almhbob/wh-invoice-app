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
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html,
              body,
              #root {
                min-height: 100%;
                background: #f6f8fb;
              }

              body {
                overscroll-behavior-y: contain;
              }

              [data-rnw-scrollview],
              div[style*="overflow: scroll"],
              div[style*="overflow-y: scroll"],
              div[style*="overflow: auto"],
              div[style*="overflow-y: auto"] {
                scroll-padding-bottom: 190px !important;
              }

              [data-rnw-scrollview] > div,
              div[style*="overflow: scroll"] > div,
              div[style*="overflow-y: scroll"] > div,
              div[style*="overflow: auto"] > div,
              div[style*="overflow-y: auto"] > div {
                padding-bottom: 190px !important;
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
                height: 120px;
                flex: 0 0 120px;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
