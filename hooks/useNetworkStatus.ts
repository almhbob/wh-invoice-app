import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Network from "expo-network";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    let active = true;
    const applyNetworkState = (state: Network.NetworkState) => {
      if (!active) return;
      setIsOnline(state.isInternetReachable ?? state.isConnected ?? false);
    };

    Network.getNetworkStateAsync().then(applyNetworkState).catch(() => {
      if (active) setIsOnline(false);
    });
    const subscription = Network.addNetworkStateListener(applyNetworkState);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return isOnline;
}
