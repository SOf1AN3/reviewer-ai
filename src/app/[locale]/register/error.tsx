"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RegisterError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState error={error} retry={retry} />;
}
