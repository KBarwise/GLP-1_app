'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeNurseVisit } from '@/app/(app)/scheduling/actions';
import { persistNurseChartDraft } from '../actions';
import { MedicationCatalogSection } from '@/components/clinical/medication-catalog-section';
import { VITAL_SIGNS, ANTHROPOMETRICS, POC_TESTS } from '@/lib/clinical/lab-catalog';
import {
  celsiusFromTemperatureInput,
  cmFromLengthInput,
  lengthInputFromCm,
  roundClinical,
  temperatureInputFromCelsius,
} from '@/lib/clinical/unit-conversions';
import {
  NURSE_CHART_TABS,
  NURSE_CHART_TAB_ORDER,
  diffNurseChartForFhir,
  emptyNurseChartForm,
  nurseChartHasData,
  nurseChartStorageKey,
  parseNurseChartDraft,
  serializeNurseChart,
  type NurseChartForm,
  type NurseChartTab,
} from '@/lib/clinical/nurse-chart';
import { inputClass, labelClass } from '@/components/clinical/form-styles';
import { LabImportPanel } from './lab-import-panel';
import { UrinalysisForm } from './urinalysis-form';
import type { ConsultMedication } from '@/lib/clinical/medication-qualifiers';

const TEMP_LOINC = '8310-5';
const HEIGHT_LOINC = '8302-2';
const WEIGHT_LOINC = '29463-7';
const WAIST_LOINC = '8280-0';
const BMI_LOINC = '39156-5';

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function NurseChart({
  patientId,
  appointmentId,
  pregnancyEligible,
  initialMedications = [],
}: {
  patientId: string;
  appointmentId?: string;
  pregnancyEligible: boolean;
  initialMedications?: ConsultMedication[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<NurseChartTab>('vitals');
  const [form, setForm] = useState<NurseChartForm>(emptyNurseChartForm);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastLocalRef = useRef(serializeNurseChart(emptyNurseChartForm()));
  const lastFhirRef = useRef<NurseChartForm>(emptyNurseChartForm());
  const saveInFlightRef = useRef(false);

  const tabIndex = NURSE_CHART_TAB_ORDER.indexOf(tab);
  const isLastStep = tabIndex === NURSE_CHART_TAB_ORDER.length - 1;

  useEffect(() => {
    const stored = parseNurseChartDraft(
      typeof window !== 'undefined' ? localStorage.getItem(nurseChartStorageKey(patientId)) : null,
    );
    if (stored) {
      setForm(stored);
      lastLocalRef.current = serializeNurseChart(stored);
      lastFhirRef.current = { ...stored };
      return;
    }
    if (initialMedications.length > 0) {
      const seeded = { ...emptyNurseChartForm(), medications: initialMedications };
      setForm(seeded);
      lastLocalRef.current = serializeNurseChart(seeded);
      lastFhirRef.current = { ...seeded };
    }
  }, [patientId, initialMedications]);

  useEffect(() => {
    if (!pregnancyEligible) {
      setForm(f => ({ ...f, pregnancy: '' }));
    }
  }, [pregnancyEligible]);

  const heightCm = parseFloat(form.anthropometrics[HEIGHT_LOINC] ?? '');
  const weightKg = parseFloat(form.anthropometrics[WEIGHT_LOINC] ?? '');
  const bmi =
    !Number.isNaN(heightCm) && !Number.isNaN(weightKg) && heightCm > 0 && weightKg > 0
      ? weightKg / ((heightCm / 100) * (heightCm / 100))
      : undefined;

  function setVitals(code: string, value: string) {
    setForm(prev => ({ ...prev, vitals: { ...prev.vitals, [code]: value } }));
  }

  function setAnthro(code: string, value: string) {
    setForm(prev => ({ ...prev, anthropometrics: { ...prev.anthropometrics, [code]: value } }));
  }

  function setLengthStored(loinc: string, raw: string) {
    if (!raw.trim()) {
      setForm(prev => {
        const anthropometrics = { ...prev.anthropometrics };
        delete anthropometrics[loinc];
        return { ...prev, anthropometrics };
      });
      return;
    }
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const cm = roundClinical(cmFromLengthInput(parsed, form.lengthUnit));
    setAnthro(loinc, cm.toString());
  }

  function lengthInputValue(loinc: string): string {
    const cm = parseFloat(form.anthropometrics[loinc] ?? '');
    if (Number.isNaN(cm)) return '';
    const value = lengthInputFromCm(cm, form.lengthUnit);
    return Number.isFinite(value) ? roundClinical(value).toString() : '';
  }

  function setTemperatureInput(raw: string) {
    if (!raw.trim()) {
      setForm(prev => {
        const vitals = { ...prev.vitals };
        delete vitals[TEMP_LOINC];
        return { ...prev, vitals };
      });
      return;
    }
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const celsius = roundClinical(celsiusFromTemperatureInput(parsed, form.tempUnit), 2);
    setVitals(TEMP_LOINC, celsius.toString());
  }

  function temperatureInputValue(): string {
    const celsius = parseFloat(form.vitals[TEMP_LOINC] ?? '');
    if (Number.isNaN(celsius)) return '';
    const value = temperatureInputFromCelsius(celsius, form.tempUnit);
    return Number.isFinite(value) ? roundClinical(value, 2).toString() : '';
  }

  function setWeightInput(raw: string) {
    if (!raw.trim()) {
      setForm(prev => {
        const anthropometrics = { ...prev.anthropometrics };
        delete anthropometrics[WEIGHT_LOINC];
        return { ...prev, anthropometrics };
      });
      return;
    }
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const kg = form.weightUnit === 'lb' ? parsed * 0.45359237 : parsed;
    setAnthro(WEIGHT_LOINC, roundClinical(kg).toString());
  }

  const weightInputValue = (() => {
    const kg = parseFloat(form.anthropometrics[WEIGHT_LOINC] ?? '');
    if (Number.isNaN(kg)) return '';
    const value = form.weightUnit === 'lb' ? kg / 0.45359237 : kg;
    return Number.isFinite(value) ? roundClinical(value).toString() : '';
  })();

  const saveLocalDraft = useCallback((snapshot: NurseChartForm) => {
    const serialized = serializeNurseChart(snapshot);
    if (serialized === lastLocalRef.current) return;
    localStorage.setItem(nurseChartStorageKey(patientId), serialized);
    lastLocalRef.current = serialized;
    setLastSavedAt(new Date());
  }, [patientId]);

  const runFhirAutosave = useCallback(
    async () => {
      if (!nurseChartHasData(form)) return;
      if (saveInFlightRef.current) return;

      const diff = diffNurseChartForFhir(lastFhirRef.current, form);
      if (!diff.hasChanges) return;

      saveInFlightRef.current = true;
      setAutosaveStatus('saving');
      try {
        const saved = await persistNurseChartDraft({
          patientId,
          vitals: diff.vitals,
          anthropometrics: diff.anthropometrics,
          bmiContext: {
            heightCm: Number.isNaN(heightCm) ? undefined : heightCm,
            weightKg: Number.isNaN(weightKg) ? undefined : weightKg,
          },
          poc: {
            pregnancy: diff.pregnancy,
            glucose: diff.glucose,
            glucoseUnit: form.glucoseUnit,
            urinalysis: diff.urinalysis,
          },
          pregnancyEligible,
          note: diff.note,
          medications: diff.medications,
        });
        if (saved) {
          lastFhirRef.current = { ...form };
          setAutosaveStatus('saved');
        } else {
          setAutosaveStatus('idle');
        }
      } catch {
        setAutosaveStatus('error');
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [form, patientId, pregnancyEligible],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveLocalDraft(form);
      void runFhirAutosave();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [form, saveLocalDraft, runFhirAutosave]);

  function goBack() {
    if (tabIndex > 0) setTab(NURSE_CHART_TAB_ORDER[tabIndex - 1]!);
  }

  async function goNext() {
    setResult(null);
    await runFhirAutosave();
    if (!isLastStep) setTab(NURSE_CHART_TAB_ORDER[tabIndex + 1]!);
  }

  function completeAndSendToDoctor() {
    setResult(null);
    startTransition(async () => {
      try {
        await runFhirAutosave();
        const diff = diffNurseChartForFhir(lastFhirRef.current, form);
        if (diff.hasChanges) {
          await persistNurseChartDraft({
            patientId,
            vitals: diff.vitals,
            anthropometrics: diff.anthropometrics,
            bmiContext: {
              heightCm: Number.isNaN(heightCm) ? undefined : heightCm,
              weightKg: Number.isNaN(weightKg) ? undefined : weightKg,
            },
            poc: {
              pregnancy: diff.pregnancy,
              glucose: diff.glucose,
              glucoseUnit: form.glucoseUnit,
              urinalysis: diff.urinalysis,
            },
            pregnancyEligible,
            note: diff.note,
            medications: diff.medications,
          });
          lastFhirRef.current = { ...form };
        }
        await completeNurseVisit({ patientId, appointmentId });
        localStorage.removeItem(nurseChartStorageKey(patientId));
        lastLocalRef.current = serializeNurseChart(emptyNurseChartForm());
        router.push('/clinic/nurse');
      } catch (err) {
        setResult({ ok: false, message: (err as Error).message });
      }
    });
  }

  function blockImplicitFormSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  function blockEnterSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName === 'TEXTAREA') return;
    e.preventDefault();
  }

  const autosaveHint =
    autosaveStatus === 'saving'
      ? 'Saving to FHIR…'
      : autosaveStatus === 'saved' && lastSavedAt
        ? `Saved ${formatSavedTime(lastSavedAt)}`
        : autosaveStatus === 'error'
          ? 'Autosave failed — check connection'
          : nurseChartHasData(form)
            ? 'Draft autosaves locally and to FHIR'
            : 'Enter values to start autosave';

  return (
    <form
      onSubmit={blockImplicitFormSubmit}
      onKeyDown={blockEnterSubmit}
      noValidate
      className="space-y-4 text-[13px]"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[12px] text-ink-500">
          Step {tabIndex + 1} of {NURSE_CHART_TABS.length}
          <span className="text-ink-400 mx-1.5">·</span>
          {NURSE_CHART_TABS[tabIndex]?.label}
        </p>
        <p
          className={`text-[11px] shrink-0 ${autosaveStatus === 'error' ? 'text-danger' : 'text-ink-500'}`}
          aria-live="polite"
        >
          {autosaveHint}
        </p>
      </div>

      <div className="flex gap-1 border-b border-ink-100 pb-0">
        {NURSE_CHART_TABS.map((t, i) => {
          const reachable = i <= tabIndex;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && setTab(t.id)}
              className={`px-3 py-2 text-[12px] rounded-t-md border border-b-0 transition-colors ${
                tab === t.id
                  ? 'bg-white border-ink-100 font-medium'
                  : reachable
                    ? 'border-transparent text-ink-500 hover:text-ink-900'
                    : 'border-transparent text-ink-300 cursor-not-allowed'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'vitals' && (
        <>
          <section className="border border-ink-100 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-medium mb-3">Vital signs</h3>
            <div className="grid grid-cols-3 gap-3">
              {VITAL_SIGNS.map(v => (
                <div key={v.code}>
                  <label className={labelClass}>{v.display}</label>
                  {v.code === TEMP_LOINC ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        className={inputClass}
                        placeholder={form.tempUnit === '[degF]' ? '98.6' : '37.0'}
                        value={temperatureInputValue()}
                        onChange={e => setTemperatureInput(e.target.value)}
                      />
                      <select
                        className={inputClass}
                        value={form.tempUnit}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            tempUnit: e.target.value as 'Cel' | '[degF]',
                          }))
                        }
                      >
                        <option value="Cel">°C</option>
                        <option value="[degF]">°F</option>
                      </select>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="any"
                      className={inputClass}
                      placeholder={v.unit}
                      value={form.vitals[v.code] ?? ''}
                      onChange={e => setVitals(v.code, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="border border-ink-100 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-medium mb-3">Anthropometrics</h3>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[12px] text-ink-500">Length units</span>
              <select
                className={`${inputClass} w-auto min-w-[5rem]`}
                value={form.lengthUnit}
                onChange={e =>
                  setForm(prev => ({ ...prev, lengthUnit: e.target.value as 'cm' | 'in' }))
                }
              >
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ANTHROPOMETRICS.map(a => (
                <div key={a.code}>
                  <label className={labelClass}>{a.display}</label>
                  {a.code === WEIGHT_LOINC ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        className={inputClass}
                        placeholder={form.weightUnit}
                        value={weightInputValue}
                        onChange={e => setWeightInput(e.target.value)}
                      />
                      <select
                        className={inputClass}
                        value={form.weightUnit}
                        onChange={e =>
                          setForm(prev => ({ ...prev, weightUnit: e.target.value as 'kg' | 'lb' }))
                        }
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </div>
                  ) : a.code === BMI_LOINC ? (
                    <input
                      type="number"
                      step="any"
                      className={inputClass}
                      value={bmi !== undefined ? roundClinical(bmi).toString() : ''}
                      placeholder="Auto"
                      readOnly
                    />
                  ) : a.code === HEIGHT_LOINC || a.code === WAIST_LOINC ? (
                    <input
                      type="number"
                      step="any"
                      className={inputClass}
                      placeholder={form.lengthUnit}
                      value={lengthInputValue(a.code)}
                      onChange={e => setLengthStored(a.code, e.target.value)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-500 mt-2">
              Temperature is stored in °C; height, waist, and weight are stored in cm/kg on the FHIR server. BMI is
              calculated automatically.
            </p>
          </section>
        </>
      )}

      {tab === 'medications' && (
        <MedicationCatalogSection
          medications={form.medications}
          onMedicationsChange={medications => setForm(prev => ({ ...prev, medications }))}
          collapsibleWhenEmpty
          intakeMode
          title="Current medications"
          description="Document medicines the patient is taking now. Selections autosave to the medication list and are visible to the doctor."
        />
      )}

      {tab === 'poc' && (
        <>
          <section className="border border-ink-100 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-medium mb-3">Point-of-care tests</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POC_TESTS.map(test => {
                if (test.type === 'coded' && test.fieldKey === 'pregnancy') {
                  if (!pregnancyEligible) {
                    return (
                      <div key={test.code} className="sm:col-span-2">
                        <p className="text-[12px] text-ink-500">
                          Pregnancy screening not applicable for this patient.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div key={test.code}>
                      <label className={labelClass}>{test.display}</label>
                      <select
                        className={inputClass}
                        value={form.pregnancy}
                        onChange={e => setForm(prev => ({ ...prev, pregnancy: e.target.value }))}
                      >
                        <option value="">—</option>
                        {test.options.map(o => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (test.type === 'quantity' && test.fieldKey === 'glucose') {
                  return (
                    <div key={test.code}>
                      <label className={labelClass}>{test.display}</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          className={inputClass}
                          placeholder={form.glucoseUnit}
                          value={form.glucose}
                          onChange={e => setForm(prev => ({ ...prev, glucose: e.target.value }))}
                        />
                        <select
                          className={inputClass}
                          value={form.glucoseUnit}
                          onChange={e =>
                            setForm(prev => ({
                              ...prev,
                              glucoseUnit: e.target.value as 'mg/dL' | 'mmol/L',
                            }))
                          }
                        >
                          <option value="mg/dL">mg/dL</option>
                          <option value="mmol/L">mmol/L</option>
                        </select>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </section>

          <section className="border border-ink-100 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-medium mb-3">Urinalysis (dipstick)</h3>
            <UrinalysisForm
              values={form.urinalysis}
              onChange={urinalysis => setForm(prev => ({ ...prev, urinalysis }))}
            />
          </section>

          <section className="border border-ink-100 rounded-lg p-4 bg-white">
            <h3 className="text-sm font-medium mb-3">Nursing note</h3>
            <textarea
              className={`${inputClass} min-h-[100px]`}
              placeholder="Subjective observations, patient education, follow-up…"
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
            />
          </section>
        </>
      )}

      {tab === 'labs' && (
        <section className="border border-ink-100 rounded-lg p-4 bg-white">
          <LabImportPanel patientId={patientId} />
        </section>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-ink-100">
        <button
          type="button"
          onClick={goBack}
          disabled={tabIndex === 0 || pending}
          className="px-4 py-2 text-[12px] border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-40"
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
              type="button"
              disabled={pending}
              onClick={() => completeAndSendToDoctor()}
              className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md hover:bg-ink-700 disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Complete and send to doctor'}
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
        </div>
      )}
    </form>
  );
}
