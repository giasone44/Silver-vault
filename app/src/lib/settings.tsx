import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";

export type Settings = {
  serverUrl: string;
  token: string;
  /** How often to refresh spot prices, in seconds. */
  spotRefreshSeconds: number;
};

// On the desktop web build the server hosts the app, so its own origin is the API
// (8081 is the Expo dev server, which does not).
const defaultServer =
  Platform.OS === "web" && typeof window !== "undefined" && window.location.port !== "8081"
    ? window.location.origin
    : "http://localhost:8787";

const DEFAULTS: Settings = { serverUrl: defaultServer, token: "", spotRefreshSeconds: 30 };
const KEY = "silver-vault-settings";

type Ctx = { settings: Settings; loaded: boolean; save: (s: Settings) => Promise<void> };
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async (s: Settings) => {
    const clean = { ...s, serverUrl: s.serverUrl.trim().replace(/\/+$/, ""), token: s.token.trim() };
    setSettings(clean);
    await AsyncStorage.setItem(KEY, JSON.stringify(clean));
  };

  // Hold rendering until stored settings are read so no screen starts with defaults.
  if (!loaded) return null;
  return <SettingsContext.Provider value={{ settings, loaded, save }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
