'use server';

import { revalidatePath } from 'next/cache';
import { canViewClinicalData } from '@/lib/clinic/access';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { fhir } from '@/lib/fhir/client';
import {
  buildCondition,
  buildEncounter,
  buildMedicationRequest,
  buildMedicationRequestFromCatalog,
  buildObservation,
  buildObservationCoded,
  buildObservationString,
  buildServiceRequest,
  loinc,
} from '@/lib/fhir/builders';
import { ANTHROPOMETRICS, LAB_PANELS, VITAL_SIGNS } from '@/lib/clinical/lab-catalog';
import { URINALYSIS_POC } from '@/lib/clinical/urinalysis-poc';
import { activeProblemSnomedCodes } from '@/lib/clinical/conditions';
import { filterDisorderConditions } from '@/lib/clinical/conditions-server';
import { conditionsForPrescriptionScreening } from '@/lib/clinical/screening-conditions';
import { assertIncretinPrescribingAllowed } from '@/lib/clinical/incretin-prescribing-guards';
import { resolveWeightManagementPathway } from '@/lib/clinical/weight-management-pathway';
import { loadPatientContext } from '@/lib/patient/load-patient-context';
import { evaluatePrescriptionScreening } from '@/lib/screening/evaluate-prescription';
import type { ConsultDiagnosis } from '@/lib/clinical/diagnosis-qualifiers';
import { getCatalogMedication } from '@/lib/clinical/medication-catalog';
import type { ConsultMedication } from '@/lib/clinical/medication-qualifiers';
import {
  activeMedicationSnomedCodes,
  consultMedicationFromRequest,
  medicationQualifierNotes,
  medicationSnomedCode,
} from '@/lib/clinical/medications';
import type { Bundle, Condition, MedicationRequest, Observation } from '@/lib/fhir/resources';

export type NurseChartInput = {
  patientId: string;
  vitals: Record<string, string>;
  anthropometrics: Record<string, string>;
  /** Full height/weight for BMI when only one anthropometric changed in this batch. */
  bmiContext?: { heightCm?: number; weightKg?: number };
  poc: {
    pregnancy?: string;
    glucose?: string;
    glucoseUnit?: 'mg/dL' | 'mmol/L';
    urinalysis?: Record<string, string>;
  };
  pregnancyEligible?: boolean;
  note?: string;
  medications?: ConsultMedication[];
};

export type LabImportRow = {
  code: string;
  display: string;
  unit: string;
  value: number;
};

function assertClinicalWrite(): void {
  if (!canViewClinicalData(getActingRoleFromCookie())) {
    throw new Error('Clinical documentation is not available in this role.');
  }
}

function revalidatePatient(patientId: string) {
  revalidatePath(`/patient/${patientId}`);
  revalidatePath(`/patient/${patientId}/nurse`);
  revalidatePath(`/patient/${patientId}/consult`);
  revalidatePath(`/patient/${patientId}/consult/document`);
}

