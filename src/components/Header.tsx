"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { FlaskConical, Sun, Moon, LogOut, LogIn } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();

  return (
    <header className="border-b-[3px] border-border bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-bold uppercase tracking-wider"
        >
          <div className="flex items-center justify-center bg-secondary px-3 py-1 border-2 border-border shadow-[2px_2px_0px_var(--border)]">
            <FlaskConical className="h-5 w-5 text-foreground" />
          </div>
          <span>PaperLens</span>
        </Link>
        <nav className="flex items-center gap-2">
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
              <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
              <span className="hidden sm:inline-flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
      </div>
    </header>
  );
}
