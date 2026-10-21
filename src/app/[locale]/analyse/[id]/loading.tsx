/**
 * État de chargement de premier rendu (App Router `loading.tsx`) pour
 * `/[locale]/analyse/[id]`. Squelette sobre cohérent avec le design system
 * (cartes `pn-card`, fondus pulsants sur les surfaces glass).
 */
export default function AnalyseLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="container mx-auto px-4 py-8"
    >
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-10 w-48 rounded-lg bg-surface-container-low" />
        <div className="pn-card rounded-xl p-6">
          <div className="mb-4 h-7 w-2/3 rounded bg-surface-container-low" />
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded-full bg-surface-container-low" />
            <div className="h-6 w-32 rounded-full bg-surface-container-low" />
            <div className="h-6 w-28 rounded-full bg-surface-container-low" />
          </div>
        </div>
        <div className="pn-card rounded-xl p-6">
          <div className="mb-4 h-6 w-40 rounded bg-surface-container-low" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-surface-container-low" />
            <div className="h-4 w-5/6 rounded bg-surface-container-low" />
            <div className="h-4 w-4/6 rounded bg-surface-container-low" />
          </div>
        </div>
      </div>
    </div>
  );
}
