/**
 * Server-side EHRbase openEHR client. Never import from client components.
 */

import 'server-only';

import { getEhrbaseConfig } from './config';
import { ehrbaseApiUrl } from './servers';

export class EhrbaseError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
  }
}

type AqlResult = {
  meta?: {
    resultsize?: number;
    fetch?: number;
    offset?: number;
    _executed_aql?: string;
  };
  q?: string;
  columns?: Array<{ path: string; name: string }>;
  rows?: unknown[][];
};

function authHeaders(authHeader: string): Record<string, string> {
  if (!authHeader) return {};
  const value =
    authHeader.startsWith('Bearer ') || authHeader.startsWith('Basic ')
      ? authHeader
      : `Bearer ${authHeader}`;
  return { Authorization: value };
}

async function ehrbaseFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { baseUrl, authHeader } = getEhrbaseConfig();
  if (!baseUrl) {
    throw new EhrbaseError(
      0,
      null,
      'EHRbase base URL is not configured. Set it in Admin → Clinic settings.',
    );
  }

  const url = ehrbaseApiUrl(baseUrl, path);
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(authHeader),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new EhrbaseError(res.status, body, `EHRbase ${res.status} on ${path}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function runAql(query: string, fetch = 10, offset = 0): Promise<AqlResult> {
  return ehrbaseFetch<AqlResult>('/query/aql', {
    method: 'POST',
    body: JSON.stringify({ q: query, fetch, offset }),
  });
}

export async function countEhrs(): Promise<number> {
  const result = await runAql('SELECT count(e) FROM EHR e', 1);
  const count = result.rows?.[0]?.[0];
  return typeof count === 'number' ? count : Number(count) || 0;
}

export async function testEhrbaseConnection(): Promise<{
  ok: boolean;
  message: string;
  ehrCount?: number;
}> {
  const { baseUrl } = getEhrbaseConfig();
  if (!baseUrl) {
    return { ok: false, message: 'EHRbase base URL is required.' };
  }

  try {
    const result = await runAql('SELECT e/ehr_id/value FROM EHR e LIMIT 1', 1);
    const ehrCount = await countEhrs();
    const sampleId = result.rows?.[0]?.[0];
    const parts = ['AQL query: OK'];
    if (typeof sampleId === 'string') {
      parts.push(`sample EHR: ${sampleId.slice(0, 8)}…`);
    }
    parts.push(`${ehrCount} EHR(s) in repository`);
    return { ok: true, message: parts.join(' · '), ehrCount };
  } catch (e) {
    if (e instanceof EhrbaseError) {
      return { ok: false, message: e.message };
    }
    return { ok: false, message: (e as Error).message };
  }
}

export const ehrbase = {
  runAql,
  countEhrs,
  raw: ehrbaseFetch,
};
