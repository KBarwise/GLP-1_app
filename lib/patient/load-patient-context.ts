import { fhir } from '@/lib/fhir/client';
import { dedupeConditionsBySnomedCode } from '@/lib/clinical/conditions';
import {
  filterDisorderConditions,
  loadProblemListConditions,
} from '@/lib/clinical/conditions-server';
import { dedupeMedicationRequestsBySnomedCode } from '@/lib/clinical/medications';
import { summarizePatientRisk } from '@/lib/patient/risk';
import { evaluateSignals, splitBundle } from '@/lib/signals/rules';
import type { Bundle, Condition, MedicationRequest, Observation, Patient } from '@/lib/fhir/resources';

export async function loadPatientContext(id: string) {
  const emptyBundle: Bundle = { resourceType: 'Bundle', type: 'searchset', entry: [] };
  const [patient, obsBundle, condBundle, medBundle] = await Promise.all([
    fhir.read<Patient>('Patient', id).catch(() => null),
    fhir.search<Bundle<Observation>>('Observation', { patient: id, _count: 200, _sort: '-date' }).catch(() => emptyBundle as Bundle<Observation>),
    fhir.search<Bundle<Condition>>('Condition', { patient: id, _count: 100 }).catch(() => emptyBundle as Bundle<Condition>),
    fhir.search<Bundle<MedicationRequest>>('MedicationRequest', { patient: id, status: 'active' }).catch(() => emptyBundle as Bundle<MedicationRequest>),
  ]);
  const observations = splitBundle<Observation>(obsBundle, 'Observation');
  const allConditions = splitBundle<Condition>(condBundle, 'Condition');
  const disorders = dedupeConditionsBySnomedCode(
    await filterDisorderConditions(allConditions, { activeOnly: true }),
  );
  const problemList = await loadProblemListConditions(allConditions);
  const medications = dedupeMedicationRequestsBySnomedCode(
    (medBundle.entry ?? [])
      .map(e => e.resource)
      .filter((r): r is MedicationRequest => r?.resourceType === 'MedicationRequest'),
  );
  const signals = evaluateSignals({ observations, conditions: disorders });
  const { riskScore, riskTone } = summarizePatientRisk(signals);

  return { patient, observations, disorders, problemList, medications, signals, riskScore, riskTone };
}
