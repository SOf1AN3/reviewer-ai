"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  FlaskConical,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b-[3px] border-border bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold uppercase tracking-wider"
        >
          <div className="flex items-center justify-center bg-secondary px-2 sm:px-3 py-1 border-2 border-border shadow-[2px_2px_0px_var(--border)]">
            <FlaskConical className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
          </div>
          <span>PaperNote</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-2">
          {session ? (
            <>
              <Link
                href="/analyser"
                className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs"
              >
                Analyser
              </Link>
              <Link
                href="/historique"
                className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs"
              >
                Historique
              </Link>
              <div className="mx-2 h-6 w-px bg-border" />
              <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="brutal-btn-destructive brutal-btn px-3 py-2 text-xs flex items-center gap-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="brutal-btn-secondary brutal-btn px-4 py-2 text-xs flex items-center gap-1"
              >
                <LogIn className="h-4 w-4" />
                Connexion
              </Link>
              <Link
                href="/register"
                className="brutal-btn px-4 py-2 text-xs"
              >
                Inscription
              </Link>
            </>
          )}
          <button
            onClick={toggleTheme}
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Changer de thème"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </nav>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Changer de thème"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="brutal-btn px-3 py-2 text-xs"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t-[3px] border-border bg-card">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-4">
            {session ? (
              <>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {session.user?.name || session.user?.email}
                </span>
                <Link
                  href="/analyser"
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn-secondary brutal-btn px-4 py-3 text-sm text-center"
                >
                  Analyser
                </Link>
                <Link
                  href="/historique"
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn-secondary brutal-btn px-4 py-3 text-sm text-center"
                >
                  Historique
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="brutal-btn-destructive brutal-btn px-4 py-3 text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn-secondary brutal-btn px-4 py-3 text-sm flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Connexion
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="brutal-btn px-4 py-3 text-sm text-center"
                >
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
