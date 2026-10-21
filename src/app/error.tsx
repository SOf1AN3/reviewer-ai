"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Habillage « Atmospheric Intelligence » : fond canvas + centrage.
  // `ErrorState` rend sa propre carte `pn-card` (avec halo décoratif), donc
  // aucun wrapper carte ici — évite une carte imbriquée (double bordure,
  // halo atténué). Props et comportement du error boundary (reset via
  // `retry`, bouton géré par `ErrorState`) inchangés.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ErrorState error={error} retry={retry} />
    </div>
  );
}
