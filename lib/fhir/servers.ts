export type FhirServerPresetId = 'env' | 'codemuse-fhir' | 'hapi-public' | 'custom';

export type FhirServerConfig = {
  presetId: FhirServerPresetId;
  label: string;
  baseUrl: string;
  bearerToken: string;
};

export const FHIR_COOKIE = {
  preset: 'glp1-fhir-preset',
  customUrl: 'glp1-fhir-custom-url',
  bearer: 'glp1-fhir-bearer',
  displayLabel: 'glp1-fhir-display-label',
} as const;

export const FHIR_SERVER_PRESETS: Array<{
  id: FhirServerPresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'env',
    label: 'Environment default',
    description: 'Uses FHIR_BASE_URL and FHIR_BEARER_TOKEN from .env.local',
  },
  {
    id: 'codemuse-fhir',
    label: 'CodeMuse FHIR',
    description: 'https://term.codemuseai.com/fhir — HAPI FHIR R4',
  },
  {
    id: 'hapi-public',
    label: 'HAPI public R4',
    description: 'https://hapi.fhir.org/baseR4 — no bearer token',
  },
  {
    id: 'custom',
    label: 'Custom server',
    description: 'Enter any FHIR base URL; bearer token is optional',
  },
];

const PRESET_IDS: FhirServerPresetId[] = ['env', 'codemuse-fhir', 'hapi-public', 'custom'];

export function isFhirServerPresetId(value: string | undefined): value is FhirServerPresetId {
  return Boolean(value && PRESET_IDS.includes(value as FhirServerPresetId));
}

export function normalizeFhirBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function resolveFhirServerConfig(input: {
  presetId: FhirServerPresetId;
  customBaseUrl?: string;
  customBearerToken?: string;
}): FhirServerConfig {
  switch (input.presetId) {
    case 'env':
      return {
        presetId: 'env',
        label: 'Environment (.env.local)',
        baseUrl: normalizeFhirBaseUrl(process.env.FHIR_BASE_URL ?? ''),
        bearerToken: process.env.FHIR_BEARER_TOKEN ?? '',
      };
    case 'codemuse-fhir':
      return {
        presetId: 'codemuse-fhir',
        label: 'CodeMuse FHIR',
        baseUrl: 'https://term.codemuseai.com/fhir',
        bearerToken: '',
      };
    case 'hapi-public':
      return {
        presetId: 'hapi-public',
        label: 'HAPI public R4',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        bearerToken: '',
      };
    case 'custom': {
      const baseUrl = normalizeFhirBaseUrl(input.customBaseUrl ?? '');
      return {
        presetId: 'custom',
        label: baseUrl ? `Custom · ${baseUrl}` : 'Custom (URL required)',
        baseUrl,
        bearerToken: input.customBearerToken?.trim() ?? '',
      };
    }
  }
}
