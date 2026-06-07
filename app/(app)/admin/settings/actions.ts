'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DEFAULT_CLINIC_NAME, STORAGE_KEYS } from '@/lib/clinic/roles';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { saveClinicNameToFhir } from '@/lib/clinic/fhir-clinic-settings';
import {
  FHIR_COOKIE,
  isFhirServerPresetId,
  resolveFhirServerConfig,
  type FhirServerPresetId,
} from '@/lib/fhir/servers';
import {
  TERMINOLOGY_COOKIE,
  isTerminologyPresetId,
  resolveTerminologyConfig,
  type TerminologyPresetId,
} from '@/lib/terminology/servers';
import { implicitValueSetUrl } from '@/lib/terminology/ecl';

function assertAdmin(): void {
  if (getActingRoleFromCookie() !== 'admin') {
    throw new Error('Only admin can change clinic settings.');
  }
}

export async function saveClinicName(name: string): Promise<void> {
  assertAdmin();

  const trimmed = await saveClinicNameToFhir(name.trim() || DEFAULT_CLINIC_NAME);
  cookies().set(STORAGE_KEYS.clinicName, trimmed, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
}

export type FhirConnectionTestResult = {
  ok: boolean;
  message: string;
  software?: string;
};

export type SaveFhirServerInput = {
  presetId: FhirServerPresetId;
  customBaseUrl?: string;
  useBearer: boolean;
  bearerToken?: string;
  clearBearer?: boolean;
};

async function testConfig(baseUrl: string, bearerToken: string): Promise<FhirConnectionTestResult> {
  if (!baseUrl) {
    return { ok: false, message: 'FHIR base URL is required.' };
  }

  try {
    const res = await fetch(`${baseUrl}/metadata`, {
      headers: {
        Accept: 'application/fhir+json',
        'Accept-Language': 'en',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ok: false, message: `Server returned HTTP ${res.status}` };
    }

    const meta = (await res.json()) as {
      software?: { name?: string; version?: string };
      fhirVersion?: string;
    };
    const software = meta.software
      ? `${meta.software.name ?? 'FHIR'}${meta.software.version ? ` ${meta.software.version}` : ''}`
      : undefined;

    return {
      ok: true,
      message: `Connected${meta.fhirVersion ? ` (FHIR ${meta.fhirVersion})` : ''}.`,
      software,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function testFhirServerConnection(
  input: SaveFhirServerInput,
): Promise<FhirConnectionTestResult> {
  assertAdmin();

  const existingBearer = cookies().get(FHIR_COOKIE.bearer)?.value ?? '';
  const bearerToken = input.presetId === 'custom'
    ? (input.clearBearer
      ? ''
      : input.bearerToken?.trim() || (input.useBearer ? existingBearer : ''))
    : '';

  const config = resolveFhirServerConfig({
    presetId: input.presetId,
    customBaseUrl: input.customBaseUrl,
    customBearerToken: bearerToken,
  });

  return testConfig(config.baseUrl, config.bearerToken);
}

export async function saveFhirServerConfig(input: SaveFhirServerInput): Promise<FhirConnectionTestResult> {
  assertAdmin();

  if (!isFhirServerPresetId(input.presetId)) {
    throw new Error('Invalid FHIR server preset.');
  }

  const jar = cookies();
  const existingBearer = jar.get(FHIR_COOKIE.bearer)?.value ?? '';

  let bearerToStore = '';
  if (input.presetId === 'custom') {
    if (input.clearBearer || !input.useBearer) {
      bearerToStore = '';
    } else if (input.bearerToken?.trim()) {
      bearerToStore = input.bearerToken.trim();
    } else {
      bearerToStore = existingBearer;
    }
  }

  const config = resolveFhirServerConfig({
    presetId: input.presetId,
    customBaseUrl: input.customBaseUrl,
    customBearerToken: bearerToStore,
  });

  if (input.presetId === 'custom' && !config.baseUrl) {
    throw new Error('Enter a FHIR base URL for the custom server.');
  }

  if (input.presetId === 'env' && !config.baseUrl) {
    throw new Error('FHIR_BASE_URL is not set in .env.local.');
  }

  const cookieOpts = {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax' as const,
  };

  jar.set(FHIR_COOKIE.preset, input.presetId, cookieOpts);

  if (input.presetId === 'custom') {
    jar.set(FHIR_COOKIE.customUrl, config.baseUrl, cookieOpts);
    if (bearerToStore) {
      jar.set(FHIR_COOKIE.bearer, bearerToStore, { ...cookieOpts, httpOnly: true });
    } else {
      jar.delete(FHIR_COOKIE.bearer);
    }
  } else {
    jar.delete(FHIR_COOKIE.customUrl);
    jar.delete(FHIR_COOKIE.bearer);
  }

  jar.set(FHIR_COOKIE.displayLabel, config.label, cookieOpts);

  revalidatePath('/admin/settings');
  revalidatePath('/patients');
  revalidatePath('/register');
  revalidatePath('/cohort');

  return testConfig(config.baseUrl, config.bearerToken);
}

export type SaveTerminologyInput = {
  presetId: TerminologyPresetId;
  customEclUrl?: string;
  customOpsUrl?: string;
  useAuth?: boolean;
  authHeader?: string;
  clearAuth?: boolean;
};

function resolveTerminologyForInput(input: SaveTerminologyInput) {
  const jar = cookies();
  const existingAuth = jar.get(TERMINOLOGY_COOKIE.auth)?.value ?? '';

  let authToUse = '';
  if (input.presetId === 'custom') {
    if (input.clearAuth || !input.useAuth) {
      authToUse = '';
    } else if (input.authHeader?.trim()) {
      authToUse = input.authHeader.trim();
    } else {
      authToUse = existingAuth;
    }
  }

  return resolveTerminologyConfig({
    presetId: input.presetId,
    customEclUrl: input.customEclUrl,
    customOpsUrl: input.customOpsUrl,
    customAuthHeader: authToUse,
  });
}

async function testTerminologyBases(
  eclBase: string,
  opsBase: string,
  authHeader: string,
): Promise<FhirConnectionTestResult> {
  if (!eclBase) {
    return { ok: false, message: 'ECL expand base URL is required.' };
  }

  const auth =
    authHeader.startsWith('Bearer ') || authHeader.startsWith('Basic ')
      ? authHeader
      : authHeader
        ? `Bearer ${authHeader}`
        : '';

  const headers: Record<string, string> = {
    Accept: 'application/fhir+json',
    'Accept-Language': 'en',
    ...(auth ? { Authorization: auth } : {}),
  };

  const parts: string[] = [];

  try {
    const expandUrl = `${eclBase}/ValueSet/$expand?url=${encodeURIComponent(
      implicitValueSetUrl('<<404684003'),
    )}&count=1`;
    const expandRes = await fetch(expandUrl, { headers, cache: 'no-store' });
    parts.push(expandRes.ok ? 'ECL expand: OK' : `ECL expand: HTTP ${expandRes.status}`);
  } catch (e) {
    parts.push(`ECL expand: ${(e as Error).message}`);
  }

  const ops = opsBase || eclBase;
  try {
    const metaRes = await fetch(`${ops}/metadata`, { headers, cache: 'no-store' });
    parts.push(metaRes.ok ? 'Validate/lookup: OK' : `Validate/lookup: HTTP ${metaRes.status}`);
  } catch (e) {
    parts.push(`Validate/lookup: ${(e as Error).message}`);
  }

  const ok = parts.every(p => p.endsWith(': OK'));
  return { ok, message: parts.join(' · ') };
}

export async function testTerminologyConnection(
  input: SaveTerminologyInput,
): Promise<FhirConnectionTestResult> {
  assertAdmin();
  const config = resolveTerminologyForInput(input);
  return testTerminologyBases(config.eclBaseUrl, config.opsBaseUrl, config.authHeader);
}

export async function saveTerminologyConfig(
  input: SaveTerminologyInput,
): Promise<FhirConnectionTestResult> {
  assertAdmin();

  if (!isTerminologyPresetId(input.presetId)) {
    throw new Error('Invalid terminology server preset.');
  }

  const jar = cookies();
  const existingAuth = jar.get(TERMINOLOGY_COOKIE.auth)?.value ?? '';

  let authToStore = '';
  if (input.presetId === 'custom') {
    if (input.clearAuth || !input.useAuth) {
      authToStore = '';
    } else if (input.authHeader?.trim()) {
      authToStore = input.authHeader.trim();
    } else {
      authToStore = existingAuth;
    }
  }

  const config = resolveTerminologyConfig({
    presetId: input.presetId,
    customEclUrl: input.customEclUrl,
    customOpsUrl: input.customOpsUrl,
    customAuthHeader: authToStore,
  });

  if (input.presetId === 'custom' && !config.eclBaseUrl) {
    throw new Error('Enter an ECL expand base URL for the custom terminology server.');
  }

  if (input.presetId === 'env' && !config.eclBaseUrl) {
    throw new Error('TERMINOLOGY_ECL_BASE_URL is not set in .env.local.');
  }

  const cookieOpts = {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax' as const,
  };

  jar.set(TERMINOLOGY_COOKIE.preset, input.presetId, cookieOpts);

  if (input.presetId === 'custom') {
    jar.set(TERMINOLOGY_COOKIE.eclUrl, config.eclBaseUrl, cookieOpts);
    jar.set(TERMINOLOGY_COOKIE.opsUrl, config.opsBaseUrl, cookieOpts);
    if (authToStore) {
      jar.set(TERMINOLOGY_COOKIE.auth, authToStore, { ...cookieOpts, httpOnly: true });
    } else {
      jar.delete(TERMINOLOGY_COOKIE.auth);
    }
  } else {
    jar.delete(TERMINOLOGY_COOKIE.eclUrl);
    jar.delete(TERMINOLOGY_COOKIE.opsUrl);
    jar.delete(TERMINOLOGY_COOKIE.auth);
  }

  jar.set(TERMINOLOGY_COOKIE.displayLabel, config.label, cookieOpts);

  revalidatePath('/admin/settings');
  revalidatePath('/admin/bindings');
  revalidatePath('/screening');
  revalidatePath('/cohort');

  return testTerminologyBases(config.eclBaseUrl, config.opsBaseUrl, config.authHeader);
}
