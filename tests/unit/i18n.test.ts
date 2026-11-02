import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { UI_DICTIONARY } from "../../constants/uiDictionary";
import { setCurrentLang, tr, trf } from "../../lib/i18n";

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

describe("i18n", () => {
  test("tr picks the active language and falls back to English", () => {
    setCurrentLang("ar");
    expect(tr("إغلاق", "Close")).toBe("إغلاق");
    setCurrentLang("en");
    expect(tr("إغلاق", "Close")).toBe("Close");
    setCurrentLang("ur");
    expect(tr("إغلاق", "Close")).toBe("بند کریں");
    setCurrentLang("bn");
    expect(tr("نص غير مترجم", "Untranslated")).toBe("Untranslated");
    setCurrentLang("hi");
    expect(trf("{p0} طلب بانتظارك", "{p0} deliveries waiting", { p0: 3 })).toBe("3 ऑर्डर आपकी प्रतीक्षा में");
    setCurrentLang("ar");
  });

  test("every Arabic tr()/trf() text in the app has Urdu, Hindi and Bengali", () => {
    const root = join(import.meta.dir, "../..");
    const files = ["app", "components", "utils"].flatMap((d) => walk(join(root, d)));
    const missing = new Set<string>();
    const re = /\btrf?\(\s*"((?:[^"\\]|\\.)*)"/g;
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(re)) {
        const ar = m[1];
        if (!/[؀-ۿ]/.test(ar)) continue;
        const e = UI_DICTIONARY[ar];
        if (!e?.ur || !e?.hi || !e?.bn) missing.add(ar);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
