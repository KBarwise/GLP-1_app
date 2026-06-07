'use server';

import { fhir } from '@/lib/fhir/client';
import { assertIncretinPrescribingAllowed } from '@/lib/clinical/incretin-prescribing-guards';
import { conditionsForPrescriptionScreening } from '@/lib/clinical/screening-conditions';
import { resolveWeightManagementPathway } from '@/lib/clinical/weight-management-pathway';
import { loadPatientContext } from '@/lib/patient/load-patient-context';
import { evaluatePrescriptionScreening } from '@/lib/screening/evaluate-prescription';
import { buildMedicationRequest } from '@/lib/fhir/builders';
import type { MedicationRequest } from '@/lib/fhir/resources';

export async function submitPrescription(args: {
  patientId: string;
  agentCode: string;
  agentDisplay: string;
  doseValue: number;
  doseUnit: string;
}): Promise<MedicationRequest> {
  const ctx = await loadPatientContext(args.patientId);
  const screening = await evaluatePrescriptionScreening(
    conditionsForPrescriptionScreening([...ctx.problemList, ...ctx.disorders]),
  );
  const weightPathway = await resolveWeightManagementPathway(ctx.patient, args.patientId);
  assertIncretinPrescribingAllowed({
    observations: ctx.observations,
    signals: ctx.signals,
    screening,
    weightPathway,
  });

  const resource = buildMedicationRequest({
    patientId: args.patientId,
    medicationCode: { code: args.agentCode, display: args.agentDisplay },
    reasonCode: { code: '414916001', display: 'Obesity' },
    doseText: `${args.doseValue} ${args.doseUnit} subcutaneously once weekly`,
    doseValue: args.doseValue,
    doseUnit: args.doseUnit,
    frequencyPeriodDays: 7,
  });
  const created = await fhir.create<MedicationRequest>('MedicationRequest', resource);
  return created;
}
