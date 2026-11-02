import { describe, expect, test } from "bun:test";
import {
  barcodeWarning, codeConflict, findProductByCode, generateInternalBarcode, isValidGtin, normalizeCode, parseScanInput, searchProducts,
} from "../../utils/productCodes";

const products = [
  { id: "a", name: "كيك فانيلا", barcode: "6281000000120", sku: "CK-01", isAvailable: true },
  { id: "b", name: "معمول تمر", sku: "hl-22", isAvailable: true },
  { id: "c", name: "كيك شوكولاتة", barcode: "2000000000015", isAvailable: false },
];

describe("product codes", () => {
  test("normalizes Arabic digits, spaces, dashes and case", () => {
    expect(normalizeCode(" ٦٢٨١ ٠٠٠-٠٠٠ ١٢٠ ")).toBe("6281000000120");
    expect(normalizeCode("hl-22")).toBe("HL22");
  });

  test("quantity prefix", () => {
    expect(parseScanInput("3*6281000000120")).toEqual({ code: "6281000000120", qty: 3 });
    expect(parseScanInput("٢×hl-22")).toEqual({ code: "HL22", qty: 2 });
    expect(parseScanInput("6281000000120")).toEqual({ code: "6281000000120", qty: 1 });
  });

  test("GS1 check digit", () => {
    expect(isValidGtin("6281000000120")).toBe(true);
    expect(isValidGtin("6281000000127")).toBe(false);
    expect(isValidGtin("96385074")).toBe(true); // EAN-8
    expect(barcodeWarning("6281000000127")).toBe("check_digit");
    expect(barcodeWarning("CK-01")).toBeNull();
  });

  test("finds by barcode first, then SKU, however typed", () => {
    expect(findProductByCode(products, "6281 0000 00120")?.id).toBe("a");
    expect(findProductByCode(products, "HL 22")?.id).toBe("b");
    expect(findProductByCode(products, "ck01")?.id).toBe("a");
    expect(findProductByCode(products, "999")).toBeNull();
  });

  test("suggestions rank exact codes, then prefixes, then names; unavailable last", () => {
    expect(searchProducts(products, "62810").map((p) => p.id)).toEqual(["a"]);
    expect(searchProducts(products, "كيك").map((p) => p.id)).toEqual(["a", "c"]);
  });

  test("internal barcodes are valid EAN-13 in the 2x range and unique", () => {
    const code = generateInternalBarcode(["2000000000015"], 1);
    expect(code).toHaveLength(13);
    expect(code.startsWith("20")).toBe(true);
    expect(isValidGtin(code)).toBe(true);
    expect(code).not.toBe("2000000000015");
  });

  test("conflicts ignore the product being edited", () => {
    expect(codeConflict(products, "a", "6281000000120")).toBeNull();
    expect(codeConflict(products, "b", "6281000000120")?.id).toBe("a");
    expect(codeConflict(products, undefined, "HL22")?.id).toBe("b");
  });
});
