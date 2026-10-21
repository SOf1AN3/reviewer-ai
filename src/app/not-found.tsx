import { ErrorState } from "@/components/ErrorState";

// Root not-found: handles unmatched URLs for the whole app. The [locale]
// layout (I18nProvider) may or may not wrap it; ErrorState resolves the
// locale from the URL and falls back to "fr" when no context is available.
//
// Habillage « Atmospheric Intelligence » : fond canvas + carte glass
// (classes utilitaires reproduisant `pn-card`, `ErrorState` étant un client
// component partagé et déjà habillé en `pn-badge` / `pn-btn` /
// `pn-btn-secondary`). Logique et props inchangées.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-glass-border bg-surface-glass p-8">
        <ErrorState kind="notFound" />
      </div>
    </div>
  );
}
