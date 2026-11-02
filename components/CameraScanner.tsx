import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { tr } from "@/lib/i18n";

/**
 * Camera barcode reader (web): uses the browser's built-in BarcodeDetector when it
 * exists (Chrome/Android), otherwise loads the ZXing reader (Safari/iPhone, Firefox).
 * Calls onDetected for each new code; with `continuous` the camera stays open so the
 * cashier can scan item after item.
 */

const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
const REPEAT_MS = 1500;

type Status = "starting" | "scanning" | "denied" | "nocamera" | "insecure" | "error";

let zxingPromise: Promise<any> | null = null;
function loadZxing(): Promise<any> {
  const w = window as any;
  if (w.ZXing) return Promise.resolve(w.ZXing);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ZXING_URL;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = () => (w.ZXing ? resolve(w.ZXing) : reject(new Error("zxing")));
      s.onerror = () => { zxingPromise = null; reject(new Error("zxing")); };
      document.head.appendChild(s);
    });
  }
  return zxingPromise;
}

function beep() {
  try {
    const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 1760;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(); o.stop(ctx.currentTime + 0.13);
    setTimeout(() => ctx.close().catch(() => undefined), 300);
  } catch { /* no audio */ }
}

export function CameraScanner({
  visible, onClose, onDetected, continuous = false, title,
}: {
  visible: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  continuous?: boolean;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [last, setLast] = useState("");
  const cb = useRef(onDetected);
  cb.current = onDetected;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let reader: any = null;
    const seen = new Map<string, number>();
    setStatus("starting");
    setLast("");

    const hit = (raw: string) => {
      const code = String(raw ?? "").trim();
      if (!code || stopped) return;
      const now = Date.now();
      if ((seen.get(code) ?? 0) > now - REPEAT_MS) return;
      seen.set(code, now);
      beep();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setLast(code);
      cb.current(code);
      if (!continuous) closeRef.current();
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setStatus("insecure"); return; }
      const Detector = (window as any).BarcodeDetector;
      try {
        if (Detector) {
          const supported: string[] = (await Detector.getSupportedFormats?.()) ?? FORMATS;
          const detector = new Detector({ formats: FORMATS.filter((f) => supported.includes(f)) });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped) return;
          const v = videoRef.current!;
          v.srcObject = stream;
          await v.play().catch(() => undefined);
          setStatus("scanning");
          timer = setInterval(async () => {
            if (stopped || v.readyState < 2) return;
            try {
              const found = await detector.detect(v);
              if (found?.[0]?.rawValue) hit(found[0].rawValue);
            } catch { /* frame not ready */ }
          }, 200);
        } else {
          const ZXing = await loadZxing();
          if (stopped) return;
          reader = new ZXing.BrowserMultiFormatReader();
          await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            videoRef.current!,
            (result: any) => { if (result) hit(result.getText()); }
          );
          if (!stopped) setStatus("scanning");
        }
      } catch (e: any) {
        if (stopped) return;
        const name = e?.name ?? "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "error");
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      try { reader?.reset(); } catch { /* ignore */ }
      stream?.getTracks().forEach((t) => t.stop());
      const v = videoRef.current;
      const s = v?.srcObject as MediaStream | null;
      s?.getTracks?.().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    };
  }, [visible, continuous]);

  const message: Record<Exclude<Status, "scanning">, string> = {
    starting: tr("جارٍ تشغيل الكاميرا…", "Starting camera…"),
    denied: tr("لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات المتصفح، أو اكتب الرقم يدوياً.", "Camera permission denied. Allow it in the browser settings, or type the code."),
    nocamera: tr("لا توجد كاميرا متاحة على هذا الجهاز. استخدم قارئ الباركود أو اكتب الرقم.", "No camera found. Use a barcode scanner or type the code."),
    insecure: tr("الكاميرا تحتاج اتصالاً آمناً (https). استخدم قارئ الباركود أو اكتب الرقم.", "The camera needs a secure (https) connection. Use a scanner or type the code."),
    error: tr("تعذّر تشغيل قارئ الكاميرا. استخدم قارئ الباركود أو اكتب الرقم.", "Could not start the camera reader. Use a scanner or type the code."),
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>{title ?? tr("مسح الباركود بالكاميرا", "Scan with camera")}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={tr("إغلاق", "Close")}>
              <Feather name="x" size={20} color="#fff" />
            </Pressable>
          </View>

          {Platform.OS === "web" ? (
            <View style={s.stage}>
              {React.createElement("video", {
                ref: videoRef,
                playsInline: true,
                muted: true,
                autoPlay: true,
                style: { width: "100%", height: "100%", objectFit: "cover", background: "#000" },
              })}
              {status === "scanning" && (
                <View pointerEvents="none" style={s.frameWrap}>
                  <View style={s.frame} />
                </View>
              )}
              {status !== "scanning" && (
                <View style={s.overlay}>
                  {status === "starting" ? <ActivityIndicator color="#fff" /> : <Feather name="camera-off" size={28} color="#fff" />}
                  <Text style={s.overlayTxt}>{message[status]}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[s.stage, s.center]}>
              <Feather name="camera-off" size={28} color="#fff" />
              <Text style={s.overlayTxt}>{tr("المسح بالكاميرا متاح من المتصفح. استخدم قارئ الباركود أو اكتب الرقم.", "Camera scanning works in the browser. Use a scanner or type the code.")}</Text>
            </View>
          )}

          <Text style={s.hint}>
            {last
              ? tr("تمت القراءة: ", "Read: ") + last
              : tr("وجّه الكاميرا إلى الباركود داخل الإطار", "Point the camera at the barcode inside the frame")}
          </Text>
          {continuous && (
            <Pressable style={s.done} onPress={onClose}>
              <Text style={s.doneTxt}>{tr("تم", "Done")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: Colors.espressoMid, borderRadius: 24, padding: 16, gap: 12 },
  head: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  stage: { width: "100%", aspectRatio: 3 / 4, maxHeight: 520, borderRadius: 18, overflow: "hidden", backgroundColor: "#000" },
  frameWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  frame: { width: "78%", height: "34%", borderRadius: 16, borderWidth: 3, borderColor: Colors.goldLight },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  overlayTxt: { color: "#fff", fontSize: 14, textAlign: "center", lineHeight: 22 },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center" },
  done: { backgroundColor: Colors.gold, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  doneTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
