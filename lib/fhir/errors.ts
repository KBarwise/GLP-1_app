export function formatFhirErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('FHIR 401')) {
    return 'FHIR server rejected the request (401 Unauthorized). Set FHIR_BEARER_TOKEN in your deployment environment, or open Admin → Clinic settings and save a bearer token for this browser.';
  }

  if (message.includes('FHIR 403')) {
    return 'FHIR server denied access (403 Forbidden). Check that the bearer token has permission for this resource.';
  }

  return message;
}
