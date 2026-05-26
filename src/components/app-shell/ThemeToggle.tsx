import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light";
const STORAGE_KEY = "radiant.theme";

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.toggle("dark", t === "dark");
  html.classList.toggle("light", t === "light");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let initial: Theme = "dark";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === "dark" || saved === "light") initial = saved;
      else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) initial = "light";
    } catch {}
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  };

  return { theme, setTheme: set, toggle: () => set(theme === "dark" ? "light" : "dark") };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
