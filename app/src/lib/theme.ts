import { Platform } from "react-native";

export const colors = {
  bg: "#0E1116",
  card: "#171B22",
  cardAlt: "#1F242D",
  border: "#2A303B",
  text: "#EDEFF2",
  muted: "#8B93A1",
  silver: "#C9CED6",
  gold: "#E0B84F",
  accent: "#7FB4FF",
  up: "#4CC38A",
  down: "#F06A6A",
  danger: "#F06A6A",
};

export const radius = 12;

// Native-stack headers on web put right-side buttons flush against the edge.
export const headerRightPad = Platform.OS === "web" ? 16 : 0;
