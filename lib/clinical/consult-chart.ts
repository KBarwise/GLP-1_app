import { COMMON_DIAGNOSES } from './lab-catalog';
import {
  defaultConsultDiagnosis,
  type ConsultDiagnosis,
  parseConsultClinicalStatus,
  type DiagnosisVerification,
} from './diagnosis-qualifiers';
import { allCatalogMedicationCodes, getCatalogMedication } from './medication-catalog';
import {
  defaultConsultMedication,
  type ConsultMedication,
  type MedicationChangeType,
  type MedicationPriority,
} from './medication-qualifiers';

export const CONSULT_AGENTS = [
  { code: '781415001', display: 'Semaglutide', doses: ['0.25', '0.5', '1.0', '1.7', '2.0', '2.4'] },
  { code: '1187428003', display: 'Tirzepatide', doses: ['2.5', '5', '7.5', '10', '12.5', '15'] },
  { code: '423654006', display: 'Liraglutide', doses: ['0.6', '1.2', '1.8', '2.4', '3.0'] },
  { code: '449168004', display: 'Dulaglutide', doses: ['0.75', '1.5', '3.0', '4.5'] },
] as const;

export type ConsultChartStep = 'encounter' | 'symptoms' | 'diagnoses' | 'screening' | 'plan';

export const CONSULT_CHART_STEP_ORDER: ConsultChartStep[] = [
  'encounter',
  'symptoms',
  'diagnoses',
  'screening',
  'plan',
];

export const CONSULT_CHART_STEPS: { id: ConsultChartStep; label: string }[] = [
  { id: 'encounter', label: 'Encounter' },
  { id: 'symptoms', label: 'Symptoms' },
  { id: 'diagnoses', label: 'Diagnoses' },
  { id: 'screening', label: 'GLP-1 screening' },
  { id: 'plan', label: 'Orders & Rx' },
];

export type ConsultChartForm = {
  reason: string;
  symptoms: string[];
  diagnoses: ConsultDiagnosis[];
  labPanels: string[];
  prescribeIncretin: boolean;
  agentCode: string;
  doseIndex: number;
  medications: ConsultMedication[];
  medicationDiscontinuations: string[];
  incretinChangeType: MedicationChangeType;
  incretinPriority: MedicationPriority;
  step?: ConsultChartStep;
};

export function emptyConsultChartForm(): ConsultChartForm {
  return {
    reason: '',
    symptoms: [],
    diagnoses: [],
    labPanels: ['lft', 'lipase'],
    prescribeIncretin: true,
    agentCode: CONSULT_AGENTS[0].code,
    doseIndex: 0,
    medications: [],
    medicationDiscontinuations: [],
    incretinChangeType: 'start',
    incretinPriority: 'routine',
    step: 'encounter',
  };
}

const VALID_DIAGNOSIS_CODES = new Set<string>(COMMON_DIAGNOSES.map(d => d.code));
const VALID_MED_CODES = new Set(allCatalogMedicationCodes());

export function normalizeDiagnoses(raw: unknown): ConsultDiagnosis[] {
  if (!Array.isArray(raw)) return [];
  const out: ConsultDiagnosis[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && VALID_DIAGNOSIS_CODES.has(item)) {
      const d = COMMON_DIAGNOSES.find(x => x.code === item)!;
      out.push(defaultConsultDiagnosis(d.code, d.display));
      continue;
    }
    if (item && typeof item === 'object' && 'code' in item) {
      const o = item as Partial<ConsultDiagnosis>;
      if (typeof o.code === 'string' && VALID_DIAGNOSIS_CODES.has(o.code)) {
        const d = COMMON_DIAGNOSES.find(x => x.code === o.code)!;
        out.push({
          code: d.code,
          display: d.display,
          verification: (['unconfirmed', 'confirmed', 'provisional', 'differential'] as const).includes(
            o.verification as DiagnosisVerification,
          )
            ? (o.verification as DiagnosisVerification)
            : 'provisional',
          clinicalStatus: parseConsultClinicalStatus(o.clinicalStatus),
        });
      }
    }
  }
  return dedupeDiagnoses(out);
}

function dedupeDiagnoses(diagnoses: ConsultDiagnosis[]): ConsultDiagnosis[] {
  const seen = new Set<string>();
  return diagnoses.filter(d => {
    if (seen.has(d.code)) return false;
    seen.add(d.code);
    return true;
  });
}

