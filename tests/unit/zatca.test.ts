import { describe, expect, test } from "bun:test";
import {
  decodeZatcaQr, isValidVatNumber, normalizeTaxProfile, taxProfileError, vatBreakdown, zatcaQrPayload, zatcaTimestamp,
} from "../../utils/zatca";

describe("ZATCA simplified tax invoice", () => {
  test("VAT number: 15 digits, starts and ends with 3, Arabic digits accepted", () => {
    expect(isValidVatNumber("310122393500003")).toBe(true);
    expect(isValidVatNumber("٣١٠١٢٢٣٩٣٥٠٠٠٠٣")).toBe(true);
    expect(isValidVatNumber("310122393500004")).toBe(false);
    expect(isValidVatNumber("31012239350003")).toBe(false);
  });

  test("VAT is extracted from VAT-inclusive prices; deposits stay outside", () => {
    expect(vatBreakdown(115)).toEqual({ totalWithVat: 115, vat: 15, totalWithoutVat: 100, deposit: 0 });
    expect(vatBreakdown(165, 50)).toEqual({ totalWithVat: 115, vat: 15, totalWithoutVat: 100, deposit: 50 });
    const b = vatBreakdown(99.99);
    expect(b.vat).toBe(13.04);
    expect(Math.round((b.totalWithoutVat + b.vat) * 100) / 100).toBe(99.99);
    expect(vatBreakdown(20, 50).totalWithVat).toBe(0);
  });

  test("QR encodes the five required fields as TLV (official ZATCA sample)", () => {
    const qr = zatcaQrPayload({
      sellerName: "Bobs Records", vatNumber: "310122393500003",
      timestamp: "2022-04-25T15:30:00Z", totalWithVat: 1000, vat: 150,
    });
    expect(qr).toBe("AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==");
  });

  test("Arabic seller names round-trip as UTF-8", () => {
    const qr = zatcaQrPayload({ sellerName: "لافيفيان للحلويات", vatNumber: "310122393500003", timestamp: new Date("2026-11-01T06:00:00.123Z"), totalWithVat: 57.5, vat: 7.5 });
    expect(decodeZatcaQr(qr)).toEqual({ 1: "لافيفيان للحلويات", 2: "310122393500003", 3: "2026-11-01T06:00:00Z", 4: "57.50", 5: "7.50" });
    expect(zatcaTimestamp("bad").endsWith("Z")).toBe(true);
  });

  test("profile validation only applies when enabled", () => {
    expect(taxProfileError(normalizeTaxProfile({ enabled: false }))).toBeNull();
    expect(taxProfileError(normalizeTaxProfile({ enabled: true, vatNumber: "310122393500003" }))).toBe("seller_required");
    expect(taxProfileError(normalizeTaxProfile({ enabled: true, sellerName: "x", vatNumber: "123" }))).toBe("vat_invalid");
    expect(taxProfileError(normalizeTaxProfile({ enabled: true, sellerName: "x", vatNumber: "310 1223 9350 0003" }))).toBeNull();
  });
});
