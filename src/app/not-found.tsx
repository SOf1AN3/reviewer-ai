import { ErrorState } from "@/components/ErrorState";

// Root not-found: handles unmatched URLs for the whole app. The [locale]
// layout (I18nProvider) may or may not wrap it; ErrorState resolves the
// locale from the URL and falls back to "fr" when no context is available.
//
// Habillage « Atmospheric Intelligence » : fond canvas + centrage.
// `ErrorState` rend sa propre carte `pn-card` (avec halo décoratif), donc
// aucun wrapper carte ici — évite une carte imbriquée (double bordure,
// halo atténué). Logique et props inchangées.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ErrorState kind="notFound" />
    </div>
  );
}
