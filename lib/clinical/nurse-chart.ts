import { ANTHROPOMETRICS, VITAL_SIGNS } from './lab-catalog';
import type { ConsultMedication } from './medication-qualifiers';
import {
  emptyUrinalysisValues,
  urinalysisHasAnyValue,
  URINALYSIS_POC,
} from './urinalysis-poc';

export type NurseChartTab = 'vitals' | 'medications' | 'poc' | 'labs';

/** POC / nursing note is last so completion requires an explicit final click. */
export const NURSE_CHART_TAB_ORDER: NurseChartTab[] = ['vitals', 'medications', 'labs', 'poc'];

export const NURSE_CHART_TABS: { id: NurseChartTab; label: string }[] = [
  { id: 'vitals', label: 'Vital signs & anthropometrics' },
  { id: 'medications', label: 'Current medications' },
  { id: 'labs', label: 'Lab import' },
  { id: 'poc', label: 'Point of care & note' },
];

export type NurseChartForm = {
  vitals: Record<string, string>;
  anthropometrics: Record<string, string>;
  tempUnit: 'Cel' | '[degF]';
  lengthUnit: 'cm' | 'in';
  weightUnit: 'kg' | 'lb';
  pregnancy: string;
  glucose: string;
  glucoseUnit: 'mg/dL' | 'mmol/L';
  urinalysis: Record<string, string>;
  note: string;
  medications: ConsultMedication[];
};

export function emptyNurseChartForm(): NurseChartForm {
  return {
    vitals: {},
    anthropometrics: {},
    tempUnit: 'Cel',
    lengthUnit: 'cm',
    weightUnit: 'kg',
    pregnancy: '',
    glucose: '',
    glucoseUnit: 'mg/dL',
    urinalysis: emptyUrinalysisValues(),
    note: '',
    medications: [],
  };
}

function medicationSnapshot(meds: ConsultMedication[]): string {
  return meds
    .map(m => `${m.code}:${m.changeType}:${m.priority}`)
    .sort()
    .join('|');
}

export function serializeNurseChart(form: NurseChartForm): string {
  return JSON.stringify(form);
}

export function parseNurseChartDraft(raw: string | null): NurseChartForm | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NurseChartForm> & { urinalysis?: string | Record<string, string> };
    const base = emptyNurseChartForm();
    let urinalysis = base.urinalysis;
    if (typeof parsed.urinalysis === 'string') {
      if (parsed.urinalysis.trim()) {
        urinalysis = { ...urinalysis, '24356-8': parsed.urinalysis };
      }
    } else if (parsed.urinalysis) {
      urinalysis = { ...base.urinalysis, ...parsed.urinalysis };
    }
    return {
      ...base,
      ...parsed,
      vitals: parsed.vitals ?? {},
      anthropometrics: parsed.anthropometrics ?? {},
      urinalysis,
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    };
  } catch {
    return null;
  }
}

export function nurseChartStorageKey(patientId: string): string {
  return `glp1-nurse-draft-${patientId}`;
}

export function nurseChartHasData(form: NurseChartForm): boolean {
  const hasVitals = Object.values(form.vitals).some(v => v.trim());
  const hasAnthro = Object.entries(form.anthropometrics).some(
    ([code, v]) => code !== '39156-5' && v.trim(),
  );
  return (
    hasVitals
    || hasAnthro
    || form.pregnancy.trim() !== ''
    || form.glucose.trim() !== ''
    || urinalysisHasAnyValue(form.urinalysis)
    || form.note.trim() !== ''
    || form.medications.length > 0
  );
}

function diffUrinalysis(
  prev: Record<string, string>,
  next: Record<string, string>,
): Record<string, string> | undefined {
  const changed: Record<string, string> = {};
  for (const field of URINALYSIS_POC) {
    const v = next[field.loinc]?.trim() ?? '';
    const p = prev[field.loinc]?.trim() ?? '';
    if (v && v !== p) changed[field.loinc] = v;
  }
  return Object.keys(changed).length > 0 ? changed : undefined;
}

/** Fields to send to FHIR on autosave (only values changed since last persist). */
export function diffNurseChartForFhir(
  prev: NurseChartForm,
  next: NurseChartForm,
): {
  vitals: Record<string, string>;
  anthropometrics: Record<string, string>;
  pregnancy?: string;
  glucose?: string;
  glucoseUnit: 'mg/dL' | 'mmol/L';
  urinalysis?: Record<string, string>;
  note?: string;
  medications?: ConsultMedication[];
  hasChanges: boolean;
} {
  const vitals: Record<string, string> = {};
  for (const def of VITAL_SIGNS) {
    const v = next.vitals[def.code]?.trim() ?? '';
    const p = prev.vitals[def.code]?.trim() ?? '';
    if (v && v !== p) vitals[def.code] = v;
  }

  const anthropometrics: Record<string, string> = {};
  for (const def of ANTHROPOMETRICS) {
    if (def.code === '39156-5') continue;
    const v = next.anthropometrics[def.code]?.trim() ?? '';
    const p = prev.anthropometrics[def.code]?.trim() ?? '';
    if (v && v !== p) anthropometrics[def.code] = v;
  }

  let pregnancy: string | undefined;
  if (next.pregnancy.trim() && next.pregnancy !== prev.pregnancy) {
    pregnancy = next.pregnancy;
  }

  let glucose: string | undefined;
  if (next.glucose.trim() && next.glucose !== prev.glucose) {
    glucose = next.glucose;
  }

  const urinalysis = diffUrinalysis(prev.urinalysis, next.urinalysis);

  let note: string | undefined;
  if (next.note.trim() && next.note !== prev.note) {
    note = next.note;
  }

  let medications: ConsultMedication[] | undefined;
  if (medicationSnapshot(prev.medications) !== medicationSnapshot(next.medications)) {
    medications = next.medications;
  }

  const hasChanges =
    Object.keys(vitals).length > 0
    || Object.keys(anthropometrics).length > 0
    || pregnancy !== undefined
    || glucose !== undefined
    || urinalysis !== undefined
    || note !== undefined
    || medications !== undefined;

  return {
    vitals,
    anthropometrics,
    pregnancy,
    glucose,
    glucoseUnit: next.glucoseUnit,
    urinalysis,
    note,
    medications,
    hasChanges,
  };
}
