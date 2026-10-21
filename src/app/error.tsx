"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Habillage « Atmospheric Intelligence » : fond canvas + carte glass
  // (classes utilitaires reproduisant `pn-card`, `ErrorState` étant un client
  // component partagé et déjà habillé en `pn-badge` / `pn-btn` /
  // `pn-btn-secondary`). Props et comportement du error boundary (reset via
  // `retry`) inchangés.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-glass-border bg-surface-glass p-8">
        <ErrorState error={error} retry={retry} />
      </div>
    </div>
  );
}
