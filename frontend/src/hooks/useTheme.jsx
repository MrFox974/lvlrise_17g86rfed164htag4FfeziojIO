import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'lvlrise-theme';
const THEMES = ['dark', 'light'];

/** Couleur de la barre navigateur mobile, alignée sur --om-bg. */
const THEME_COLOR = { dark: '#161826', light: '#f3f5fe' };

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) return stored;
  } catch {
    /* localStorage indisponible (mode privé) : on retombe sur le défaut */
  }
  return 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR.light);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* pas de persistance possible : le thème reste valable pour la session */
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(THEMES.includes(next) ? next : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Applique le thème avant le premier rendu pour éviter tout flash. */
export function initThemeBeforeRender() {
  applyTheme(readStoredTheme());
}
