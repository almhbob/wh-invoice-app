import { Alert, Platform } from "react-native";

/** Show a simple alert on native and web. React Native Web's Alert.alert is a no-op. */
export function showPlatformAlert(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert([title, message].filter(Boolean).join("\n\n"));
    return;
  }

  Alert.alert(title, message);
}
