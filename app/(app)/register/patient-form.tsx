'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClinic } from '@/components/clinic/clinic-context';
import { canBookAppointments, receptionBookPatientUrl } from '@/lib/clinic/access';
import {
  checkMrnAvailable,
  createPatient,
  generateUniqueMrn,
  persistPatientDraft,
  updatePatient,
} from './actions';
import {
  BIRTH_SEX_OPTIONS,
  GENDER_IDENTITY_OPTIONS,
  OMB_ETHNICITY_OPTIONS,
  OMB_RACE_OPTIONS,
  PATIENT_FORM_TAB_ORDER,
  emptyPatientForm,
  firstPatientFormTabWithErrors,
  patientFormTabHasErrors,
  validatePatientFormFields,
  validatePatientFormTab,
  clearTabErrors,
  type PatientFormData,
  type PatientFormErrors,
  type PatientFormField,
  type PatientFormTab,
} from '@/lib/fhir/us-core-patient';

const TABS = [
  { id: 'demographics', label: 'Name & demographics' },
  { id: 'identity', label: 'US Core identity' },
  { id: 'contact', label: 'Contact' },
] as const;

type TabId = PatientFormTab;

const inputBase =
  'w-full px-3 py-2 border rounded-md bg-white text-[13px] focus:outline-none focus:ring-1 focus:ring-accent/40';
const labelClass = 'block text-xs text-ink-500 mb-1.5';

function inputClass(invalid?: boolean) {
  return `${inputBase} ${invalid ? 'border-danger focus:ring-danger/30' : 'border-ink-100'}`;
}

