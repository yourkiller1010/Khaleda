"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const stored = localStorage.getItem("kb-theme") as Theme | null;
      const next = stored ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      setTheme(next);
      document.documentElement.classList.toggle("light", next === "light");
      document.documentElement.classList.toggle("dark", next === "dark");
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("kb-theme", next);
      document.documentElement.classList.toggle("light", next === "light");
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  const t = useTranslations("common");
  return <button type="button" className="icon-btn" onClick={toggle} aria-label={t("theme")} title={theme === "dark" ? t("light") : t("dark")}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>;
}
