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

              [data-rnw-scrollview] {
                scroll-padding-bottom: 150px !important;
              }

              [data-rnw-scrollview] > div {
                padding-bottom: max(150px, env(safe-area-inset-bottom)) !important;
                box-sizing: border-box !important;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
