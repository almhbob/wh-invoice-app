import { ORDER_PAGE_HTML } from "../../server/orderPage";

export const onRequestGet = () =>
  new Response(ORDER_PAGE_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
