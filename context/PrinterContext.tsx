import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrinterConnectionMode = "browser" | "bluetooth" | "wifi";
export type PaperSize = "80mm" | "58mm" | "a4";
export type PrinterStatus = "idle" | "connecting" | "connected" | "error";

export interface PrinterSettings {
  connectionMode: PrinterConnectionMode;
  paperSize: PaperSize;
  copies: number;
  wifiIp: string;
  wifiPort: string;
  bluetoothDeviceId: string;
  bluetoothDeviceName: string;
  cutPaper: boolean;
  openCashDrawer: boolean;
}

const STORAGE_KEY = "printer_settings_v1";

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  connectionMode: "browser",
  paperSize: "80mm",
  copies: 1,
  wifiIp: "",
  wifiPort: "9100",
  bluetoothDeviceId: "",
  bluetoothDeviceName: "",
  cutPaper: true,
  openCashDrawer: false,
};

// ── ESC/POS command bytes ─────────────────────────────────────────────────────

const ESC = 0x1b;
const GS  = 0x1d;

export const ESCPOS = {
  INIT:          [ESC, 0x40],
  ALIGN_LEFT:    [ESC, 0x61, 0x00],
  ALIGN_CENTER:  [ESC, 0x61, 0x01],
  ALIGN_RIGHT:   [ESC, 0x61, 0x02],
  BOLD_ON:       [ESC, 0x45, 0x01],
  BOLD_OFF:      [ESC, 0x45, 0x00],
  DOUBLE_SIZE:   [GS,  0x21, 0x11],
  NORMAL_SIZE:   [GS,  0x21, 0x00],
  FEED3:         [ESC, 0x64, 0x03],
  CUT_FULL:      [GS,  0x56, 0x42, 0x00],
  CUT_PARTIAL:   [GS,  0x56, 0x42, 0x01],
  CASH_DRAWER:   [ESC, 0x70, 0x00, 0x19, 0xfa],
} as const;

