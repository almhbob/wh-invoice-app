import { TRACK_PAGE_HTML } from "../server/trackPage";

export const onRequestGet = () =>
  new Response(TRACK_PAGE_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
