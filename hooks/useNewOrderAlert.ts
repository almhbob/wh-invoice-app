import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Platform, Vibration } from "react-native";

function showBrowserNotification(count: number) {
  if (Platform.OS !== "web" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("طلب جديد! 🔔", {
      body: `${count} طلب${count > 1 ? " جديدة" : " جديد"} بانتظار المعالجة`,
      icon: "/laviviane-logo.png",
      tag: "new-order",
      renotify: true,
    } as NotificationOptions);
  } catch (_) {}
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
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS !== "web") Vibration.vibrate([0, 120, 80, 120]);
      playWebBeep();
      showBrowserNotification(pendingCount - prevRef.current);
      onNew?.();
    }

    prevRef.current = pendingCount;
  }, [pendingCount, onNew]);

  return { prevCount: prevRef.current };
}