// BLE GATT profiles for common thermal printer brands
const BLE_PROFILES = [
  // Zjiang / XP-series / POS-58 / many OEM 58mm–80mm printers
  { serviceUUID: "000018f0-0000-1000-8000-00805f9b34fb", writeCharUUID: "00002af1-0000-1000-8000-00805f9b34fb" },
  // ISSC Transparent UART (rebranded by many vendors)
  { serviceUUID: "49535343-fe7d-4ae5-8fa9-9fafd205e455", writeCharUUID: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  // Nordic UART Service (nRF5x-based printers)
  { serviceUUID: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", writeCharUUID: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function merge(...parts: (number[] | readonly number[] | Uint8Array)[]): Uint8Array {
  const out: number[] = [];
  for (const p of parts) out.push(...Array.from(p));
  return new Uint8Array(out);
}

export function buildTestReceiptBytes(): Uint8Array {
  const enc = new TextEncoder();
  return merge(
    ESCPOS.INIT,
    ESCPOS.ALIGN_CENTER,
    ESCPOS.BOLD_ON,
    ESCPOS.DOUBLE_SIZE,
    enc.encode("اختبار الطابعة\n"),
    ESCPOS.NORMAL_SIZE,
    ESCPOS.BOLD_OFF,
    enc.encode("--------------------------------\n"),
    enc.encode("Test Print OK ✓\n"),
    enc.encode(`${new Date().toLocaleString("ar-SA")}\n`),
    enc.encode("--------------------------------\n"),
    enc.encode("\n\n\n"),
    ESCPOS.CUT_FULL,
  );
}

// ── Context interface ─────────────────────────────────────────────────────────

export interface PrinterContextType {
  settings: PrinterSettings;
  status: PrinterStatus;
  statusMessage: string;
  bluetoothSupported: boolean;
  updateSettings: (partial: Partial<PrinterSettings>) => Promise<void>;
  connectBluetooth: () => Promise<void>;
  disconnectBluetooth: () => void;
  testWifiConnection: () => Promise<void>;
  testPrint: () => Promise<void>;
  printHtml: (html: string) => void;
  sendBytes: (data: Uint8Array) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [status, setStatus]         = useState<PrinterStatus>("idle");
  const [statusMessage, setMsg]     = useState("");

  const bleDeviceRef = useRef<any>(null);
  const bleCharRef   = useRef<any>(null);

  const bluetoothSupported =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    "bluetooth" in navigator;

  // Persist settings
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try { setSettings({ ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) }); } catch (_) {}
    });
  }, []);

  const updateSettings = useCallback(async (partial: Partial<PrinterSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── Bluetooth ─────────────────────────────────────────────────────────────

  const connectBluetooth = useCallback(async () => {
    if (!bluetoothSupported) throw new Error("Web Bluetooth غير مدعوم — استخدم Chrome أو Edge");
    setStatus("connecting");
    setMsg("جارٍ البحث عن الطابعات...");
    try {
      const bt = (navigator as any).bluetooth;
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PROFILES.map((p) => p.serviceUUID),
      });
      bleDeviceRef.current = device;
      device.addEventListener("gattserverdisconnected", () => {
        bleCharRef.current = null;
        setStatus("idle");
        setMsg("");
        updateSettings({ bluetoothDeviceId: "", bluetoothDeviceName: "" });
      });

      setMsg("جارٍ الاتصال...");
      const server = await device.gatt.connect();
      let paired = false;
      for (const profile of BLE_PROFILES) {
        try {
          const svc  = await server.getPrimaryService(profile.serviceUUID);
          bleCharRef.current = await svc.getCharacteristic(profile.writeCharUUID);
          paired = true;
          break;
        } catch (_) {}
      }
      if (!paired) throw new Error("لم يُعرَّف بروتوكول الطباعة — تحقق من طراز الطابعة");

      const name = device.name || "BLE Printer";
      setStatus("connected");
      setMsg(`متصل: ${name}`);
      await updateSettings({ bluetoothDeviceName: name, bluetoothDeviceId: device.id ?? name });
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message ?? "فشل الاتصال");
      bleCharRef.current = null;
      throw err;
    }
  }, [bluetoothSupported, updateSettings]);

  const disconnectBluetooth = useCallback(() => {
    try { bleDeviceRef.current?.gatt?.disconnect(); } catch (_) {}
    bleCharRef.current  = null;
    bleDeviceRef.current = null;
    setStatus("idle");
    setMsg("");
    updateSettings({ bluetoothDeviceId: "", bluetoothDeviceName: "" });
  }, [updateSettings]);

  // ── WiFi / WebSocket ──────────────────────────────────────────────────────

  const sendViaWifi = useCallback((data: Uint8Array): Promise<void> => {
    return new Promise((resolve, reject) => {
      const ip   = settings.wifiIp.trim();
      const port = settings.wifiPort.trim() || "9100";
      if (!ip) { reject(new Error("أدخل عنوان IP للطابعة")); return; }
      try {
        const ws = new WebSocket(`ws://${ip}:${port}`);
        ws.binaryType = "arraybuffer";
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error("انتهت مهلة الاتصال — تحقق من IP، المنفذ، والشبكة"));
        }, 6000);
        ws.onopen = () => {
          clearTimeout(timer);
          ws.send(data.buffer as ArrayBuffer);
          setTimeout(() => { try { ws.close(); } catch (_) {} resolve(); }, 500);
        };
        ws.onerror = () => { clearTimeout(timer); reject(new Error("تعذّر الاتصال بالطابعة عبر الشبكة")); };
      } catch (err: any) {
        reject(new Error(err?.message ?? "خطأ في إنشاء الاتصال"));
      }
    });
  }, [settings.wifiIp, settings.wifiPort]);

  const testWifiConnection = useCallback(async () => {
    setStatus("connecting");
    setMsg("جارٍ اختبار الاتصال...");
    try {
      await sendViaWifi(new Uint8Array([...ESCPOS.INIT, ...ESCPOS.FEED3]));
      setStatus("connected");
      setMsg(`الاتصال ناجح ✓  ${settings.wifiIp}:${settings.wifiPort}`);
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message ?? "فشل الاتصال");
      throw err;
    }
  }, [sendViaWifi, settings.wifiIp, settings.wifiPort]);

  // ── Generic send ──────────────────────────────────────────────────────────

  const sendBytes = useCallback(async (data: Uint8Array) => {
    if (settings.connectionMode === "bluetooth") {
      if (!bleCharRef.current) throw new Error("الطابعة غير متصلة عبر البلوتوث");
      const CHUNK = 20; // BLE MTU safe chunk
      for (let i = 0; i < data.length; i += CHUNK) {
        await bleCharRef.current.writeValue(data.slice(i, i + CHUNK));
        await new Promise((r) => setTimeout(r, 20));
      }
    } else if (settings.connectionMode === "wifi") {
      await sendViaWifi(data);
    }
    // "browser" mode has no raw bytes path — use printHtml instead
  }, [settings.connectionMode, sendViaWifi]);

  const testPrint = useCallback(async () => {
    const bytes = buildTestReceiptBytes();
    const extra = settings.openCashDrawer ? new Uint8Array(ESCPOS.CASH_DRAWER) : new Uint8Array(0);
    await sendBytes(merge(bytes, extra));
  }, [sendBytes, settings.openCashDrawer]);

  // ── Browser HTML print (with paper size injection) ────────────────────────

  const printHtml = useCallback((html: string) => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const pageCss =
      settings.paperSize === "a4"
        ? "@page { size: A4; margin: 10mm; }"
        : `@page { size: ${settings.paperSize} auto; margin: 2mm 3mm; }`;
    const styledHtml = html.replace(/@page\s*\{[^}]*\}/, pageCss);

    const id = "__print_overlay__";
    document.getElementById(id)?.remove();

    const overlay = document.createElement("div");
    overlay.id = id;
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.75)",
      zIndex: "99999", display: "flex", alignItems: "center", justifyContent: "center",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#fff", borderRadius: "16px", overflow: "hidden",
      maxWidth: "640px", width: "95%", maxHeight: "90vh",
      display: "flex", flexDirection: "column",
    });

    const frame = document.createElement("iframe");
    Object.assign(frame.style, { flex: "1", border: "none", minHeight: "450px" });
    frame.srcdoc = styledHtml;

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "10px", padding: "12px", borderTop: "1px solid #e5e7eb" });

    const mkBtn = (text: string, bg: string, color = "#fff") => {
      const b = document.createElement("button");
      b.textContent = text;
      Object.assign(b.style, {
        flex: "1", padding: "12px", background: bg, color, border: "none",
        borderRadius: "10px", fontSize: "15px", cursor: "pointer",
        fontFamily: "inherit", fontWeight: "700",
      });
      return b;
    };

    const printBtn = mkBtn("🖨 طباعة", "#1A2744");
    printBtn.onclick = () => frame.contentWindow?.print();
    const closeBtn = mkBtn("✕ إغلاق", "#e5e7eb", "#374151");
    closeBtn.onclick = () => overlay.remove();

    btnRow.append(printBtn, closeBtn);
    box.append(frame, btnRow);
    overlay.append(box);
    document.body.append(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }, [settings.paperSize]);

  const value = useMemo<PrinterContextType>(() => ({
    settings, status, statusMessage, bluetoothSupported,
    updateSettings, connectBluetooth, disconnectBluetooth,
    testWifiConnection, testPrint, printHtml, sendBytes,
  }), [
    settings, status, statusMessage, bluetoothSupported,
    updateSettings, connectBluetooth, disconnectBluetooth,
    testWifiConnection, testPrint, printHtml, sendBytes,
  ]);

  return <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>;
}

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error("usePrinter must be inside PrinterProvider");
  return ctx;
}