async function writeNurseChartObservations(args: NurseChartInput): Promise<number> {
  const created: Observation[] = [];
  let heightCm = args.bmiContext?.heightCm;
  let weightKg = args.bmiContext?.weightKg;
  let anthroSaved = false;

  for (const def of VITAL_SIGNS) {
    const raw = args.vitals[def.code];
    if (!raw?.trim()) continue;
    const v = parseFloat(raw);
    if (Number.isNaN(v)) continue;
    const obs = await fhir.create<Observation>('Observation', buildObservation({
      patientId: args.patientId,
      code: loinc(def.code, def.display),
      value: v,
      unit: def.unit,
      category: 'vital-signs',
    }));
    created.push(obs);
  }

  for (const def of ANTHROPOMETRICS) {
    if (def.code === '39156-5') continue;
    const raw = args.anthropometrics[def.code];
    if (!raw?.trim()) continue;
    const v = parseFloat(raw);
    if (Number.isNaN(v)) continue;
    if (def.code === '8302-2') heightCm = v;
    if (def.code === '29463-7') weightKg = v;
    anthroSaved = true;
    const obs = await fhir.create<Observation>('Observation', buildObservation({
      patientId: args.patientId,
      code: loinc(def.code, def.display),
      value: v,
      unit: def.unit,
      category: 'vital-signs',
    }));
    created.push(obs);
  }

  if (anthroSaved && heightCm && weightKg && heightCm > 0 && weightKg > 0) {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    if (!Number.isNaN(bmi) && Number.isFinite(bmi)) {
      const obs = await fhir.create<Observation>('Observation', buildObservation({
        patientId: args.patientId,
        code: loinc('39156-5', 'BMI'),
        value: Math.round(bmi * 100) / 100,
        unit: 'kg/m2',
        category: 'vital-signs',
      }));
      created.push(obs);
    }
  }

  if (args.pregnancyEligible && args.poc.pregnancy) {
    const obs = await fhir.create<Observation>('Observation', buildObservationCoded({
      patientId: args.patientId,
      loinc: '81025-3',
      display: 'Pregnancy test',
      result: args.poc.pregnancy,
    }));
    created.push(obs);
  }

  if (args.poc.glucose) {
    const v = parseFloat(args.poc.glucose);
    if (!Number.isNaN(v)) {
      const glucoseMgDl = args.poc.glucoseUnit === 'mmol/L' ? v * 18 : v;
      const obs = await fhir.create<Observation>('Observation', buildObservation({
        patientId: args.patientId,
        code: loinc('2345-7', 'Blood glucose POC'),
        value: Math.round(glucoseMgDl * 100) / 100,
        unit: 'mg/dL',
        category: 'laboratory',
      }));
      created.push(obs);
    }
  }

  if (args.poc.urinalysis) {
    for (const field of URINALYSIS_POC) {
      const result = args.poc.urinalysis[field.loinc]?.trim();
      if (!result) continue;
      const obs = await fhir.create<Observation>('Observation', buildObservationCoded({
        patientId: args.patientId,
        loinc: field.loinc,
        display: field.display,
        result,
      }));
      created.push(obs);
    }
  }

  if (args.note?.trim()) {
    const obs = await fhir.create<Observation>('Observation', buildObservationString({
      patientId: args.patientId,
      loinc: '34746-8',
      display: 'Nursing note',
      value: args.note.trim(),
      category: 'survey',
    }));
    created.push(obs);
  }

  return created.length;
}

const INTAKE_REASON = { code: '308335008', display: 'Patient encounter procedure' };

function medicationNotesMatch(
  mr: MedicationRequest,
  rx: ConsultMedication,
): boolean {
  const parsed = consultMedicationFromRequest(mr);
  if (!parsed) return true;
  return parsed.changeType === rx.changeType && parsed.priority === rx.priority;
}

async function syncNurseMedications(
  patientId: string,
  desired: ConsultMedication[],
): Promise<number> {
  const medBundle = await fhir.search<Bundle<MedicationRequest>>('MedicationRequest', {
    patient: patientId,
    status: 'active',
    _count: 100,
  }).catch(() => ({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] }));

  const active = (medBundle.entry ?? [])
    .map(e => e.resource)
    .filter((r): r is MedicationRequest => r?.resourceType === 'MedicationRequest');

  const desiredByCode = new Map(desired.map(rx => [rx.code, rx]));
  let count = 0;

  for (const mr of active) {
    const code = medicationSnomedCode(mr);
    if (!code || !mr.id) continue;

    if (!desiredByCode.has(code)) {
      await fhir.update<MedicationRequest>('MedicationRequest', mr.id, {
        ...mr,
        status: 'stopped',
      });
      count += 1;
      continue;
    }

    const rx = desiredByCode.get(code)!;
    if (rx.changeType === 'stop') {
      await fhir.update<MedicationRequest>('MedicationRequest', mr.id, {
        ...mr,
        status: 'stopped',
        note: medicationQualifierNotes({ changeType: 'stop', priority: rx.priority }),
      });
      count += 1;
      continue;
    }
    if (!medicationNotesMatch(mr, rx)) {
      await fhir.update<MedicationRequest>('MedicationRequest', mr.id, {
        ...mr,
        ...(rx.priority !== 'routine' ? { priority: rx.priority } : { priority: undefined }),
        note: medicationQualifierNotes({
          changeType: rx.changeType,
          priority: rx.priority,
        }),
      });
      count += 1;
    }
  }

  const stillActive = activeMedicationSnomedCodes(
    active.filter(mr => {
      const code = medicationSnomedCode(mr);
      return code && desiredByCode.has(code);
    }),
  );

  for (const rx of desired) {
    if (stillActive.has(rx.code)) continue;
    const med = getCatalogMedication(rx.code);
    if (!med) continue;
    await fhir.create<MedicationRequest>('MedicationRequest', buildMedicationRequestFromCatalog({
      patientId,
      medicationCode: { code: med.code, display: med.display },
      doseText: med.defaultDoseText,
      reasonCodes: [INTAKE_REASON],
      routeCode: med.routeCode,
      routeDisplay: med.routeDisplay,
      priority: rx.priority,
      qualifierNotes: medicationQualifierNotes({
        changeType: rx.changeType,
        priority: rx.priority,
      }),
    }));
    count += 1;
  }

  return count;
}

