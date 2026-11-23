import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "shortlist.theme";

export const THEMES: Array<{
  value: ThemeChoice;
  icon: "sun" | "monitor" | "moon";
  label: string;
}> = [
  { value: "light", icon: "sun", label: "Light theme" },
  { value: "system", icon: "monitor", label: "Match system theme" },
  { value: "dark", icon: "moon", label: "Dark theme" },
];

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [theme, setTheme] = useState<ThemeChoice>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      return;
    }
  }, [theme]);

  const choose = useCallback((choice: ThemeChoice) => setTheme(choice), []);
  return [theme, choose];
}
