import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Platform, Vibration } from "react-native";

let lastBellAt = 0;

/**
 * One shared bell for the whole app: sound + system notification + haptics.
 * Throttled so the global watcher and a screen's own alert never double-ring.
 */
export function ringAlert(title: string, body: string, tag = "new-order") {
  const now = Date.now();
  if (now - lastBellAt < 2500) return;
  lastBellAt = now;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  if (Platform.OS !== "web") Vibration.vibrate([0, 120, 80, 120]);
  playWebBeep();
  if (Platform.OS !== "web" || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/laviviane-logo.png", tag, renotify: true } as NotificationOptions);
  } catch (_) {}
}

function showBrowserNotification(count: number) {
  ringAlert("طلب جديد! 🔔", `${count} طلب${count > 1 ? " جديدة" : " جديد"} بانتظار المعالجة`);
}

function playWebBeep() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.62);
    setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch (_) {}
}

/**
 * Fires a haptic + vibration alert when the number of pending orders for a
 * department increases (i.e. a new order just arrived).
 *
 * Returns { hasNew, clearNew } so the caller can show/hide a banner.
 */
export function useNewOrderAlert(
  pendingCount: number,
  onNew?: () => void
): { prevCount: number } {
  const prevRef = useRef(pendingCount);
  const mountedRef = useRef(false);

  // Request browser notification permission once on mount (web only)
  useEffect(() => {
    if (Platform.OS === "web" && typeof Notification !== "undefined") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Skip the very first render — we don't want to alert on initial load
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = pendingCount;
      return;
    }

    if (pendingCount > prevRef.current) {
      showBrowserNotification(pendingCount - prevRef.current);
      onNew?.();
    }

    prevRef.current = pendingCount;
  }, [pendingCount, onNew]);

  return { prevCount: prevRef.current };
}
