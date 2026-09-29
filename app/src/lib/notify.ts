import { Alert, Platform } from "react-native";

/**
 * Shows a message box. React Native's Alert does nothing in a web browser,
 * which is how Silver Vault runs on the iPhone, so use the browser's own there.
 */
export function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