/** Autosave / step save — only writes fields present in the payload. */
export async function persistNurseChartDraft(
  args: NurseChartInput,
): Promise<{ created: number } | null> {
  assertClinicalWrite();

  const hasAny =
    Object.keys(args.vitals).length > 0
    || Object.keys(args.anthropometrics).length > 0
    || Boolean(args.poc.pregnancy)
    || Boolean(args.poc.glucose)
    || Boolean(args.poc.urinalysis && Object.keys(args.poc.urinalysis).length > 0)
    || Boolean(args.note?.trim())
    || args.medications !== undefined;

  if (!hasAny) return null;

  let created = 0;
  const obsCreated = await writeNurseChartObservations(args);
  created += obsCreated;

  if (args.medications !== undefined) {
    created += await syncNurseMedications(args.patientId, args.medications);
  }

  if (created === 0) return null;

  revalidatePatient(args.patientId);
  return { created };
}

export async function submitNurseChart(args: NurseChartInput & { note: string }): Promise<{ created: number }> {
  assertClinicalWrite();
  const created = await writeNurseChartObservations(args);
  revalidatePatient(args.patientId);
  return { created };
}

export async function commitLabImport(
  patientId: string,
  rows: LabImportRow[],
): Promise<{ created: number }> {
  assertClinicalWrite();
  let created = 0;

  for (const row of rows) {
    if (!row.code || Number.isNaN(row.value)) continue;
    await fhir.create<Observation>('Observation', buildObservation({
      patientId,
      code: loinc(row.code, row.display),
      value: Math.round(row.value * 100) / 100,
      unit: row.unit,
      category: 'laboratory',
    }));
    created += 1;
  }

  revalidatePatient(patientId);
  return { created };
}

const PRESCRIBE_AGENTS: Record<string, { display: string }> = {
  '781415001': { display: 'Semaglutide' },
  '1187428003': { display: 'Tirzepatide' },
  '423654006': { display: 'Liraglutide' },
  '449168004': { display: 'Dulaglutide' },
};

