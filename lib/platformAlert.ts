import { Alert, Platform } from "react-native";

/** Show a simple alert on native and web. React Native Web's Alert.alert is a no-op. */
export function showPlatformAlert(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert([title, message].filter(Boolean).join("\n\n"));
    return;
  }

  Alert.alert(title, message);
}

/**
 * Ask for confirmation on native and web. Resolves true only when the user
 * explicitly confirms — never auto-confirms where no dialog is available.
 */
export function confirmPlatform(title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return Promise.resolve(window.confirm([title, message].filter(Boolean).join("\n\n")));
    }
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
