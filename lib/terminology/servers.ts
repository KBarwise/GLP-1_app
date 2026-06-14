export type TerminologyPresetId = 'env' | 'codemuse' | 'custom';

export type TerminologyConfig = {
  presetId: TerminologyPresetId;
  label: string;
  eclBaseUrl: string;
  opsBaseUrl: string;
  authHeader: string;
};

export const TERMINOLOGY_COOKIE = {
  preset: 'glp1-term-preset',
  eclUrl: 'glp1-term-ecl-url',
  opsUrl: 'glp1-term-ops-url',
  auth: 'glp1-term-auth',
  displayLabel: 'glp1-term-display-label',
} as const;

export const TERMINOLOGY_PRESETS: Array<{
  id: TerminologyPresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'env',
    label: 'Environment default',
    description:
      'Uses TERMINOLOGY_ECL_BASE_URL, TERMINOLOGY_BASE_URL, and TERMINOLOGY_AUTH_HEADER from .env.local',
  },
  {
    id: 'codemuse',
    label: 'CodeMuse terminology',
    description: 'https://term.codemuseai.com/fhir — SNOMED ECL expand, validate, lookup',
  },
  {
    id: 'custom',
    label: 'Custom Snowstorm / FHIR terminology',
    description: 'Separate base URLs for ECL $expand and validate/lookup operations',
  },
];

const PRESET_IDS: TerminologyPresetId[] = ['env', 'codemuse', 'custom'];

export function isTerminologyPresetId(value: string | undefined): value is TerminologyPresetId {
  return Boolean(value && PRESET_IDS.includes(value as TerminologyPresetId));
}

/** Normalize Snowstorm / FHIR terminology base (append /fhir when needed). */
export function normalizeTerminologyBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/fhir')) return trimmed;
  if (trimmed.includes('snowstorm')) return `${trimmed}/fhir`;
  return trimmed;
}

function envEclBase(): string {
  return normalizeTerminologyBaseUrl(process.env.TERMINOLOGY_ECL_BASE_URL ?? '');
}

function envOpsBase(): string {
  const ops = process.env.TERMINOLOGY_BASE_URL?.trim();
  const ecl = process.env.TERMINOLOGY_ECL_BASE_URL?.trim();
  return normalizeTerminologyBaseUrl(ops || ecl || '');
}

export function resolveTerminologyConfig(input: {
  presetId: TerminologyPresetId;
  customEclUrl?: string;
  customOpsUrl?: string;
  customAuthHeader?: string;
}): TerminologyConfig {
  switch (input.presetId) {
    case 'env':
      return {
        presetId: 'env',
        label: 'Environment (.env.local)',
        eclBaseUrl: envEclBase(),
        opsBaseUrl: envOpsBase(),
        authHeader: process.env.TERMINOLOGY_AUTH_HEADER?.trim() ?? '',
      };
    case 'codemuse': {
      const base = 'https://term.codemuseai.com/fhir';
      return {
        presetId: 'codemuse',
        label: 'CodeMuse terminology',
        eclBaseUrl: base,
        opsBaseUrl: base,
        authHeader: '',
      };
    }
    case 'custom': {
      const eclBaseUrl = normalizeTerminologyBaseUrl(input.customEclUrl ?? '');
      const opsBaseUrl = normalizeTerminologyBaseUrl(
        input.customOpsUrl?.trim() || input.customEclUrl || '',
      );
      const label = eclBaseUrl
        ? `Custom · ${eclBaseUrl}`
        : 'Custom (ECL URL required)';
      return {
        presetId: 'custom',
        label,
        eclBaseUrl,
        opsBaseUrl: opsBaseUrl || eclBaseUrl,
        authHeader: input.customAuthHeader?.trim() ?? '',
      };
    }
  }
}