export function normalizeMedications(raw: unknown): ConsultMedication[] {
  if (!Array.isArray(raw)) return [];
  const out: ConsultMedication[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && VALID_MED_CODES.has(item)) {
      const entry = getCatalogMedication(item);
      if (entry) out.push(defaultConsultMedication(entry.code, entry.display));
      continue;
    }
    if (item && typeof item === 'object' && 'code' in item) {
      const o = item as Partial<ConsultMedication>;
      if (typeof o.code === 'string' && VALID_MED_CODES.has(o.code)) {
        const entry = getCatalogMedication(o.code)!;
        out.push({
          code: entry.code,
          display: entry.display,
          changeType: (['start', 'continue', 'change', 'refill', 'stop'] as const).includes(
            o.changeType as MedicationChangeType,
          )
            ? (o.changeType as MedicationChangeType)
            : 'start',
          priority: (['routine', 'urgent'] as const).includes(o.priority as MedicationPriority)
            ? (o.priority as MedicationPriority)
            : 'routine',
        });
      }
    }
  }
  return dedupeMedications(out);
}

function dedupeMedications(medications: ConsultMedication[]): ConsultMedication[] {
  const seen = new Set<string>();
  return medications.filter(m => {
    if (seen.has(m.code)) return false;
    seen.add(m.code);
    return true;
  });
}

export function serializeConsultChart(form: ConsultChartForm): string {
  return JSON.stringify(form);
}

export function parseConsultChartDraft(raw: string | null): ConsultChartForm | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsultChartForm> & {
      diagnosisCodes?: string[];
      medicationCodes?: string[];
      prescribe?: boolean;
    };
    const agentCode =
      CONSULT_AGENTS.some(a => a.code === parsed.agentCode)
        ? parsed.agentCode!
        : CONSULT_AGENTS[0].code;
    const agent = CONSULT_AGENTS.find(a => a.code === agentCode)!;
    const doseIndex = Math.min(
      Math.max(0, parsed.doseIndex ?? 0),
      agent.doses.length - 1,
    );
    const step = CONSULT_CHART_STEP_ORDER.includes(parsed.step as ConsultChartStep)
      ? (parsed.step as ConsultChartStep)
      : 'encounter';

    const diagnoses =
      parsed.diagnoses !== undefined
        ? normalizeDiagnoses(parsed.diagnoses)
        : normalizeDiagnoses(parsed.diagnosisCodes);

    return {
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      diagnoses,
      labPanels: Array.isArray(parsed.labPanels) ? parsed.labPanels : ['lft', 'lipase'],
      prescribeIncretin: parsed.prescribeIncretin ?? parsed.prescribe !== false,
      agentCode,
      doseIndex,
      medicationDiscontinuations: Array.isArray(parsed.medicationDiscontinuations)
        ? parsed.medicationDiscontinuations.filter((c): c is string => typeof c === 'string')
        : [],
      medications:
        parsed.medications !== undefined
          ? normalizeMedications(parsed.medications)
          : normalizeMedications(parsed.medicationCodes),
      incretinChangeType: (['start', 'continue', 'change', 'refill', 'stop'] as const).includes(
        parsed.incretinChangeType as MedicationChangeType,
      )
        ? (parsed.incretinChangeType as MedicationChangeType)
        : 'start',
      incretinPriority: (['routine', 'urgent'] as const).includes(
        parsed.incretinPriority as MedicationPriority,
      )
        ? (parsed.incretinPriority as MedicationPriority)
        : 'routine',
      step,
    };
  } catch {
    return null;
  }
}

export function consultChartStorageKey(patientId: string): string {
  return `glp1-consult-draft-${patientId}`;
}

export function consultChartHasData(form: ConsultChartForm): boolean {
  return (
    form.reason.trim() !== ''
    || form.symptoms.length > 0
    || form.diagnoses.length > 0
    || form.medications.length > 0
  );
}

export function validateConsultChartStep(
  form: ConsultChartForm,
  step: ConsultChartStep,
): string | null {
  if (step === 'encounter' && !form.reason.trim()) {
    return 'Reason for encounter is required';
  }
  if (step === 'diagnoses' && form.diagnoses.length === 0) {
    return 'Select at least one diagnosis';
  }
  return null;
}

export function validateConsultChartComplete(
  form: ConsultChartForm,
  incretinBlockReasons?: string[],
): string | null {
  if (!form.reason.trim()) return 'Reason for encounter is required';
  if (form.diagnoses.length === 0) return 'Select at least one diagnosis';
  if (form.prescribeIncretin && incretinBlockReasons && incretinBlockReasons.length > 0) {
    return incretinBlockReasons[0] ?? 'Incretin therapy is contraindicated for this patient';
  }
  return null;
}
