import { describe, expect, test } from "bun:test";
import { employeeLoginLink, employeeLoginMessage, shareableAppBase } from "../../utils/loginLink";

describe("employee login links", () => {
  test("links never point at a dev preview", () => {
    expect(shareableAppBase("https://abc-123.picard.replit.dev")).toBe("https://fotra-dv1.pages.dev");
    expect(shareableAppBase("http://localhost:8081")).toBe("https://fotra-dv1.pages.dev");
    expect(shareableAppBase("https://3f2a.fotra-dv1.pages.dev")).toBe("https://fotra-dv1.pages.dev");
    expect(shareableAppBase(undefined)).toBe("https://fotra-dv1.pages.dev");
    expect(shareableAppBase("https://fotra-staging.pages.dev")).toBe("https://fotra-staging.pages.dev");
  });

  test("link selects the company and prefills the username", () => {
    expect(employeeLoginLink("laviviane-trial", "sara.k")).toBe("https://fotra-dv1.pages.dev/?company=laviviane-trial&user=sara.k");
  });

  test("message carries the link and username but never a PIN", () => {
    const m = employeeLoginMessage({ name: "سارة", companyName: "لاففيان", companyId: "laviviane-trial", username: "sara", lang: "ar" });
    expect(m).toContain("https://fotra-dv1.pages.dev/?company=laviviane-trial&user=sara");
    expect(m).toContain("اسم المستخدم: sara");
    expect(m).not.toMatch(/\b\d{4,8}\b/);
  });
});
