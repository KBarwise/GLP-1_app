export type EhrbasePresetId = 'env' | 'codemuse-ehrbase' | 'custom';

export type EhrbaseConfig = {
  presetId: EhrbasePresetId;
  label: string;
  baseUrl: string;
  authHeader: string;
};

export const EHRBASE_COOKIE = {
  preset: 'glp1-ehrbase-preset',
  customUrl: 'glp1-ehrbase-custom-url',
  auth: 'glp1-ehrbase-auth',
  displayLabel: 'glp1-ehrbase-display-label',
} as const;

export const EHRBASE_API_PATH = '/rest/openehr/v1';

export const EHRBASE_PRESETS: Array<{
  id: EhrbasePresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'env',
    label: 'Environment default',
    description: 'Uses EHRBASE_BASE_URL and EHRBASE_AUTH_HEADER from .env.local',
  },
  {
    id: 'codemuse-ehrbase',
    label: 'CodeMuse EHRbase',
    description: 'https://ehrbase.codemuseai.com/ehrbase — openEHR REST API',
  },
  {
    id: 'custom',
    label: 'Custom EHRbase',
    description: 'Enter any EHRbase base URL; authorization header is optional',
  },
];

const PRESET_IDS: EhrbasePresetId[] = ['env', 'codemuse-ehrbase', 'custom'];

export function isEhrbasePresetId(value: string | undefined): value is EhrbasePresetId {
  return Boolean(value && PRESET_IDS.includes(value as EhrbasePresetId));
}

export function normalizeEhrbaseBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function resolveEhrbaseConfig(input: {
  presetId: EhrbasePresetId;
  customBaseUrl?: string;
  customAuthHeader?: string;
}): EhrbaseConfig {
  switch (input.presetId) {
    case 'env':
      return {
        presetId: 'env',
        label: 'Environment (.env.local)',
        baseUrl: normalizeEhrbaseBaseUrl(process.env.EHRBASE_BASE_URL ?? ''),
        authHeader: process.env.EHRBASE_AUTH_HEADER?.trim() ?? '',
      };
    case 'codemuse-ehrbase':
      return {
        presetId: 'codemuse-ehrbase',
        label: 'CodeMuse EHRbase',
        baseUrl: 'https://ehrbase.codemuseai.com/ehrbase',
        authHeader: '',
      };
    case 'custom': {
      const baseUrl = normalizeEhrbaseBaseUrl(input.customBaseUrl ?? '');
      return {
        presetId: 'custom',
        label: baseUrl ? `Custom · ${baseUrl}` : 'Custom (URL required)',
        baseUrl,
        authHeader: input.customAuthHeader?.trim() ?? '',
      };
    }
  }
}

export function ehrbaseApiUrl(baseUrl: string, path: string): string {
  const normalized = normalizeEhrbaseBaseUrl(baseUrl);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${normalized}${EHRBASE_API_PATH}${suffix}`;
}
