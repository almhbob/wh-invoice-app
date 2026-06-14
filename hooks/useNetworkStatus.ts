import { useEffect, useState } from "react";
import { Platform } from "react-native";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
