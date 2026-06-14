import { cookies } from 'next/headers';
import {
  EHRBASE_COOKIE,
  isEhrbasePresetId,
  resolveEhrbaseConfig,
  type EhrbaseConfig,
  type EhrbasePresetId,
} from './servers';

export function getEhrbaseConfig(): EhrbaseConfig {
  const jar = cookies();
  const presetRaw = jar.get(EHRBASE_COOKIE.preset)?.value;
  const presetId: EhrbasePresetId = isEhrbasePresetId(presetRaw) ? presetRaw : 'env';
  const customBaseUrl = jar.get(EHRBASE_COOKIE.customUrl)?.value ?? '';
  const customAuthHeader = jar.get(EHRBASE_COOKIE.auth)?.value ?? '';

  return resolveEhrbaseConfig({
    presetId,
    customBaseUrl,
    customAuthHeader: presetId === 'custom' ? customAuthHeader : undefined,
  });
}

export function getEhrbaseConfigForAdmin(): EhrbaseConfig & { hasAuthHeader: boolean } {
  const config = getEhrbaseConfig();
  return {
    ...config,
    hasAuthHeader: Boolean(config.authHeader),
  };
}
