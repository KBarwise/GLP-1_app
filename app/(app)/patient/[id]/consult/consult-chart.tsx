'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendPatientBackToNurse,
  sendPatientToReceptionCheckout,
} from '@/app/(app)/scheduling/actions';
import { submitConsultation } from '../actions';
import {
  CONSULT_SYMPTOMS,
  COMMON_DIAGNOSES,
  LAB_PANELS,
} from '@/lib/clinical/lab-catalog';
import {
  CONSULT_AGENTS,
  CONSULT_CHART_STEP_ORDER,
  CONSULT_CHART_STEPS,
  consultChartHasData,
  consultChartStorageKey,
  emptyConsultChartForm,
  parseConsultChartDraft,
  serializeConsultChart,
  validateConsultChartComplete,
  validateConsultChartStep,
  type ConsultChartForm,
  type ConsultChartStep,
} from '@/lib/clinical/consult-chart';
import {
  CONSULT_CLINICAL_STATUS_OPTIONS,
  VERIFICATION_OPTIONS,
  defaultConsultDiagnosis,
  type ConsultDiagnosis,
  type ConsultDiagnosisClinicalStatus,
  type DiagnosisVerification,
} from '@/lib/clinical/diagnosis-qualifiers';
import { MedicationCatalogSection } from '@/components/clinical/medication-catalog-section';
import {
  MEDICATION_CHANGE_OPTIONS,
  MEDICATION_PRIORITY_OPTIONS,
  type MedicationChangeType,
  type MedicationPriority,
} from '@/lib/clinical/medication-qualifiers';
import { inputClass, labelClass } from '@/components/clinical/form-styles';
import { DoseSelector } from '@/components/clinical/dose-selector';
import { ActiveMedicationsPanel } from '@/components/clinical/active-medications-panel';
import { PrescriptionScreeningPanel } from '@/components/patient/prescription-screening-panel';
import type { IncretinPrescribingBlock } from '@/lib/clinical/incretin-prescribing-guards';
import type { ScreeningEvaluation } from '@/lib/screening/evaluate-prescription';
import type { MedicationRequest } from '@/lib/fhir/resources';
import { Check, Cloud } from 'lucide-react';

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ConsultChart({
  patientId,
  appointmentId,
  chartBackHref,
  existingMedicationCodes = [],
  activeMedications = [],
  screening,
  incretinBlock,
}: {
  patientId: string;
  appointmentId?: string;
  /** When set, Back on the first step leaves the consult workspace (e.g. doctor queue). */
  chartBackHref?: string;
  existingMedicationCodes?: string[];
  activeMedications?: MedicationRequest[];
  screening: ScreeningEvaluation;
  incretinBlock: IncretinPrescribingBlock;
}) {
  const existingMedSet = new Set(existingMedicationCodes);
  const router = useRouter();
  const [step, setStep] = useState<ConsultChartStep>('encounter');
  const [form, setForm] = useState<ConsultChartForm>(emptyConsultChartForm);
  const [hydrated, setHydrated] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastLocalRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientIdRef = useRef(patientId);
  patientIdRef.current = patientId;

  const stepIndex = CONSULT_CHART_STEP_ORDER.indexOf(step);
  const isLastStep = stepIndex === CONSULT_CHART_STEP_ORDER.length - 1;
  const agent = CONSULT_AGENTS.find(a => a.code === form.agentCode) ?? CONSULT_AGENTS[0];

  useEffect(() => {
    setHydrated(false);
    setStepError(null);
    setResult(null);

    const id = patientId;
    const stored = parseConsultChartDraft(
      typeof window !== 'undefined' ? localStorage.getItem(consultChartStorageKey(id)) : null,
    );
    if (stored) {
      setForm(stored);
      setStep(stored.step ?? 'encounter');
      lastLocalRef.current = serializeConsultChart({ ...stored, step: stored.step ?? 'encounter' });
    } else {
      const empty = emptyConsultChartForm();
      setForm(empty);
      setStep('encounter');
      lastLocalRef.current = serializeConsultChart(empty);
    }
    setHydrated(true);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [patientId]);

  useEffect(() => {
    if (!incretinBlock.blocked) return;
    setForm(prev => (prev.prescribeIncretin ? { ...prev, prescribeIncretin: false } : prev));
  }, [incretinBlock.blocked]);

  const saveLocalDraft = useCallback(
    (snapshot: ConsultChartForm, currentStep: ConsultChartStep) => {
      const id = patientIdRef.current;
      const payload: ConsultChartForm = { ...snapshot, step: currentStep };
      const serialized = serializeConsultChart(payload);
      if (serialized === lastLocalRef.current) return;
      try {
        localStorage.setItem(consultChartStorageKey(id), serialized);
        lastLocalRef.current = serialized;
        setLastSavedAt(new Date());
        setAutosaveStatus('saved');
      } catch {
        setAutosaveStatus('error');
      }
    },
    [],
  );

  const scheduleAutosave = useCallback(
    (snapshot: ConsultChartForm, currentStep: ConsultChartStep) => {
      if (!hydrated) return;
      if (!consultChartHasData(snapshot)) {
        setAutosaveStatus('idle');
        return;
      }
      setAutosaveStatus('pending');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveLocalDraft(snapshot, currentStep);
      }, 500);
    },
    [hydrated, saveLocalDraft],
  );

  useEffect(() => {
    scheduleAutosave(form, step);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form, step, scheduleAutosave]);

  function updateForm(
    updater: (prev: ConsultChartForm) => ConsultChartForm,
    opts?: { saveNow?: boolean },
  ) {
    setStepError(null);
    setForm(prev => {
      const next = updater(prev);
      if (opts?.saveNow && hydrated) {
        const payload = { ...next, step };
        try {
          const serialized = serializeConsultChart(payload);
          localStorage.setItem(consultChartStorageKey(patientIdRef.current), serialized);
          lastLocalRef.current = serialized;
          setLastSavedAt(new Date());
          setAutosaveStatus('saved');
        } catch {
          setAutosaveStatus('error');
        }
      }
      return next;
    });
  }

  function toggleSymptom(code: string) {
    updateForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(code)
        ? prev.symptoms.filter(c => c !== code)
        : [...prev.symptoms, code],
    }));
  }

  function togglePanel(id: string) {
    updateForm(prev => ({
      ...prev,
      labPanels: prev.labPanels.includes(id)
        ? prev.labPanels.filter(p => p !== id)
        : [...prev.labPanels, id],
    }));
  }

  function toggleDiagnosis(code: string) {
    const d = COMMON_DIAGNOSES.find(x => x.code === code);
    if (!d) return;
    updateForm(
      prev => {
        if (prev.diagnoses.some(dx => dx.code === code)) {
          return { ...prev, diagnoses: prev.diagnoses.filter(dx => dx.code !== code) };
        }
        return { ...prev, diagnoses: [...prev.diagnoses, defaultConsultDiagnosis(d.code, d.display)] };
      },
      { saveNow: true },
    );
  }

  function updateDiagnosis(
    code: string,
    patch: Partial<Pick<ConsultDiagnosis, 'verification' | 'clinicalStatus'>>,
  ) {
    updateForm(prev => ({
      ...prev,
      diagnoses: prev.diagnoses.map(dx => (dx.code === code ? { ...dx, ...patch } : dx)),
    }));
  }

  function goBack() {
    setStepError(null);
    setResult(null);
    if (stepIndex === 0) {
      if (chartBackHref) router.push(chartBackHref);
      return;
    }
    const prevStep = CONSULT_CHART_STEP_ORDER[stepIndex - 1]!;
    setStep(prevStep);
    saveLocalDraft(form, prevStep);
  }

  const canGoBack = stepIndex > 0 || Boolean(chartBackHref);

  function goNext() {
    setResult(null);
    const err = validateConsultChartStep(form, step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    if (!isLastStep) {
      const nextStep = CONSULT_CHART_STEP_ORDER[stepIndex + 1]!;
      setStep(nextStep);
      saveLocalDraft(form, nextStep);
    }
  }

  function completeConsultation() {
    const err = validateConsultChartComplete(form, incretinBlock.reasons);
    if (err) {
      setStepError(err);
      if (!form.reason.trim()) setStep('encounter');
      else if (form.diagnoses.length === 0) setStep('diagnoses');
      return;
    }

    if (
      !window.confirm(
        'Complete this consultation, save the note, and send the patient to reception for checkout?',
      )
    ) {
      return;
    }

    setStepError(null);
    setResult(null);
    const symptomLabels = Object.fromEntries(CONSULT_SYMPTOMS.map(s => [s.code, s.display]));
    startTransition(async () => {
      try {
        await submitConsultation({
          patientId,
          reason: form.reason.trim(),
          symptomCodes: form.symptoms,
          symptomLabels,
          diagnoses: form.diagnoses,
          labPanels: form.labPanels,
          medications: form.medications,
          medicationDiscontinuations: form.medicationDiscontinuations,
          prescribeIncretin: form.prescribeIncretin
            ? {
                agentCode: form.agentCode,
                doseValue: parseFloat(agent.doses[form.doseIndex]!),
                doseUnit: 'mg',
                changeType: form.incretinChangeType,
                priority: form.incretinPriority,
              }
            : undefined,
        });
        await sendPatientToReceptionCheckout({ patientId, appointmentId });
        localStorage.removeItem(consultChartStorageKey(patientId));
        lastLocalRef.current = null;
        router.push('/clinic/doctor');
      } catch (e) {
        setResult({ ok: false, message: (e as Error).message });
      }
    });
  }

  function sendToNurse() {
    if (
      !window.confirm(
        'Send this patient back to the nurse queue? The consultation will stay open and your draft is kept on this device.',
      )
    ) {
      return;
    }

    setStepError(null);
    setResult(null);
    startTransition(async () => {
      try {
        await sendPatientBackToNurse({ patientId, appointmentId });
        router.push('/clinic/doctor');
      } catch (e) {
        setResult({ ok: false, message: (e as Error).message });
      }
    });
  }

  const autosaveHint =
    autosaveStatus === 'pending'
      ? 'Saving draft…'
      : autosaveStatus === 'saved' && lastSavedAt
        ? `Draft saved at ${formatSavedTime(lastSavedAt)}`
        : autosaveStatus === 'error'
          ? 'Could not save draft'
          : consultChartHasData(form)
            ? 'Changes autosave on this device'
            : 'Start entering details to autosave';

  return (
    <div className="space-y-4 text-[13px]">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[12px] text-ink-500">
          Step {stepIndex + 1} of {CONSULT_CHART_STEPS.length}
          <span className="text-ink-400 mx-1.5">·</span>
          {CONSULT_CHART_STEPS[stepIndex]?.label}
        </p>
        <div
          className={`flex items-center gap-1.5 text-[11px] shrink-0 px-2 py-1 rounded-md ${
            autosaveStatus === 'saved'
              ? 'bg-accent-soft text-accent'
              : autosaveStatus === 'error'
                ? 'bg-danger-soft text-danger'
                : autosaveStatus === 'pending'
                  ? 'bg-ink-50 text-ink-600'
                  : 'text-ink-500'
          }`}
          aria-live="polite"
        >
          {autosaveStatus === 'saved' ? (
            <Check className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Cloud className="h-3.5 w-3.5 shrink-0 opacity-60" />
          )}
          <span>{autosaveHint}</span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-ink-100 pb-0 overflow-x-auto">
        {CONSULT_CHART_STEPS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setStepError(null);
              setStep(t.id);
              saveLocalDraft(form, t.id);
            }}
            className={`px-3 py-2 text-[12px] rounded-t-md border border-b-0 whitespace-nowrap transition-colors ${
              step === t.id
                ? 'bg-white border-ink-100 font-medium text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {stepError && (
        <p className="text-[12px] text-danger bg-danger-soft px-3 py-2 rounded-md">{stepError}</p>
      )}

      {step === 'encounter' && (
        <section className="border border-ink-100 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-medium mb-3">Reason for encounter</h3>
          <textarea
            className={`${inputClass} min-h-[72px]`}
            placeholder="Follow-up for incretin therapy, symptom review…"
            value={form.reason}
            onChange={e => updateForm(prev => ({ ...prev, reason: e.target.value }))}
          />
        </section>
      )}

      {step === 'symptoms' && (
        <section className="border border-ink-100 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-medium mb-3">Symptoms</h3>
          <p className="text-[12px] text-ink-500 mb-3">Select any symptoms reported today (optional).</p>
          <div className="flex flex-wrap gap-2">
            {CONSULT_SYMPTOMS.map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => toggleSymptom(s.code)}
                className={`px-2.5 py-1 rounded-md text-[12px] border ${
                  form.symptoms.includes(s.code)
                    ? 'bg-accent-soft text-accent border-accent/30'
                    : 'bg-ink-50 border-ink-100 hover:border-ink-200'
                }`}
              >
                {s.display}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'diagnoses' && (
        <section className="border border-ink-100 rounded-lg p-4 bg-white space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Diagnoses</h3>
            <p className="text-[12px] text-ink-500 mb-3">
              Select all that apply, then set clinical status and verification for each. Existing
              problem-list entries are not duplicated when you complete the visit.
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_DIAGNOSES.map(d => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => toggleDiagnosis(d.code)}
                  className={`px-2.5 py-1 rounded-md text-[12px] border ${
                    form.diagnoses.some(dx => dx.code === d.code)
                      ? 'bg-accent-soft text-accent border-accent/30'
                      : 'bg-ink-50 border-ink-100 hover:border-ink-200'
                  }`}
                >
                  {d.display}
                </button>
              ))}
            </div>
          </div>
          {form.diagnoses.length > 0 && (
            <ul className="space-y-3 border-t border-ink-100 pt-3">
              {form.diagnoses.map(dx => (
                <li key={dx.code} className="rounded-md border border-ink-100 p-3 bg-ink-50/50">
                  <div className="font-medium text-[13px] mb-2">{dx.display}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Clinical status</label>
                      <select
                        className={inputClass}
                        value={dx.clinicalStatus}
                        onChange={e =>
                          updateDiagnosis(dx.code, {
                            clinicalStatus: e.target.value as ConsultDiagnosisClinicalStatus,
                          })
                        }
                      >
                        {CONSULT_CLINICAL_STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Verification</label>
                      <select
                        className={inputClass}
                        value={dx.verification}
                        onChange={e =>
                          updateDiagnosis(dx.code, {
                            verification: e.target.value as DiagnosisVerification,
                          })
                        }
                      >
                        {VERIFICATION_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 'screening' && (
        <>
          {incretinBlock.blocked && (
            <div className="p-3 rounded-md border border-danger/30 bg-danger-soft/40 text-danger text-[12px] space-y-1">
              <p className="font-medium">Do not prescribe incretin therapy</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {incretinBlock.reasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <PrescriptionScreeningPanel screening={screening} compact />
        </>
      )}

      {step === 'plan' && (
        <>
          {incretinBlock.blocked && (
            <div className="p-3 rounded-md border border-danger/30 bg-danger-soft/40 text-danger text-[12px] space-y-1">
              <p className="font-medium">Incretin prescribing blocked</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {incretinBlock.reasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <ActiveMedicationsPanel
            medications={activeMedications}
            discontinuations={form.medicationDiscontinuations}
            onDiscontinuationsChange={codes =>
              updateForm(prev => ({ ...prev, medicationDiscontinuations: codes }))
            }
          />

          <section className="border border-ink-100 rounded-lg p-4 bg-white space-y-3">
            <div>
              <h3 className="text-sm font-medium">Laboratory orders</h3>
              <p className="text-[12px] text-ink-500 mt-1">
                Select panels to order at this visit. Orders are sent to the lab when you complete
                the consultation.
              </p>
            </div>
            <div className="space-y-2">
              {LAB_PANELS.map(p => {
                const selected = form.labPanels.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePanel(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-info-soft border-info/30'
                        : 'bg-ink-50 border-ink-100 hover:border-ink-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-medium ${selected ? 'text-info' : 'text-ink-900'}`}>
                        {p.display}
                      </span>
                      {selected && <Check className="h-4 w-4 text-info shrink-0" />}
                    </div>
                    <p className="text-[11px] text-ink-500 mt-0.5">{p.description}</p>
                  </button>
                );
              })}
            </div>
            {form.labPanels.length > 0 && (
              <p className="text-[12px] text-ink-600 pt-1 border-t border-ink-100">
                Ordering:{' '}
                {form.labPanels
                  .map(id => LAB_PANELS.find(p => p.id === id)?.display ?? id)
                  .join(', ')}
              </p>
            )}
          </section>

          <MedicationCatalogSection
            medications={form.medications}
            onMedicationsChange={medications =>
              updateForm(prev => ({ ...prev, medications }))
            }
            existingMedCodes={existingMedSet}
            title="Other medications"
            description="Select additional medicines to order. Each medicine can only be added once; medicines already active on the chart cannot be ordered again here."
          />

          <section className="border border-ink-100 rounded-lg p-4 bg-white">
            <label className={`flex items-center gap-2 mb-3 ${incretinBlock.blocked ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={form.prescribeIncretin}
                disabled={incretinBlock.blocked}
                onChange={e => updateForm(prev => ({ ...prev, prescribeIncretin: e.target.checked }))}
              />
              <span className="text-sm font-medium">
                Prescribe incretin therapy
                {incretinBlock.blocked ? ' (contraindicated)' : ''}
              </span>
            </label>
            {form.prescribeIncretin && (
              <div className="space-y-3 pl-6">
                {existingMedSet.has(form.agentCode) && (
                  <p className="text-[12px] text-warning">
                    This agent is already active on the medication list — a duplicate order will not
                    be created.
                  </p>
                )}
                <div>
                  <label className={labelClass}>Agent</label>
                  <select
                    className={inputClass}
                    value={form.agentCode}
                    onChange={e =>
                      updateForm(prev => ({ ...prev, agentCode: e.target.value, doseIndex: 0 }))
                    }
                  >
                    {CONSULT_AGENTS.map(a => (
                      <option key={a.code} value={a.code}>
                        {a.display}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Weekly dose</label>
                  <p className="text-[12px] text-ink-500 mb-2">Select titration step (subcutaneous, once weekly).</p>
                  <DoseSelector
                    doses={agent.doses}
                    selectedIndex={form.doseIndex}
                    onSelect={doseIndex => updateForm(prev => ({ ...prev, doseIndex }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Therapy change</label>
                    <select
                      className={inputClass}
                      value={form.incretinChangeType}
                      onChange={e =>
                        updateForm(prev => ({
                          ...prev,
                          incretinChangeType: e.target.value as MedicationChangeType,
                        }))
                      }
                    >
                      {MEDICATION_CHANGE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Priority</label>
                    <select
                      className={inputClass}
                      value={form.incretinPriority}
                      onChange={e =>
                        updateForm(prev => ({
                          ...prev,
                          incretinPriority: e.target.value as MedicationPriority,
                        }))
                      }
                    >
                      {MEDICATION_PRIORITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-ink-100">
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack || pending}
          className="px-4 py-2 text-[12px] border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {stepIndex === 0 && chartBackHref ? 'Back to queue' : 'Back'}
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={sendToNurse}
            className="px-4 py-2 text-[12px] border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Send to nurse'}
          </button>
          {!isLastStep ? (
            <button
              type="button"
              onClick={goNext}
              disabled={pending}
              className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md hover:bg-ink-700 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={completeConsultation}
              className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md hover:bg-ink-700 disabled:opacity-50"
            >
              {pending ? 'Submitting…' : 'Complete & send to reception'}
            </button>
          )}
        </div>
      </div>

      {result && !result.ok && (
        <div className="p-3 rounded-md text-[12px] bg-danger-soft text-danger">{result.message}</div>
      )}
    </div>
  );
}
