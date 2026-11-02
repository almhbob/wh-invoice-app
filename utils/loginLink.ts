import { PRODUCTION_API_BASE, STAGING_API_BASE } from "@/lib/apiBase";

/**
 * The address people outside this device can open. A link copied from a dev
 * preview (Replit, localhost, a one-off Cloudflare preview) would not work for the
 * person receiving it, so only the staging site keeps its own address.
 */
export function shareableAppBase(currentOrigin?: string): string {
  try {
    const host = currentOrigin ? new URL(currentOrigin).hostname.toLowerCase() : "";
    if (host === "fotra-staging.pages.dev") return STAGING_API_BASE;
  } catch { /* fall through */ }
  return PRODUCTION_API_BASE;
}

export function employeeLoginLink(companyId: string, username: string, currentOrigin?: string): string {
  const q = new URLSearchParams({ company: companyId });
  if (username) q.set("user", username);
  return `${shareableAppBase(currentOrigin)}/?${q.toString()}`;
}

export function employeeLoginMessage(p: {
  name: string; companyName: string; companyId: string; username: string; currentOrigin?: string; lang: "ar" | "en";
}): string {
  const link = employeeLoginLink(p.companyId, p.username, p.currentOrigin);
  if (p.lang === "en") {
    return [
      `Hello ${p.name},`,
      `Your Fawtara account for ${p.companyName} is ready. Open this link to sign in:`,
      link,
      `Username: ${p.username}`,
      "Your PIN will be sent to you separately. You'll be asked to choose your own PIN the first time you sign in.",
    ].join("\n");
  }
  return [
    `مرحباً ${p.name}،`,
    `حسابك في نظام فوترة لـ ${p.companyName} جاهز. افتح الرابط لتسجيل الدخول:`,
    link,
    `اسم المستخدم: ${p.username}`,
    "رمز الدخول يصلك من المسؤول بشكل منفصل، وسيُطلب منك اختيار رمزك الخاص عند أول دخول.",
  ].join("\n");
}
