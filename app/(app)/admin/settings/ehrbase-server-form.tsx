'use client';

import { useState, useTransition } from 'react';
import {
  EHRBASE_PRESETS,
  type EhrbasePresetId,
} from '@/lib/ehrbase/servers';
import { saveEhrbaseConfig, testEhrbaseServerConnection } from './actions';

const inputClass = 'w-full px-3 py-2 border border-ink-100 rounded-md text-[13px]';

export function EhrbaseServerForm({
  initial,
}: {
  initial: {
    presetId: EhrbasePresetId;
    baseUrl: string;
    label: string;
    hasAuthHeader: boolean;
    customBaseUrl: string;
  };
}) {
  const [presetId, setPresetId] = useState<EhrbasePresetId>(initial.presetId);
  const [customBaseUrl, setCustomBaseUrl] = useState(
    initial.presetId === 'custom' ? initial.baseUrl : initial.customBaseUrl || '',
  );
  const [useAuth, setUseAuth] = useState(initial.hasAuthHeader);
  const [authHeader, setAuthHeader] = useState('');
  const [clearAuth, setClearAuth] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOk, setIsOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function buildInput() {
    return {
      presetId,
      customBaseUrl: presetId === 'custom' ? customBaseUrl : undefined,
      useAuth: presetId === 'custom' && useAuth,
      authHeader: authHeader.trim() || undefined,
      clearAuth: presetId === 'custom' && clearAuth,
    };
  }

  function onTest() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await testEhrbaseServerConnection(buildInput());
        setIsOk(result.ok);
        setMessage(result.message);
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
        const result = await saveEhrbaseConfig(buildInput());
        setIsOk(result.ok);
        setMessage(result.ok ? `Saved. ${result.message}` : result.message);
        if (result.ok) {
          setAuthHeader('');
          setClearAuth(false);
          window.location.reload();
        }
      } catch (err) {
        setIsOk(false);
        setMessage((err as Error).message);
      }
    });
  }

  const selectedPreset = EHRBASE_PRESETS.find(p => p.id === presetId);

  return (
    <form onSubmit={onSave} className="space-y-4 text-[13px]">
      <p className="text-[12px] text-ink-500">
        Active: <span className="font-medium text-ink-700">{initial.label}</span>
        {initial.baseUrl && (
          <span className="block font-mono text-[11px] mt-1 truncate">{initial.baseUrl}</span>
        )}
      </p>

      <div>
        <label className="block text-xs text-ink-500 mb-1.5">EHRbase server</label>
        <select
          className={inputClass}
          value={presetId}
          onChange={e => setPresetId(e.target.value as EhrbasePresetId)}
        >
          {EHRBASE_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {selectedPreset && (
          <p className="text-[11px] text-ink-500 mt-1">{selectedPreset.description}</p>
        )}
      </div>

      {presetId === 'custom' && (
        <>
          <div>
            <label className="block text-xs text-ink-500 mb-1.5">Base URL</label>
            <input
              className={inputClass}
              value={customBaseUrl}
              onChange={e => setCustomBaseUrl(e.target.value)}
              placeholder="https://ehrbase.example.com/ehrbase"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useAuth}
                onChange={e => {
                  setUseAuth(e.target.checked);
                  if (!e.target.checked) setClearAuth(true);
                }}
                className="rounded border-ink-100"
              />
              <span>Send Authorization header</span>
            </label>
            {useAuth && (
              <input
                type="password"
                className={inputClass}
                value={authHeader}
                onChange={e => {
                  setAuthHeader(e.target.value);
                  setClearAuth(false);
                }}
                placeholder={
                  initial.hasAuthHeader
                    ? 'Leave blank to keep current header'
                    : 'Bearer eyJ… or Basic …'
                }
                autoComplete="off"
              />
            )}
            {initial.hasAuthHeader && useAuth && (
              <label className="flex items-center gap-2 text-[12px] text-ink-500">
                <input
                  type="checkbox"
                  checked={clearAuth}
                  onChange={e => setClearAuth(e.target.checked)}
                  className="rounded border-ink-100"
                />
                Remove stored authorization header
              </label>
            )}
          </div>
        </>
      )}

      {presetId === 'env' && (
        <p className="text-[12px] text-ink-500 rounded-md bg-ink-50 border border-ink-100 p-3">
          Uses <code className="text-[11px]">EHRBASE_BASE_URL</code> and{' '}
          <code className="text-[11px]">EHRBASE_AUTH_HEADER</code> from{' '}
          <code className="text-[11px]">.env.local</code>. Change env vars and restart the dev
          server to update defaults.
        </p>
      )}

      <p className="text-[12px] text-ink-500 rounded-md bg-ink-50 border border-ink-100 p-3">
        EHRbase stores clinical data as openEHR compositions. This app uses the FHIR server above
        for patient charts, vitals, and workflows. EHRbase is connected for openEHR queries and
        future composition sync.
      </p>

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
    </form>
  );
}
