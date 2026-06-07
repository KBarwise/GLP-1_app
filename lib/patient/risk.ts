import { fhir } from '@/lib/fhir/client';
import { dedupeConditionsBySnomedCode } from '@/lib/clinical/conditions';
import { filterDisorderConditions } from '@/lib/clinical/conditions-server';
import { evaluateSignals, splitBundle, type SafetySignal, type Severity } from '@/lib/signals/rules';
import type { Bundle, Condition, MedicationRequest, Observation, Patient } from '@/lib/fhir/resources';

export type RiskTone = 'danger' | 'warning' | 'success';

export type PatientRiskSummary = {
  riskScore: number;
  riskTone: RiskTone;
  redCount: number;
  amberCount: number;
  blueCount: number;
  atRisk: boolean;
  signals: SafetySignal[];
  topSignals: SafetySignal[];
};

export function summarizePatientRisk(signals: SafetySignal[]): PatientRiskSummary {
  const redCount = signals.filter(s => s.severity === 'red').length;
  const amberCount = signals.filter(s => s.severity === 'amber').length;
  const blueCount = signals.filter(s => s.severity === 'blue').length;
  const riskScore = Math.min(
    100,
    redCount * 30 + amberCount * 12 + blueCount * 4,
  );
  const riskTone: RiskTone =
    redCount > 0 ? 'danger' : amberCount > 0 ? 'warning' : 'success';

  const severityOrder: Record<Severity, number> = { red: 0, amber: 1, blue: 2 };
  const topSignals = [...signals]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 3);

  return {
    riskScore,
    riskTone,
    redCount,
    amberCount,
    blueCount,
    atRisk: redCount > 0 || amberCount > 0,
    signals,
    topSignals,
  };
}

const emptyBundle: Bundle = { resourceType: 'Bundle', type: 'searchset', entry: [] };

export async function loadPatientRiskSnapshot(patientId: string): Promise<PatientRiskSummary> {
  const [obsBundle, condBundle] = await Promise.all([
    fhir.search<Bundle<Observation>>('Observation', {
      patient: patientId,
      _count: 200,
      _sort: '-date',
    }).catch(() => emptyBundle as Bundle<Observation>),
    fhir.search<Bundle<Condition>>('Condition', {
      patient: patientId,
      _count: 100,
    }).catch(() => emptyBundle as Bundle<Condition>),
  ]);

  const observations = splitBundle<Observation>(obsBundle, 'Observation');
  const allConditions = splitBundle<Condition>(condBundle, 'Condition');
  const disorders = dedupeConditionsBySnomedCode(
    await filterDisorderConditions(allConditions, { activeOnly: true }),
  );
  const signals = evaluateSignals({ observations, conditions: disorders });
  return summarizePatientRisk(signals);
}

/** Patients with at least one active incretin MedicationRequest. */
export async function loadIncretinCohortPatients(): Promise<{
  patients: Patient[];
  error?: string;
}> {
  try {
    const meds = await fhir.search<Bundle>('MedicationRequest', {
      status: 'active',
      _include: 'MedicationRequest:patient',
      _count: 200,
    });
    const patients = (meds.entry ?? [])
      .map(e => e.resource as { resourceType?: string } | undefined)
      .filter((r): r is Patient => r?.resourceType === 'Patient');

    const byId = new Map<string, Patient>();
    for (const p of patients) {
      if (p.id) byId.set(p.id, p);
    }
    return { patients: [...byId.values()] };
  } catch (e) {
    return { patients: [], error: (e as Error).message };
  }
}

export type CohortRiskRow = {
  patient: Patient;
  medicationDisplay?: string;
  medicationAuthored?: string;
} & PatientRiskSummary;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function compareRiskRows(a: CohortRiskRow, b: CohortRiskRow): number {
  if (a.redCount !== b.redCount) return b.redCount - a.redCount;
  if (a.amberCount !== b.amberCount) return b.amberCount - a.amberCount;
  return b.riskScore - a.riskScore;
}

export async function loadCohortRiskDashboard(opts?: {
  atRiskOnly?: boolean;
}): Promise<{
  rows: CohortRiskRow[];
  patientsScanned: number;
  error?: string;
}> {
  const { patients, error } = await loadIncretinCohortPatients();
  if (error) {
    return { rows: [], patientsScanned: 0, error };
  }
  if (patients.length === 0) {
    return { rows: [], patientsScanned: 0 };
  }

  let medByPatient = new Map<string, MedicationRequest>();
  try {
    const meds = await fhir.search<Bundle<MedicationRequest>>('MedicationRequest', {
      status: 'active',
      _include: 'MedicationRequest:patient',
      _count: 200,
    });
    for (const entry of meds.entry ?? []) {
      const r = entry.resource;
      if (r?.resourceType !== 'MedicationRequest') continue;
      const id = r.subject?.reference?.split('/').pop();
      if (id && !medByPatient.has(id)) medByPatient.set(id, r);
    }
  } catch {
    medByPatient = new Map();
  }

  const rows = await mapWithConcurrency(patients, 6, async patient => {
    const patientId = patient.id!;
    const risk = await loadPatientRiskSnapshot(patientId);
    const med = medByPatient.get(patientId);
    return {
      patient,
      ...risk,
      medicationDisplay:
        med?.medicationCodeableConcept?.text
        ?? med?.medicationCodeableConcept?.coding?.[0]?.display,
      medicationAuthored: med?.authoredOn?.slice(0, 10),
    };
  });

  const sorted = rows.sort(compareRiskRows);
  const filtered = opts?.atRiskOnly ? sorted.filter(r => r.atRisk) : sorted;

  return {
    rows: filtered,
    patientsScanned: patients.length,
  };
}
