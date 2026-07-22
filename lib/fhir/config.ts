import { cookies } from 'next/headers';
import {
  FHIR_COOKIE,
  isFhirServerPresetId,
  resolveFhirServerConfig,
  type FhirServerConfig,
  type FhirServerPresetId,
} from './servers';

export function getFhirServerConfig(): FhirServerConfig {
  const jar = cookies();
  const presetRaw = jar.get(FHIR_COOKIE.preset)?.value;
  const presetId: FhirServerPresetId = isFhirServerPresetId(presetRaw) ? presetRaw : 'env';
  const customBaseUrl = jar.get(FHIR_COOKIE.customUrl)?.value ?? '';
  const customBearerToken = jar.get(FHIR_COOKIE.bearer)?.value ?? '';

  return resolveFhirServerConfig({
    presetId,
    customBaseUrl,
    customBearerToken: customBearerToken || undefined,
  });
}

export function getFhirServerConfigForAdmin(): FhirServerConfig & { hasBearerToken: boolean } {
  const config = getFhirServerConfig();
  return {
    ...config,
    hasBearerToken: Boolean(config.bearerToken),
  };
}
