import { FhirError } from './client';

/** Plain message safe to return from server actions (production strips custom error types). */
export function formatFhirActionError(err: unknown, fallback: string): string {
  if (err instanceof FhirError) {
    const outcome = err.outcome as
      | { issue?: Array<{ diagnostics?: string; details?: { text?: string } }> }
      | undefined;
    const issue = outcome?.issue?.[0];
    const detail = issue?.diagnostics ?? issue?.details?.text;
    if (detail?.trim()) return detail.trim();
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