function Field({
  label,
  children,
  hint,
  error,
  fieldId,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  fieldId?: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={fieldId}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-danger mt-1" role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className="text-[11px] text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}

function serializeForm(form: PatientFormData): string {
  return JSON.stringify(form);
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function PatientForm({
  patientId,
  initial,
  intakeId,
}: {
  patientId?: string;
  initial?: PatientFormData;
  /** Kiosk intake lead — marked complete when registration finishes. */
  intakeId?: string;
}) {
  const router = useRouter();
  const { role } = useClinic();
  const [form, setForm] = useState<PatientFormData>(initial ?? emptyPatientForm());
  const [tab, setTab] = useState<TabId>('demographics');
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>(patientId);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastPersistedRef = useRef(serializeForm(initial ?? emptyPatientForm()));
  const saveInFlightRef = useRef(false);
  const effectiveId = patientId ?? draftId;
  const isEdit = Boolean(effectiveId);
  const tabIndex = PATIENT_FORM_TAB_ORDER.indexOf(tab);
  const isLastStep = tabIndex === PATIENT_FORM_TAB_ORDER.length - 1;

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  useEffect(() => {
    setDraftId(patientId);
  }, [patientId]);

  useEffect(() => {
    if (patientId || initial) return;
    let cancelled = false;
    void generateUniqueMrn()
      .then(mrn => {
        if (!cancelled) setForm(f => ({ ...f, mrnValue: mrn }));
      })
      .catch(() => {
        /* keep client placeholder; server will reject duplicates on save */
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, initial]);

  function clearError(...keys: PatientFormField[]) {
    setErrors(prev => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function set<K extends keyof PatientFormData>(key: K, value: PatientFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'given' || key === 'family') clearError('given', 'family', 'name');
    else if (key === 'mrnValue' || key === 'mrnSystem') clearError('mrnValue');
    else clearError(key as PatientFormField);
  }

  useEffect(() => {
    const value = form.mrnValue.trim();
    if (value.length < 4) return;

    const timer = window.setTimeout(async () => {
      try {
        const result = await checkMrnAvailable(form.mrnSystem, value, effectiveId);
        if (!result.available && result.message) {
          setErrors(prev => ({ ...prev, mrnValue: result.message }));
        } else {
          setErrors(prev => {
            const next = { ...prev };
            delete next.mrnValue;
            return next;
          });
        }
      } catch {
        /* ignore transient network errors during typing */
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [form.mrnValue, form.mrnSystem, effectiveId]);

  function toggleRace(code: string) {
    setForm(prev => {
      const codes = prev.raceOmbCodes.includes(code)
        ? prev.raceOmbCodes.filter(c => c !== code)
        : [...prev.raceOmbCodes, code];
      const autoText = codes
        .map(c => OMB_RACE_OPTIONS.find(o => o.code === c)?.display)
        .filter(Boolean)
        .join(', ');
      return {
        ...prev,
        raceOmbCodes: codes,
        raceText: prev.raceText || autoText,
      };
    });
  }

  const runAutosave = useCallback(
    async (force = false) => {
      const snapshot = serializeForm(form);
      if (!force && snapshot === lastPersistedRef.current) return;
      if (saveInFlightRef.current) return;

      saveInFlightRef.current = true;
      setAutosaveStatus('saving');
      try {
        const saved = await persistPatientDraft(effectiveId, form);
        if (!saved) {
          setAutosaveStatus('idle');
          return;
        }
        lastPersistedRef.current = snapshot;
        setDraftId(saved.id);
        setLastSavedAt(new Date());
        setAutosaveStatus('saved');
        if (saved.created) {
          router.replace(`/register/${saved.id}`);
        }
      } catch (e) {
        const msg = (e as Error).message;
        if (/MRN/i.test(msg)) {
          setErrors(prev => ({ ...prev, mrnValue: msg }));
        }
        setAutosaveStatus('error');
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [form, effectiveId, router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runAutosave();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [form, runAutosave]);

  function goBack() {
    if (tabIndex > 0) setTab(PATIENT_FORM_TAB_ORDER[tabIndex - 1]);
  }

  async function goNext() {
    setResult(null);
    const tabErrors = validatePatientFormTab(form, tab);
    if (Object.keys(tabErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...tabErrors }));
      return;
    }
    setErrors(prev => clearTabErrors(prev, tab));

    if (tab === 'demographics' && form.mrnValue.trim()) {
      const mrnCheck = await checkMrnAvailable(form.mrnSystem, form.mrnValue, effectiveId);
      if (!mrnCheck.available) {
        setErrors(prev => ({
          ...prev,
          mrnValue: mrnCheck.message ?? 'This MRN is already in use',
        }));
        return;
      }
    }

    await runAutosave(true);
    if (!isLastStep) {
      setTab(PATIENT_FORM_TAB_ORDER[tabIndex + 1]);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLastStep) {
      void goNext();
      return;
    }

    setResult(null);
    const nextErrors = validatePatientFormFields(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const errTab = firstPatientFormTabWithErrors(nextErrors);
      if (errTab) setTab(errTab);
      return;
    }

    setErrors({});
    startTransition(async () => {
      try {
        if (effectiveId) {
          const updated = await updatePatient(effectiveId, form);
          lastPersistedRef.current = serializeForm(form);
          setLastSavedAt(new Date());
          setAutosaveStatus('saved');
          setResult({
            ok: true,
            message: `Registration complete — Patient/${updated.id ?? effectiveId}`,
            id: updated.id ?? effectiveId,
          });
        } else {
          const created = await createPatient(form, intakeId);
          if (created.id) {
            setDraftId(created.id);
            router.replace(`/register/${created.id}`);
          }
          setResult({
            ok: true,
            message: `Registered Patient/${created.id ?? 'unknown'}`,
            id: created.id,
          });
        }
      } catch (err) {
        const message = (err as Error).message;
        if (/MRN/i.test(message)) {
          setErrors(prev => ({ ...prev, mrnValue: message }));
          setTab('demographics');
        }
        setResult({ ok: false, message });
      }
    });
  }

  const nameError = errors.name;

  const autosaveHint =
    autosaveStatus === 'saving'
      ? 'Saving…'
      : autosaveStatus === 'saved' && lastSavedAt
        ? `Saved ${formatSavedTime(lastSavedAt)}`
        : autosaveStatus === 'error'
          ? errors.mrnValue ?? 'Autosave failed — check connection'
          : effectiveId
            ? 'Changes autosave'
            : 'Enter a name on step 1 to start autosave';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 text-[13px]">
      <div
        className={`flex items-center justify-between gap-3 p-3 bg-ink-50 rounded-md border ${
          errors.mrnValue ? 'border-danger' : 'border-ink-100'
        }`}
      >
        <div>
          <div className="text-xs text-ink-500">Medical record number</div>
          <div className="font-mono text-[15px] font-medium tnum mt-0.5">{form.mrnValue || '—'}</div>
          {errors.mrnValue && (
            <p className="text-[11px] text-danger mt-1" role="alert">{errors.mrnValue}</p>
          )}
        </div>
        {!isEdit && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const mrn = await generateUniqueMrn(form.mrnSystem);
                  set('mrnValue', mrn);
                } catch (e) {
                  setErrors(prev => ({
                    ...prev,
                    mrnValue: (e as Error).message,
                  }));
                }
              });
            }}
            className="text-[12px] px-3 py-1.5 border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-50"
          >
            Regenerate MRN
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[12px] text-ink-500">
          Step {tabIndex + 1} of {TABS.length}
          <span className="text-ink-400 mx-1.5">·</span>
          {TABS[tabIndex]?.label}
        </p>
        <p
          className={`text-[11px] shrink-0 ${
            autosaveStatus === 'error' ? 'text-danger' : 'text-ink-500'
          }`}
          aria-live="polite"
        >
          {autosaveHint}
        </p>
      </div>

      <div className="flex gap-1 border-b border-ink-100 pb-0">
        {TABS.map((t, i) => {
          const reachable = i <= tabIndex || Boolean(effectiveId);
          return (
            <button
              key={t.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && setTab(t.id)}
              className={`px-3 py-2 text-[12px] rounded-t-md border border-b-0 transition-colors ${
                tab === t.id
                  ? 'bg-white border-ink-100 text-ink-900 font-medium -mb-px'
                  : reachable
                    ? 'border-transparent text-ink-500 hover:text-ink-700'
                    : 'border-transparent text-ink-300 cursor-not-allowed'
              } ${patientFormTabHasErrors(errors, t.id) ? 'text-danger' : ''}`}
            >
              {t.label}
              {patientFormTabHasErrors(errors, t.id) && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-danger align-middle" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
        <div
          className={`snap-center shrink-0 w-full min-w-full transition-opacity ${
            tab === 'demographics' ? 'block' : 'hidden'
          }`}
        >
          <div className="border border-ink-100 rounded-lg p-4 bg-white space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Given name(s)" error={nameError} fieldId="patient-given">
                <input
                  id="patient-given"
                  className={inputClass(Boolean(nameError))}
                  value={form.given}
                  onChange={e => set('given', e.target.value)}
                  placeholder="Amy V."
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
              <Field label="Family name" error={nameError} fieldId="patient-family">
                <input
                  id="patient-family"
                  className={inputClass(Boolean(nameError))}
                  value={form.family}
                  onChange={e => set('family', e.target.value)}
                  placeholder="Baxter"
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Administrative gender">
                <select
                  className={inputClass()}
                  value={form.gender}
                  onChange={e => set('gender', e.target.value as PatientFormData['gender'])}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </Field>
              <Field label="Date of birth" error={errors.birthDate} fieldId="patient-dob">
                <input
                  id="patient-dob"
                  type="date"
                  className={inputClass(Boolean(errors.birthDate))}
                  value={form.birthDate}
                  onChange={e => set('birthDate', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  aria-invalid={Boolean(errors.birthDate)}
                />
              </Field>
              <Field label="Birth sex (US Core)">
                <select
                  className={inputClass()}
                  value={form.birthSex}
                  onChange={e => set('birthSex', e.target.value as PatientFormData['birthSex'])}
                >
                  <option value="">—</option>
                  {BIRTH_SEX_OPTIONS.map(o => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => set('active', e.target.checked)}
                className="rounded border-ink-100"
              />
              <span>Active record</span>
            </label>
          </div>
        </div>

        <div
          className={`snap-center shrink-0 w-full min-w-full transition-opacity ${
            tab === 'identity' ? 'block' : 'hidden'
          }`}
        >
          <div className="border border-ink-100 rounded-lg p-4 bg-white space-y-3">
            <Field label="Race (OMB categories)" hint="us-core-race">
              <div className="flex flex-wrap gap-2">
                {OMB_RACE_OPTIONS.map(o => (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => toggleRace(o.code)}
                    className={`px-2.5 py-1 rounded-md text-[12px] border transition-colors ${
                      form.raceOmbCodes.includes(o.code)
                        ? 'bg-accent-soft text-accent border-accent/30'
                        : 'bg-ink-50 text-ink-700 border-ink-100 hover:border-ink-200'
                    }`}
                  >
                    {o.display}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Race text" error={errors.raceText} fieldId="patient-race-text">
              <input
                id="patient-race-text"
                className={inputClass(Boolean(errors.raceText))}
                value={form.raceText}
                onChange={e => set('raceText', e.target.value)}
                placeholder="Auto-filled from categories"
                aria-invalid={Boolean(errors.raceText)}
              />
            </Field>
            <Field label="Ethnicity (OMB)" hint="us-core-ethnicity · text derived from selection">
              <select
                className={inputClass()}
                value={form.ethnicityOmbCode}
                onChange={e => {
                  const code = e.target.value;
                  const opt = OMB_ETHNICITY_OPTIONS.find(o => o.code === code);
                  setForm(prev => ({
                    ...prev,
                    ethnicityOmbCode: code,
                    ethnicityText: opt?.display ?? '',
                  }));
                }}
              >
                <option value="">—</option>
                {OMB_ETHNICITY_OPTIONS.map(o => (
                  <option key={o.code} value={o.code}>{o.display}</option>
                ))}
              </select>
            </Field>
            <Field label="Gender identity" hint="us-core-genderIdentity">
              <select
                className={inputClass()}
                value={form.genderIdentityCode}
                onChange={e => set('genderIdentityCode', e.target.value)}
              >
                <option value="">—</option>
                {GENDER_IDENTITY_OPTIONS.map(o => (
                  <option key={o.code} value={o.code}>{o.display}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div
          className={`snap-center shrink-0 w-full min-w-full transition-opacity ${
            tab === 'contact' ? 'block' : 'hidden'
          }`}
        >
          <div className="border border-ink-100 rounded-lg p-4 bg-white space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" error={errors.phone} fieldId="patient-phone">
                <input
                  id="patient-phone"
                  type="tel"
                  className={inputClass(Boolean(errors.phone))}
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="e.g. (555) 555-0100"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                />
              </Field>
              <Field label="Email" error={errors.email} fieldId="patient-email">
                <input
                  id="patient-email"
                  type="email"
                  className={inputClass(Boolean(errors.email))}
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>
            </div>
            <Field label="Street address">
              <input
                className={inputClass()}
                value={form.addressLine}
                onChange={e => set('addressLine', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City">
                <input className={inputClass()} value={form.city} onChange={e => set('city', e.target.value)} />
              </Field>
              <Field label="State" error={errors.state} fieldId="patient-state">
                <input
                  id="patient-state"
                  className={inputClass(Boolean(errors.state))}
                  value={form.state}
                  onChange={e => set('state', e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="CA"
                  aria-invalid={Boolean(errors.state)}
                />
              </Field>
              <Field label="ZIP" error={errors.postalCode} fieldId="patient-zip">
                <input
                  id="patient-zip"
                  className={inputClass(Boolean(errors.postalCode))}
                  value={form.postalCode}
                  onChange={e => set('postalCode', e.target.value)}
                  placeholder="90210"
                  aria-invalid={Boolean(errors.postalCode)}
                />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-ink-100">
        <button
          type="button"
          onClick={goBack}
          disabled={tabIndex === 0 || pending}
          className="px-4 py-2 text-[12px] border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          {!isLastStep ? (
            <button
              type="button"
              onClick={() => void goNext()}
              disabled={pending}
              className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md hover:bg-ink-700 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md hover:bg-ink-700 disabled:opacity-50"
            >
              {pending ? 'Saving…' : isEdit ? 'Finish registration' : 'Register patient'}
            </button>
          )}
        </div>
      </div>

      {result && (
        <div
          className={`p-3 rounded-md text-[12px] ${
            result.ok ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger'
          }`}
        >
          {result.message}
          {result.ok && result.id && canBookAppointments(role) && (
            <span className="block mt-2">
              <Link
                href={receptionBookPatientUrl(
                  result.id,
                  `${form.given} ${form.family}`.trim() || 'Patient',
                )}
                className="inline-flex items-center font-medium underline"
              >
                Book appointment →
              </Link>
            </span>
          )}
          {result.ok && result.id && !isEdit && (
            <span className="block mt-1">
              <Link href={`/register/${result.id}`} className="underline">
                Continue editing demographics →
              </Link>
            </span>
          )}
        </div>
      )}
    </form>
  );
}
