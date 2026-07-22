'use client';

import { useState, useTransition } from 'react';
import {
  FHIR_COOKIE,
  FHIR_SERVER_PRESETS,
  type FhirServerPresetId,
} from '@/lib/fhir/servers';
import { saveFhirServerConfig, testFhirServerConnection } from './actions';

const inputClass = 'w-full px-3 py-2 border border-ink-100 rounded-md text-[13px]';

export function FhirServerForm({
  initial,
}: {
  initial: {
    presetId: FhirServerPresetId;
    baseUrl: string;
    label: string;
    hasBearerToken: boolean;
    customBaseUrl: string;
  };
}) {
  const [presetId, setPresetId] = useState<FhirServerPresetId>(initial.presetId);
  const [customBaseUrl, setCustomBaseUrl] = useState(
    initial.presetId === 'custom' ? initial.baseUrl : initial.customBaseUrl || '',
  );
  const [useBearer, setUseBearer] = useState(initial.hasBearerToken);
  const [bearerToken, setBearerToken] = useState('');
  const [clearBearer, setClearBearer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOk, setIsOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function buildInput() {
    const usesBearer = presetId === 'custom' || presetId === 'env';
    return {
      presetId,
      customBaseUrl: presetId === 'custom' ? customBaseUrl : undefined,
      useBearer: usesBearer && useBearer,
      bearerToken: bearerToken.trim() || undefined,
      clearBearer: usesBearer && clearBearer,
    };
  }

  function onTest() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await testFhirServerConnection(buildInput());
        setIsOk(result.ok);
        setMessage(
          result.ok
            ? `${result.message}${result.software ? ` (${result.software})` : ''}`
            : result.message,
        );
      } catch (e) {
        setIsOk(false);
        setMessage((e as Error).message);
      }
    });
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveFhirServerConfig(buildInput());
        setIsOk(result.ok);
        setMessage(
          result.ok
            ? `Saved. ${result.message}${result.software ? ` (${result.software})` : ''}`
            : result.message,
        );
        if (result.ok) {
          const label =
            presetId === 'custom'
              ? `Custom · ${customBaseUrl.replace(/\/$/, '')}`
              : FHIR_SERVER_PRESETS.find(p => p.id === presetId)?.label ?? presetId;
          localStorage.setItem(FHIR_COOKIE.displayLabel, label);
          setBearerToken('');
          setClearBearer(false);
          window.location.reload();
        }
      } catch (err) {
        setIsOk(false);
        setMessage((err as Error).message);
      }
    });
  }

  const selectedPreset = FHIR_SERVER_PRESETS.find(p => p.id === presetId);
  const showBearerOptions = presetId === 'custom' || presetId === 'env';

  return (
    <form onSubmit={onSave} className="space-y-4 text-[13px]">
      <p className="text-[12px] text-ink-500">
        Active: <span className="font-medium text-ink-700">{initial.label}</span>
        {initial.baseUrl && (
          <span className="block font-mono text-[11px] mt-1 truncate">{initial.baseUrl}</span>
        )}
      </p>

      <div>
        <label className="block text-xs text-ink-500 mb-1.5">FHIR server</label>
        <select
          className={inputClass}
          value={presetId}
          onChange={e => setPresetId(e.target.value as FhirServerPresetId)}
        >
          {FHIR_SERVER_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {selectedPreset && (
          <p className="text-[11px] text-ink-500 mt-1">{selectedPreset.description}</p>
        )}
      </div>

      {presetId === 'custom' && (
        <div>
          <label className="block text-xs text-ink-500 mb-1.5">Base URL</label>
          <input
            className={inputClass}
            value={customBaseUrl}
            onChange={e => setCustomBaseUrl(e.target.value)}
            placeholder="https://fhir.example.com/fhir"
            required
          />
        </div>
      )}

      {presetId === 'env' && (
        <p className="text-[12px] text-ink-500 rounded-md bg-ink-50 border border-ink-100 p-3">
          Uses <code className="text-[11px]">FHIR_BASE_URL</code> and{' '}
          <code className="text-[11px]">FHIR_BEARER_TOKEN</code> from your deployment environment.
          If the server requires auth and the env token is missing on Vercel, save a bearer token below
          for this browser.
        </p>
      )}

      {showBearerOptions && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useBearer}
              onChange={e => {
                setUseBearer(e.target.checked);
                if (!e.target.checked) setClearBearer(true);
              }}
              className="rounded border-ink-100"
            />
            <span>Send bearer token</span>
          </label>
          {useBearer && (
            <input
              type="password"
              className={inputClass}
              value={bearerToken}
              onChange={e => {
                setBearerToken(e.target.value);
                setClearBearer(false);
              }}
              placeholder={
                initial.hasBearerToken
                  ? 'Leave blank to keep current token'
                  : 'Paste bearer token'
              }
              autoComplete="off"
            />
          )}
          {initial.hasBearerToken && useBearer && (
            <label className="flex items-center gap-2 text-[12px] text-ink-500">
              <input
                type="checkbox"
                checked={clearBearer}
                onChange={e => setClearBearer(e.target.checked)}
                className="rounded border-ink-100"
              />
              Remove stored bearer token
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTest}
          disabled={pending}
          className="px-4 py-2 text-[12px] border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-50"
        >
          {pending ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md hover:bg-ink-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save & apply'}
        </button>
      </div>

      {message && (
        <p
          className={`text-[12px] ${isOk ? 'text-accent' : 'text-danger'}`}
          role="status"
        >
          {message}
        </p>
      )}

      <p className="text-[11px] text-ink-500">
        Demo only: custom bearer tokens are stored in an httpOnly cookie on this browser. Do not use production credentials on shared machines.
      </p>
    </form>
  );
}
