/**
 * État de chargement de premier rendu (App Router `loading.tsx`) pour
 * `/[locale]/analyse/[id]`. Squelette sobre cohérent avec l'esthétique
 * brutale du projet (bordures nettes, fondus pulsants).
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
        <div className="h-10 w-48 border-2 border-border bg-muted" />
        <div className="border-2 border-border bg-card p-6 shadow-[2px_2px_0px_var(--border)]">
          <div className="mb-4 h-7 w-2/3 bg-muted" />
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-muted" />
            <div className="h-6 w-32 bg-muted" />
            <div className="h-6 w-28 bg-muted" />
          </div>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-[2px_2px_0px_var(--border)]">
          <div className="mb-4 h-6 w-40 bg-muted" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-muted" />
            <div className="h-4 w-5/6 bg-muted" />
            <div className="h-4 w-4/6 bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
