import { ErrorState } from "@/components/ErrorState";

// Root not-found: handles unmatched URLs for the whole app. The [locale]
// layout (I18nProvider) may or may not wrap it; ErrorState resolves the
// locale from the URL and falls back to "fr" when no context is available.
export default function NotFound() {
  return <ErrorState kind="notFound" />;
}
