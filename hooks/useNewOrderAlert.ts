import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Platform, Vibration } from "react-native";

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
      onNew?.();
    }

    prevRef.current = pendingCount;
  }, [pendingCount, onNew]);

  return { prevCount: prevRef.current };
}
