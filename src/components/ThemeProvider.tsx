"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "papernote-theme";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Thème persisté en `localStorage` (`papernote-theme`), exposé comme store
 * externe via `useSyncExternalStore` :
 *
 * - Le thème par défaut est **sombre** : `getServerSnapshot` renvoie `"dark"`
 *   et le layout rend la classe `dark` sur `<html>` — serveur et client
 *   concordent dès l'hydratation, donc aucun flash de thème clair.
 * - `getSnapshot` : un choix explicite stocké (`light` ou `dark`) prime ;
 *   sinon repli sur `"dark"`. La préférence système
 *   (`prefers-color-scheme`) n'est plus écoutée, le défaut n'étant plus
 *   « système ».
 * - `subscribe` n'écoute que `storage` : le toggle reste propagé aux autres
 *   onglets de la même origine.
 *
 * API publique inchangée : `useTheme()` renvoie `{ theme, toggleTheme }`.
 */
const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Propagation du toggle aux autres onglets ; `prefers-color-scheme` n'est
  // plus écouté : le thème par défaut n'est plus celui du système.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function getSnapshot(): Theme {
  const stored = readStoredTheme();
  // Choix explicite de l'utilisateur > thème sombre par défaut.
  return stored ?? "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Synchronise le DOM (classe `dark`) avec l'état : premier rendu après
  // hydratation, toggle, ou changement externe (autre onglet). Par défaut
  // l'état est `dark`, donc la classe rendue par le serveur n'est jamais
  // retirée — elle ne l'est que sur un choix explicite `light`.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
    emitChange();
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
