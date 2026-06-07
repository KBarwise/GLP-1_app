import { fhir } from '@/lib/fhir/client';
import { buildCondition } from '@/lib/fhir/builders';
import { withWeightPathwayExtension } from '@/lib/clinical/weight-management-pathway';
import { normalizeKioskIntakeLead, type KioskIntakeLead } from './intake-types';
import type { Bundle, Condition, Patient } from '@/lib/fhir/resources';

function snomedCode(condition: Condition): string | undefined {
  return condition.code?.coding?.find(c => c.system?.includes('snomed.info/sct'))?.code
    ?? condition.code?.coding?.[0]?.code;
}

async function existingProblemCodes(patientId: string): Promise<Set<string>> {
  const bundle = await fhir.search<Bundle<Condition>>('Condition', {
    patient: patientId,
    category: 'problem-list-item',
    _count: 100,
  }).catch(() => ({ resourceType: 'Bundle' as const, type: 'searchset' as const, entry: [] }));

  const codes = new Set<string>();
  for (const entry of bundle.entry ?? []) {
    const c = entry.resource;
    if (c?.resourceType !== 'Condition') continue;
    const code = snomedCode(c);
    if (code) codes.add(code);
  }
  return codes;
}

/** Copy kiosk pathway and self-reported screening conditions onto the patient record. */
export async function persistKioskIntakeToPatient(
  patientId: string,
  lead: KioskIntakeLead,
): Promise<{ conditionsCreated: number }> {
  const normalized = normalizeKioskIntakeLead(lead);
  const patient = await fhir.read<Patient>('Patient', patientId);
  await fhir.update<Patient>(
    'Patient',
    patientId,
    withWeightPathwayExtension(patient, normalized.pathway),
  );

  const known = await existingProblemCodes(patientId);
  let conditionsCreated = 0;

  for (const item of normalized.reportedConditions) {
    if (!item.code || known.has(item.code)) continue;
    await fhir.create<Condition>(
      'Condition',
      buildCondition({
        patientId,
        code: { code: item.code, display: item.display },
        category: 'problem-list-item',
        verification: 'unconfirmed',
        clinicalStatus: 'active',
      }),
    );
    known.add(item.code);
    conditionsCreated += 1;
  }

  return { conditionsCreated };
}
