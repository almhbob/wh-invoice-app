import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * USB / Bluetooth barcode scanners act as keyboards: they "type" the code very fast
 * and press Enter. This listens on the page (web) and reports such bursts, so the
 * cashier can scan without first tapping the scan box.
 *
 * Keys typed into a text field are left alone (normal typing), except a field marked
 * with data-scan-target="true" (the scan box handles its own Enter).
 */
const MAX_GAP_MS = 45;   // scanners send keys a few ms apart; people are far slower
const MIN_LENGTH = 4;

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled || Platform.OS !== "web" || typeof window === "undefined") return;
    let buf = "";
    let last = 0;

    const isTextField = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextField(e.target)) return;
      const now = performance.now();
      if (now - last > MAX_GAP_MS) buf = "";
      last = now;
      if (e.key === "Enter" || e.key === "Tab") {
        if (buf.length >= MIN_LENGTH) {
          e.preventDefault();
          const code = buf;
          buf = "";
          cb.current(code);
        }
        buf = "";
        return;
      }
      if (e.key.length === 1) buf += e.key;
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