export async function submitConsultation(args: {
  patientId: string;
  reason: string;
  symptomCodes: string[];
  symptomLabels: Record<string, string>;
  diagnoses: ConsultDiagnosis[];
  prescribeIncretin?: {
    agentCode: string;
    doseValue: number;
    doseUnit: string;
    changeType: ConsultMedication['changeType'];
    priority: ConsultMedication['priority'];
  };
  medications?: ConsultMedication[];
  medicationDiscontinuations?: string[];
  labPanels: string[];
}): Promise<{ encounterId?: string; resources: number }> {
  assertClinicalWrite();
  let count = 0;

  const condBundle = await fhir.search<Bundle<Condition>>('Condition', {
    patient: args.patientId,
    _count: 100,
  }).catch(() => ({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] }));
  const allConditions = (condBundle.entry ?? [])
    .map(e => e.resource)
    .filter((r): r is Condition => r?.resourceType === 'Condition');
  const disorders = await filterDisorderConditions(allConditions);
  const existingProblems = activeProblemSnomedCodes(disorders);
  const prescriptionScreening = await evaluatePrescriptionScreening(
    conditionsForPrescriptionScreening(allConditions),
  );

  if (args.prescribeIncretin) {
    const ctx = await loadPatientContext(args.patientId);
    const weightPathway = await resolveWeightManagementPathway(ctx.patient, args.patientId);
    assertIncretinPrescribingAllowed({
      observations: ctx.observations,
      signals: ctx.signals,
      screening: prescriptionScreening,
      weightPathway,
    });
  }

  const medBundle = await fhir.search<Bundle<MedicationRequest>>('MedicationRequest', {
    patient: args.patientId,
    status: 'active',
    _count: 100,
  }).catch(() => ({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] }));
  const activeMedResources = (medBundle.entry ?? [])
    .map(e => e.resource)
    .filter((r): r is MedicationRequest => r?.resourceType === 'MedicationRequest');

  const existingMedications = activeMedicationSnomedCodes(activeMedResources);
  const discontinueSet = new Set(args.medicationDiscontinuations ?? []);
  for (const mr of activeMedResources) {
    const code = medicationSnomedCode(mr);
    if (!code || !mr.id || !discontinueSet.has(code)) continue;
    await fhir.update<MedicationRequest>('MedicationRequest', mr.id, {
      ...mr,
      status: 'stopped',
      note: medicationQualifierNotes({ changeType: 'stop', priority: 'routine' }),
    });
    count += 1;
    existingMedications.delete(code);
  }

  const encounter = await fhir.create('Encounter', buildEncounter({
    patientId: args.patientId,
    reason: args.reason,
  }));
  const encounterId = (encounter as { id?: string }).id;
  count += 1;

  for (const code of args.symptomCodes) {
    await fhir.create('Condition', buildCondition({
      patientId: args.patientId,
      code: { code, display: args.symptomLabels[code] ?? code },
      category: 'encounter-diagnosis',
      verification: 'provisional',
    }));
    count += 1;
  }

  const reasonCodes =
    args.diagnoses.length > 0
      ? args.diagnoses.map(d => ({ code: d.code, display: d.display }))
      : [{ code: '414916001', display: 'Obesity' }];

  for (const dx of args.diagnoses) {
    if (existingProblems.has(dx.code)) continue;
    await fhir.create('Condition', buildCondition({
      patientId: args.patientId,
      code: { code: dx.code, display: dx.display },
      category: 'problem-list-item',
      verification: dx.verification,
      clinicalStatus: dx.clinicalStatus,
    }));
    count += 1;
  }

  if (args.prescribeIncretin) {
    const agentCode = args.prescribeIncretin.agentCode;
    if (!discontinueSet.has(agentCode) && !existingMedications.has(agentCode)) {
      const agent = PRESCRIBE_AGENTS[agentCode] ?? { display: 'Incretin agent' };
      await fhir.create<MedicationRequest>('MedicationRequest', buildMedicationRequest({
        patientId: args.patientId,
        medicationCode: { code: agentCode, display: agent.display },
        reasonCodes,
        doseText: `${args.prescribeIncretin.doseValue} ${args.prescribeIncretin.doseUnit} subcutaneously once weekly`,
        doseValue: args.prescribeIncretin.doseValue,
        doseUnit: args.prescribeIncretin.doseUnit,
        priority: args.prescribeIncretin.priority,
        qualifierNotes: medicationQualifierNotes({
          changeType: args.prescribeIncretin.changeType,
          priority: args.prescribeIncretin.priority,
        }),
      }));
      count += 1;
      existingMedications.add(agentCode);
    }
  }

  const orderedMedCodes = new Set<string>();
  for (const rx of args.medications ?? []) {
    if (rx.changeType === 'stop') continue;
    if (orderedMedCodes.has(rx.code) || existingMedications.has(rx.code)) continue;
    const med = getCatalogMedication(rx.code);
    if (!med) continue;
    await fhir.create<MedicationRequest>('MedicationRequest', buildMedicationRequestFromCatalog({
      patientId: args.patientId,
      medicationCode: { code: med.code, display: med.display },
      doseText: med.defaultDoseText,
      reasonCodes,
      routeCode: med.routeCode,
      routeDisplay: med.routeDisplay,
      priority: rx.priority,
      qualifierNotes: medicationQualifierNotes({
        changeType: rx.changeType,
        priority: rx.priority,
      }),
    }));
    orderedMedCodes.add(rx.code);
    existingMedications.add(rx.code);
    count += 1;
  }

  for (const panelId of args.labPanels) {
    const panel = LAB_PANELS.find(p => p.id === panelId);
    if (!panel) continue;
    await fhir.create('ServiceRequest', buildServiceRequest({
      patientId: args.patientId,
      loinc: panel.code,
      display: panel.codingDisplay,
      encounterId,
    }));
    count += 1;
  }

  revalidatePatient(args.patientId);
  return { encounterId, resources: count };
}
