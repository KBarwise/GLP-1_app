import { fhirGetPatientKioskPathway } from '@/lib/kiosk/fhir-kiosk-store';
import type { KioskIntakePathway } from '@/lib/kiosk/intake-types';
import type { Patient } from '@/lib/fhir/resources';

export const WEIGHT_PATHWAY_EXTENSION_URL =
  'http://glp1-monitor.local/StructureDefinition/weight-management-pathway';

export function pathwayFromPatient(patient: Patient | null | undefined): KioskIntakePathway | null {
  const code = patient?.extension?.find(e => e.url === WEIGHT_PATHWAY_EXTENSION_URL)?.valueCode;
  if (code === 'glp1' || code === 'diet-exercise') return code;
  return null;
}

export function withWeightPathwayExtension(
  patient: Patient,
  pathway: KioskIntakePathway,
): Patient {
  const rest = (patient.extension ?? []).filter(e => e.url !== WEIGHT_PATHWAY_EXTENSION_URL);
  return {
    ...patient,
    extension: [...rest, { url: WEIGHT_PATHWAY_EXTENSION_URL, valueCode: pathway }],
  };
}

export function dietExercisePathwayBlockReason(pathway: KioskIntakePathway | null): string | null {
  if (pathway !== 'diet-exercise') return null;
  return (
    'Patient is on the diet and exercise pathway (not GLP-1 eligible at kiosk screening). ' +
    'Incretin therapy must not be prescribed.'
  );
}

/** Patient extension first, then latest kiosk intake for registered patients. */
export async function resolveWeightManagementPathway(
  patient: Patient | null | undefined,
  patientId: string,
): Promise<KioskIntakePathway | null> {
  const onPatient = pathwayFromPatient(patient);
  if (onPatient) return onPatient;
  return fhirGetPatientKioskPathway(patientId);
}
